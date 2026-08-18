import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { adminHeroItemPreviewDtoSchema } from '../../../shared/schemas/home'
import type {
  AdminHeroItemPreviewDto,
  HeroOrientation,
  HeroPlacement,
  PublicationFailureStage,
  PublicationOperationDto,
} from '../../../shared/types/contracts'
import type { MediaStorage } from '../media-storage'
import { getPublicMediaCache } from '../public-media-cache'
import {
  claimHeroCollectionVersion,
  clearHeroItemPreview,
  countEnabledHeroItems,
  findHeroCollection,
  findHeroItem,
  findHeroItemVariants,
  findPublicKeysForHeroItem,
  hasEnabledHeroItemAtOrder,
  setHeroItemEnabled,
  setHeroItemPreview,
} from '../repository/hero-collection-repository'
import type { HeroItemRow } from '../repository/hero-collection-repository'
import { insertHomeAuditLog } from '../repository/hero-repository'
import {
  completeOperation,
  deletePublicVariant,
  findPublicationOperation,
  hasActivePublicationOperation,
  insertPublicationOperation,
  markOperationFailed,
  markVariantsCleanupPending,
  resetFailedPublicationOperation,
  setOperationCleanupKeys,
  setOperationEdgePurgeManifest,
  updateOperationStatus,
} from '../repository/publication-repository'
import type { OperationRow } from '../repository/publication-repository'
import {
  assertOperationLease,
  claimOperationLease,
  heartbeatOperationLease,
  holdsOperationLease,
  releaseOperationLease,
} from '../repository/operation-lease'
import type { OperationLease } from '../repository/operation-lease'
import { ensureHeroUpscaleSource, generatePrivateWatermarkPreview } from '../recipe/media-recipe'
import {
  assetSupportsSiteDisplay,
  generateSiteDisplayVariants,
  HOME_ENTRY_USAGES,
  missingSiteDisplayVariantCount,
  SITE_HERO_USAGES,
} from '../recipe/site-display-recipe'
import { ServiceError } from '../service-error'
import { heroItemUpscaleReady } from '../service/hero-collection-management'
import { registerOperationResumer } from './operation-recovery'
import {
  edgePurgeUrlsForObjectKeys,
  runOperationEdgePurge,
} from './public-media-purge'
import { activeWatermarkProfileId } from './watermark-branding'
import { getPublicationOperation } from './work-publication'

const HERO_PREVIEW_TTL_MS = 5 * 60 * 1_000

function requireCollectionVersion(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
) {
  const collection = findHeroCollection(sqlite, placement, orientation)
  if (!collection || collection.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Hero collection version is stale.', 'VERSION_CONFLICT')
  }
  return collection
}

function requireItem(sqlite: Database.Database, id: string) {
  const item = findHeroItem(sqlite, id)
  if (!item) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero item was not found.')
  }
  return item
}

function itemUsage(item: Pick<HeroItemRow, 'orientation' | 'placement'>) {
  return SITE_HERO_USAGES[item.placement][item.orientation]
}

/*
 * 首页集合做多图轮播（最多 5 张）；委托页只展示一张大图、不轮播，
 * 因此委托集合同时只允许 1 张启用，替换流程是先停用旧图再启用新图。
 */
function enabledLimit(placement: HeroPlacement) {
  return placement === 'commission' ? 1 : 5
}

function assertItemCanEnable(sqlite: Database.Database, item: HeroItemRow) {
  if (item.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Hero item is already enabled.')
  }
  if (item.sortOrder < 0 || item.sortOrder > 4) {
    throw new ServiceError(409, 'CONFLICT', 'Hero item order is stale.', 'HERO_ORDER_STALE')
  }
  if (
    countEnabledHeroItems(sqlite, item.placement, item.orientation) >= enabledLimit(item.placement)
    || hasEnabledHeroItemAtOrder(
      sqlite,
      item.placement,
      item.orientation,
      item.sortOrder,
    )
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Hero item position is occupied.', 'HERO_SLOT_LIMIT')
  }
  if (!assetSupportsSiteDisplay(sqlite, item.assetId, [itemUsage(item)])) {
    throw new ServiceError(409, 'CONFLICT', 'Hero asset requires confirmed upscale.', 'HERO_ASSETS_REQUIRE_UPSCALE')
  }
}

function assertItemCanDisable(sqlite: Database.Database, item: HeroItemRow) {
  if (item.enabled !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Hero item is already disabled.')
  }
  // 委托页允许下架唯一一张大图以便替换；首页轮播仍必须保留至少一张。
  if (
    item.placement !== 'commission'
    && countEnabledHeroItems(sqlite, item.placement, item.orientation) <= 1
  ) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'At least one hero item must remain enabled.',
      'HERO_LAST_ENABLED_ITEM',
    )
  }
}

function collectionOperation(sqlite: Database.Database, id: string) {
  const row = findPublicationOperation(sqlite, id)
  if (!row || row.entityType !== 'HOME' || !findHeroItem(sqlite, row.entityId)) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero collection operation was not found.')
  }
  return row as OperationRow
}

function requireLease(sqlite: Database.Database, lease: OperationLease) {
  if (!heartbeatOperationLease(sqlite, lease)) {
    throw new Error('Hero collection operation lease was lost.')
  }
}

function setStatus(
  sqlite: Database.Database,
  id: string,
  status: PublicationOperationDto['status'],
  now: number,
) {
  updateOperationStatus(sqlite, id, status, [], now)
}

function failOperation(
  sqlite: Database.Database,
  id: string,
  stage: PublicationFailureStage,
  code: string,
  cleanupKeys: readonly string[],
  now: number,
) {
  markOperationFailed(sqlite, id, { cleanupKeys, code, stage }, now)
}

function publicKeys(sqlite: Database.Database, item: HeroItemRow) {
  return findPublicKeysForHeroItem(sqlite, item)
}

async function deletePublicKeys(
  sqlite: Database.Database,
  storage: MediaStorage,
  keys: readonly string[],
) {
  const remaining: string[] = []
  for (const key of keys) {
    try {
      await storage.deletePublic(key)
      deletePublicVariant(sqlite, key)
    }
    catch {
      remaining.push(key)
    }
  }
  return remaining
}

async function clearPreview(
  sqlite: Database.Database,
  storage: MediaStorage,
  item: HeroItemRow,
) {
  if (item.previewObjectKey) {
    await storage.deletePrivate(item.previewObjectKey)
  }
  if (item.previewObjectKey || item.previewExpiresAt !== null) {
    clearHeroItemPreview(sqlite, item.id)
  }
}

export async function clearHeroCollectionItemPreview(
  sqlite: Database.Database,
  storage: MediaStorage,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
) {
  requireCollectionVersion(sqlite, placement, orientation, expectedVersion)
  const item = requireItem(sqlite, id)
  if (item.placement !== placement || item.orientation !== orientation) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero item was not found.')
  }
  await clearPreview(sqlite, storage, item)
}

function previewKey(item: HeroItemRow) {
  const marker = item.privateObjectKey.indexOf('/original/')
  if (marker < 1) {
    throw new ServiceError(409, 'CONFLICT', 'Hero asset cannot be previewed.')
  }
  return `${item.privateObjectKey.slice(0, marker)}/preview/${item.placement}/${item.id}/${item.orientation}.webp`
}

export async function createHeroCollectionItemPreview(
  sqlite: Database.Database,
  storage: MediaStorage,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
  now = Date.now(),
): Promise<AdminHeroItemPreviewDto> {
  requireCollectionVersion(sqlite, placement, orientation, expectedVersion)
  const item = requireItem(sqlite, id)
  if (item.placement !== placement || item.orientation !== orientation) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero item was not found.')
  }
  if (item.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Disable the hero item before previewing it.', 'HERO_SLIDE_ENABLED')
  }
  const profileId = activeWatermarkProfileId(sqlite)
  if (!profileId) {
    throw new ServiceError(409, 'CONFLICT', 'Active watermark profile is unavailable.', 'WATERMARK_PROFILE_UNAVAILABLE')
  }
  const objectKey = previewKey(item)
  const expiresAt = now + HERO_PREVIEW_TTL_MS
  setHeroItemPreview(sqlite, item.id, objectKey, expiresAt)
  const dimensions = await generatePrivateWatermarkPreview(sqlite, storage, {
    assetId: item.assetId,
    objectKey,
    profileId,
    usage: orientation === 'landscape' ? 'home-hero-landscape' : 'home-hero-portrait',
    width: orientation === 'landscape' ? 768 : 480,
  })
  requireCollectionVersion(sqlite, placement, orientation, expectedVersion)
  if (activeWatermarkProfileId(sqlite) !== profileId) {
    throw new ServiceError(409, 'CONFLICT', 'Active watermark profile changed.')
  }
  return adminHeroItemPreviewDtoSchema.parse({
    url: `/api/admin/v1/site/hero-collections/${placement}/${orientation}/items/${item.id}/preview`,
    expiresAt: new Date(expiresAt).toISOString(),
    height: dimensions.height,
    width: dimensions.width,
  })
}

export async function getHeroCollectionItemPreviewContent(
  sqlite: Database.Database,
  storage: MediaStorage,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  now = Date.now(),
) {
  const item = findHeroItem(sqlite, id, placement, orientation)
  if (!item?.previewObjectKey || !item.previewExpiresAt || item.previewExpiresAt <= now) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero preview was not found.')
  }
  return await storage.getPrivate(item.previewObjectKey)
}

export function startHeroCollectionItemUpscale(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
  now = Date.now(),
) {
  requireCollectionVersion(sqlite, placement, orientation, expectedVersion)
  const item = requireItem(sqlite, id)
  if (item.placement !== placement || item.orientation !== orientation) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero item was not found.')
  }
  if (item.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Enabled hero items cannot be upscaled.', 'HERO_SLIDE_ENABLED')
  }
  const variants = findHeroItemVariants(sqlite, [item.assetId]).get(item.assetId) ?? []
  if (heroItemUpscaleReady(item, variants)) {
    throw new ServiceError(409, 'CONFLICT', 'Hero asset is already ready.')
  }
  if (hasActivePublicationOperation(sqlite, 'HOME', id)) {
    throw new ServiceError(409, 'CONFLICT', 'A hero operation is already active.', 'ACTIVE_OPERATION_EXISTS')
  }
  const operationId = randomUUID()
  insertPublicationOperation(sqlite, {
    entityId: id,
    entityType: 'HOME',
    id: operationId,
    operationType: 'UPSCALE',
    requestedVersion: expectedVersion,
    status: 'PREPARING_SOURCE',
  }, now)
  return getPublicationOperation(sqlite, operationId)
}

export async function runHeroCollectionItemUpscale(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now = Date.now(),
) {
  const operation = collectionOperation(sqlite, operationId)
  if (operation.operationType !== 'UPSCALE') {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero upscale operation was not found.')
  }
  if (operation.status === 'DONE' || operation.status === 'FAILED') {
    return getPublicationOperation(sqlite, operationId)
  }
  const lease = claimOperationLease(sqlite, 'publication_operations', operationId, now)
  if (!lease) {
    return getPublicationOperation(sqlite, operationId)
  }
  const item = requireItem(sqlite, operation.entityId)
  try {
    requireCollectionVersion(
      sqlite,
      item.placement,
      item.orientation,
      operation.requestedVersion,
    )
    if (item.enabled === 1) {
      throw new Error('Enabled hero items cannot be upscaled.')
    }
    requireLease(sqlite, lease)
    await ensureHeroUpscaleSource(sqlite, storage, item.assetId, now)
    requireLease(sqlite, lease)
    requireCollectionVersion(
      sqlite,
      item.placement,
      item.orientation,
      operation.requestedVersion,
    )
    sqlite.transaction(() => {
      assertOperationLease(sqlite, lease)
      const changed = sqlite.prepare(`
        UPDATE publication_operations
        SET status = 'DONE', failure_stage = NULL,
            internal_error_code = NULL, internal_error_message = NULL,
            lease_owner = NULL, lease_expires_at = NULL,
            version = version + 1, updated_at = ?, completed_at = ?
        WHERE id = ? AND status = 'PREPARING_SOURCE'
          AND lease_owner = ? AND attempt = ?
      `).run(now, now, operationId, lease.owner, lease.attempt)
      if (changed.changes !== 1) {
        throw new Error('Hero upscale commit lost its lease.')
      }
      insertHomeAuditLog(sqlite, {
        action: 'HERO_COLLECTION_ITEM_UPSCALE',
        actorUserId,
        entityId: item.id,
        id: randomUUID(),
        result: 'SUCCESS',
      }, now)
    })()
  }
  catch {
    if (holdsOperationLease(sqlite, lease)) {
      failOperation(sqlite, operationId, 'PREPARING_SOURCE', 'HERO_UPSCALE_FAILED', [], now)
      releaseOperationLease(sqlite, lease, now)
    }
  }
  return getPublicationOperation(sqlite, operationId)
}

export function startHeroCollectionItemPublication(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
  now = Date.now(),
) {
  requireCollectionVersion(sqlite, placement, orientation, expectedVersion)
  const item = requireItem(sqlite, id)
  if (item.placement !== placement || item.orientation !== orientation) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero item was not found.')
  }
  assertItemCanEnable(sqlite, item)
  if (hasActivePublicationOperation(sqlite, 'HOME', id)) {
    throw new ServiceError(409, 'CONFLICT', 'A hero operation is already active.', 'ACTIVE_OPERATION_EXISTS')
  }
  const operationId = randomUUID()
  insertPublicationOperation(sqlite, {
    entityId: id,
    entityType: 'HOME',
    id: operationId,
    operationType: 'PUBLISH',
    requestedVersion: expectedVersion,
    status: 'GENERATING_PUBLIC',
  }, now)
  return getPublicationOperation(sqlite, operationId)
}

export async function runHeroCollectionItemPublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now = Date.now(),
) {
  const operation = collectionOperation(sqlite, operationId)
  if (operation.operationType !== 'PUBLISH') {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero publication operation was not found.')
  }
  if (operation.status === 'DONE' || operation.status === 'FAILED') {
    return getPublicationOperation(sqlite, operationId)
  }
  const lease = claimOperationLease(sqlite, 'publication_operations', operationId, now)
  if (!lease) {
    return getPublicationOperation(sqlite, operationId)
  }
  const item = requireItem(sqlite, operation.entityId)
  const before = new Set(publicKeys(sqlite, item))
  let stage: PublicationFailureStage = 'VALIDATING'
  let code = 'HOME_PUBLICATION_VALIDATION_FAILED'
  try {
    requireCollectionVersion(
      sqlite,
      item.placement,
      item.orientation,
      operation.requestedVersion,
    )
    assertItemCanEnable(sqlite, item)
    stage = 'GENERATING_PUBLIC'
    code = 'PUBLIC_MEDIA_GENERATION_FAILED'
    setStatus(sqlite, operationId, 'GENERATING_PUBLIC', now)
    requireLease(sqlite, lease)
    await generateSiteDisplayVariants(sqlite, storage, item.assetId, [itemUsage(item)], now)
    if (item.placement === 'commission' && item.orientation === 'landscape') {
      requireLease(sqlite, lease)
      await generateSiteDisplayVariants(
        sqlite,
        storage,
        item.assetId,
        [HOME_ENTRY_USAGES.commission],
        now,
      )
    }
    requireLease(sqlite, lease)
    stage = 'VERIFYING_PUBLIC'
    code = 'PUBLIC_MEDIA_VERIFICATION_FAILED'
    setStatus(sqlite, operationId, 'VERIFYING_PUBLIC', now)
    const variants = findHeroItemVariants(sqlite, [item.assetId]).get(item.assetId) ?? []
    if (missingSiteDisplayVariantCount(itemUsage(item), variants) !== 0) {
      throw new Error('Hero item requires complete site display variants.')
    }
    await clearPreview(sqlite, storage, item)
    requireLease(sqlite, lease)
    stage = 'COMMITTING'
    code = 'HOME_PUBLICATION_COMMIT_FAILED'
    setStatus(sqlite, operationId, 'COMMITTING', now)
    sqlite.transaction(() => {
      assertOperationLease(sqlite, lease)
      requireCollectionVersion(
        sqlite,
        item.placement,
        item.orientation,
        operation.requestedVersion,
      )
      const current = requireItem(sqlite, item.id)
      assertItemCanEnable(sqlite, current)
      claimHeroCollectionVersion(
        sqlite,
        item.placement,
        item.orientation,
        operation.requestedVersion,
        now,
      )
      if (setHeroItemEnabled(
        sqlite,
        item.id,
        item.placement,
        item.orientation,
        true,
        now,
      ) !== 1) {
        throw new Error('Hero item changed during publication.')
      }
      const changed = sqlite.prepare(`
        UPDATE publication_operations
        SET status = 'DONE', failure_stage = NULL,
            internal_error_code = NULL, internal_error_message = NULL,
            cleanup_object_keys_json = '[]', lease_owner = NULL,
            lease_expires_at = NULL, version = version + 1,
            updated_at = ?, completed_at = ?
        WHERE id = ? AND status = 'COMMITTING'
          AND lease_owner = ? AND attempt = ?
      `).run(now, now, operationId, lease.owner, lease.attempt)
      if (changed.changes !== 1) {
        throw new Error('Hero publication commit lost its lease.')
      }
      insertHomeAuditLog(sqlite, {
        action: 'HERO_COLLECTION_ITEM_ENABLE',
        actorUserId,
        entityId: item.id,
        id: randomUUID(),
        result: 'SUCCESS',
      }, now)
    })()
  }
  catch {
    if (!holdsOperationLease(sqlite, lease)) {
      return getPublicationOperation(sqlite, operationId)
    }
    const generated = publicKeys(sqlite, item).filter(key => !before.has(key))
    const remaining = await deletePublicKeys(sqlite, storage, generated)
    failOperation(
      sqlite,
      operationId,
      remaining.length > 0 ? 'CLEANING_PUBLIC' : stage,
      remaining.length > 0 ? 'PUBLIC_CLEANUP_FAILED' : code,
      remaining,
      now,
    )
    releaseOperationLease(sqlite, lease, now)
  }
  return getPublicationOperation(sqlite, operationId)
}

export function startHeroCollectionItemUnpublication(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
  now = Date.now(),
) {
  requireCollectionVersion(sqlite, placement, orientation, expectedVersion)
  const item = requireItem(sqlite, id)
  if (item.placement !== placement || item.orientation !== orientation) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero item was not found.')
  }
  assertItemCanDisable(sqlite, item)
  if (hasActivePublicationOperation(sqlite, 'HOME', id)) {
    throw new ServiceError(409, 'CONFLICT', 'A hero operation is already active.', 'ACTIVE_OPERATION_EXISTS')
  }
  const operationId = randomUUID()
  insertPublicationOperation(sqlite, {
    entityId: id,
    entityType: 'HOME',
    id: operationId,
    operationType: 'UNPUBLISH',
    requestedVersion: expectedVersion,
    status: 'COMMITTING',
  }, now)
  return getPublicationOperation(sqlite, operationId)
}

function cleanupKeys(value: string) {
  const parsed = JSON.parse(value) as unknown
  if (!Array.isArray(parsed) || parsed.some(key => typeof key !== 'string' || key.length === 0)) {
    throw new Error('Hero cleanup manifest is invalid.')
  }
  return parsed as string[]
}

async function cleanUnpublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  expectedVersion: number,
  now: number,
  heartbeat?: () => void,
) {
  const operation = collectionOperation(sqlite, operationId)
  if (operation.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  let remaining = cleanupKeys(operation.cleanupObjectKeysJson)
  if (
    remaining.length === 0
    && (operation.edgePurgeStatus === 'NOT_REQUIRED' || operation.edgePurgeStatus === 'COMPLETE')
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Publication cleanup is not pending.', 'OPERATION_NOT_RETRYABLE')
  }
  setStatus(sqlite, operationId, 'CLEANING_PUBLIC', now)
  setOperationCleanupKeys(sqlite, operationId, remaining, now)
  for (const key of [...remaining]) {
    try {
      heartbeat?.()
      await storage.deletePublic(key)
      heartbeat?.()
      sqlite.transaction(() => {
        deletePublicVariant(sqlite, key)
        remaining = remaining.filter(candidate => candidate !== key)
        setOperationCleanupKeys(sqlite, operationId, remaining, now)
      })()
    }
    catch {
      failOperation(sqlite, operationId, 'CLEANING_PUBLIC', 'PUBLIC_CLEANUP_FAILED', remaining, now)
      return
    }
  }
  const edgeFailure = await runOperationEdgePurge(
    sqlite,
    getPublicMediaCache(),
    operationId,
    now,
    heartbeat ? { heartbeat } : {},
  )
  if (edgeFailure) {
    failOperation(sqlite, operationId, 'CLEANING_PUBLIC', edgeFailure, [], now)
    return
  }
  completeOperation(sqlite, operationId, now)
}

export async function runHeroCollectionItemUnpublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now = Date.now(),
) {
  const operation = collectionOperation(sqlite, operationId)
  if (operation.operationType !== 'UNPUBLISH') {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero unpublication operation was not found.')
  }
  if (operation.status === 'DONE' || operation.status === 'FAILED') {
    return getPublicationOperation(sqlite, operationId)
  }
  const lease = claimOperationLease(sqlite, 'publication_operations', operationId, now)
  if (!lease) {
    return getPublicationOperation(sqlite, operationId)
  }
  let item = requireItem(sqlite, operation.entityId)
  if (item.enabled !== 1 && operation.status === 'CLEANING_PUBLIC') {
    await cleanUnpublication(
      sqlite,
      storage,
      operationId,
      operation.version,
      now,
      () => requireLease(sqlite, lease),
    )
    releaseOperationLease(sqlite, lease, now)
    return getPublicationOperation(sqlite, operationId)
  }
  try {
    requireCollectionVersion(
      sqlite,
      item.placement,
      item.orientation,
      operation.requestedVersion,
    )
    assertItemCanDisable(sqlite, item)
    await clearPreview(sqlite, storage, item)
    requireLease(sqlite, lease)
    const keys = publicKeys(sqlite, item)
    const edgeUrls = edgePurgeUrlsForObjectKeys(getPublicMediaCache(), keys)
    sqlite.transaction(() => {
      assertOperationLease(sqlite, lease)
      requireCollectionVersion(
        sqlite,
        item.placement,
        item.orientation,
        operation.requestedVersion,
      )
      item = requireItem(sqlite, item.id)
      assertItemCanDisable(sqlite, item)
      claimHeroCollectionVersion(
        sqlite,
        item.placement,
        item.orientation,
        operation.requestedVersion,
        now,
      )
      if (setHeroItemEnabled(
        sqlite,
        item.id,
        item.placement,
        item.orientation,
        false,
        now,
      ) !== 1) {
        throw new Error('Hero item changed during unpublication.')
      }
      markVariantsCleanupPending(sqlite, keys, now)
      updateOperationStatus(sqlite, operationId, 'CLEANING_PUBLIC', keys, now)
      setOperationEdgePurgeManifest(sqlite, operationId, edgeUrls, now)
      insertHomeAuditLog(sqlite, {
        action: 'HERO_COLLECTION_ITEM_DISABLE',
        actorUserId,
        entityId: item.id,
        id: randomUUID(),
        result: 'SUCCESS',
      }, now)
    })()
    const cleaning = collectionOperation(sqlite, operationId)
    if (cleanupKeys(cleaning.cleanupObjectKeysJson).length === 0
      && cleaning.edgePurgeStatus === 'NOT_REQUIRED') {
      completeOperation(sqlite, operationId, now)
    }
    else {
      await cleanUnpublication(
        sqlite,
        storage,
        operationId,
        cleaning.version,
        now,
        () => requireLease(sqlite, lease),
      )
    }
  }
  catch {
    if (holdsOperationLease(sqlite, lease)) {
      failOperation(
        sqlite,
        operationId,
        'COMMITTING',
        'HOME_UNPUBLICATION_COMMIT_FAILED',
        [],
        now,
      )
    }
  }
  releaseOperationLease(sqlite, lease, now)
  return getPublicationOperation(sqlite, operationId)
}

export async function retryHeroCollectionItemOperation(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  expectedVersion: number,
  now = Date.now(),
) {
  const operation = collectionOperation(sqlite, operationId)
  if (operation.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  if (operation.status !== 'FAILED') {
    throw new ServiceError(409, 'CONFLICT', 'Hero operation is not retryable.', 'OPERATION_NOT_RETRYABLE')
  }
  if (operation.operationType === 'UNPUBLISH') {
    await cleanUnpublication(sqlite, storage, operationId, expectedVersion, now)
    return getPublicationOperation(sqlite, operationId)
  }
  if (operation.operationType === 'UPSCALE') {
    resetFailedPublicationOperation(sqlite, operationId, expectedVersion, 'PREPARING_SOURCE', now)
    return getPublicationOperation(sqlite, operationId)
  }
  const remaining = await deletePublicKeys(
    sqlite,
    storage,
    cleanupKeys(operation.cleanupObjectKeysJson),
  )
  if (remaining.length > 0) {
    failOperation(sqlite, operationId, 'CLEANING_PUBLIC', 'PUBLIC_CLEANUP_FAILED', remaining, now)
    return getPublicationOperation(sqlite, operationId)
  }
  const item = requireItem(sqlite, operation.entityId)
  requireCollectionVersion(
    sqlite,
    item.placement,
    item.orientation,
    operation.requestedVersion,
  )
  resetFailedPublicationOperation(sqlite, operationId, expectedVersion, 'GENERATING_PUBLIC', now)
  return getPublicationOperation(sqlite, operationId)
}

function collectionOperationTypeOf(sqlite: Database.Database, operationId: string) {
  const operation = findPublicationOperation(sqlite, operationId)
  return operation?.entityType === 'HOME' && findHeroItem(sqlite, operation.entityId)
    ? operation.operationType
    : undefined
}

for (const operationType of ['PUBLISH', 'UNPUBLISH', 'UPSCALE'] as const) {
  registerOperationResumer({
    table: 'publication_operations',
    matches: (sqlite, operationId) => (
      collectionOperationTypeOf(sqlite, operationId) === operationType
    ),
    failure: () => ({
      stage: operationType === 'UPSCALE'
        ? 'PREPARING_SOURCE'
        : operationType === 'PUBLISH' ? 'GENERATING_PUBLIC' : 'CLEANING_PUBLIC',
      code: `HERO_COLLECTION_${operationType}_INTERRUPTED`,
    }),
    resume: async (sqlite, storage, operationId, resumeNow) => {
      const actorUserId = sqlite.prepare(`
        SELECT id FROM users ORDER BY created_at LIMIT 1
      `).pluck().get() as string | undefined
      if (!actorUserId) {
        throw new Error('No auditable recovery identity is available.')
      }
      const runner = operationType === 'PUBLISH'
        ? runHeroCollectionItemPublication
        : operationType === 'UNPUBLISH'
          ? runHeroCollectionItemUnpublication
          : runHeroCollectionItemUpscale
      const result = await runner(sqlite, storage, operationId, actorUserId, resumeNow)
      if (result.status !== 'DONE' && result.status !== 'FAILED') {
        throw new Error('Hero collection operation did not reach a terminal state.')
      }
    },
  })
}

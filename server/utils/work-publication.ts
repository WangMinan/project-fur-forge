import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type Database from 'better-sqlite3'
import { publicationOperationDtoSchema } from '../../shared/schemas/publication'
import type {
  PublicationBlocker,
  PublicationFailureStage,
  PublicationOperationDto,
  PublicationOperationStatus,
  WorkPublicationCheckDto,
} from '../../shared/types/contracts'
import type { MediaStorage } from './media-storage'
import {
  generatePublicVariants,
  PUBLIC_RECIPE_VERSION,
  publicRecipeWidths,
  publicVariantCountForUsages,
  sourceSupportsPublicUsages,
  workAssetPublicUsages,
} from './media-recipe'
import type { PublicMediaUsage } from './media-recipe'
import { ServiceError } from './service-error'
import { activeWatermarkProfileId } from './watermark-branding'
import { requireWatermarkProfile } from './watermark-profile'

interface OperationRow {
  cleanupObjectKeysJson: string
  completedAt: number | null
  entityId: string
  failureStage: PublicationFailureStage | null
  id: string
  internalErrorCode: string | null
  operationType: 'PUBLISH' | 'UNPUBLISH' | 'UPSCALE'
  requestedVersion: number
  startedAt: number
  status: PublicationOperationStatus
  updatedAt: number
  version: number
}

interface WorkState {
  adoptionMethod: string | null
  businessStatus: string | null
  characterName: string
  id: string
  ownerDisplay: string
  currentEventName: string | null
  priceAmountMinor: number | null
  priceCurrency: string | null
  publicationStatus: 'draft' | 'published' | 'unpublished'
  purpose: 'commission' | 'adoption' | 'showcase'
  slug: string
  species: string
  suitType: string
  version: number
}

interface PublicationAsset {
  alt: string | null
  assetId: string
  cropHeight: number
  cropWidth: number
  height: number
  primary: number
  role: 'design_sheet' | 'studio_photo'
  status: string
  watermarkAnchor: string
  width: number
}

interface PublicationTarget {
  asset: PublicationAsset
  usages: PublicMediaUsage[]
}

const operationColumns = `
    id, operation_type AS operationType, entity_id AS entityId,
    requested_version AS requestedVersion, status,
    cleanup_object_keys_json AS cleanupObjectKeysJson,
    internal_error_code AS internalErrorCode,
    failure_stage AS failureStage, version,
    started_at AS startedAt, updated_at AS updatedAt,
    completed_at AS completedAt
`

const selectOperation = `
  SELECT ${operationColumns}
  FROM publication_operations
`

const selectWork = `
  SELECT
    id, version, slug, character_name AS characterName, species,
    suit_type AS suitType, purpose, adoption_method AS adoptionMethod,
    business_status AS businessStatus,
    current_event_name AS currentEventName,
    price_amount_minor AS priceAmountMinor,
    price_currency AS priceCurrency,
    owner_display AS ownerDisplay,
    publication_status AS publicationStatus
  FROM works
`

function parseCleanupKeys(value: string) {
  const parsed = JSON.parse(value) as unknown
  if (
    !Array.isArray(parsed)
    || parsed.some(key => typeof key !== 'string' || key.length === 0)
  ) {
    throw new Error('Publication cleanup manifest is invalid.')
  }
  return parsed as string[]
}

function operationDto(row: OperationRow): PublicationOperationDto {
  return publicationOperationDtoSchema.parse({
    operationId: row.id,
    operationType: row.operationType,
    entityId: row.entityId,
    requestedVersion: row.requestedVersion,
    status: row.status,
    failureStage: row.failureStage,
    failureCode: row.internalErrorCode,
    cleanupPendingCount: parseCleanupKeys(row.cleanupObjectKeysJson).length,
    version: row.version,
    startedAt: new Date(row.startedAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    completedAt: row.completedAt === null
      ? null
      : new Date(row.completedAt).toISOString(),
  })
}

function findOperation(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectOperation} WHERE id = ?`)
    .get(id) as OperationRow | undefined
}

function requireOperation(sqlite: Database.Database, id: string) {
  const row = findOperation(sqlite, id)
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Publication operation was not found.')
  }
  return row
}

function findWork(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectWork} WHERE id = ?`)
    .get(id) as WorkState | undefined
}

function requireWork(sqlite: Database.Database, id: string) {
  const row = findWork(sqlite, id)
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Work was not found.')
  }
  return row
}

function workState(row: WorkState) {
  return {
    workId: row.id,
    version: row.version,
    publicationStatus: row.publicationStatus,
  }
}

function mediaAssets(sqlite: Database.Database, workId: string) {
  return sqlite.prepare(`
    SELECT
      relation.asset_id AS assetId,
      relation.alt_text AS alt,
      relation.is_primary AS "primary",
      relation.role,
      relation.watermark_anchor AS watermarkAnchor,
      relation.crop_width AS cropWidth,
      relation.crop_height AS cropHeight,
      asset.status, asset.width, asset.height
    FROM work_assets AS relation
    JOIN assets AS asset ON asset.id = relation.asset_id
    WHERE relation.work_id = ?
      AND relation.role IN ('design_sheet', 'studio_photo')
    ORDER BY relation.role, relation.position
  `).all(workId) as PublicationAsset[]
}

function publicationTargets(
  sqlite: Database.Database,
  workId: string,
) {
  const assets = mediaAssets(sqlite, workId)
  const hasPrimaryStudioPhoto = assets.some(asset => (
    asset.role === 'studio_photo' && asset.primary === 1
  ))
  return assets.map((asset): PublicationTarget => ({
    asset,
    usages: workAssetPublicUsages(
      asset.role,
      asset.primary === 1,
      hasPrimaryStudioPhoto,
    ),
  }))
}

function requiredVariantCount(targets: readonly PublicationTarget[]) {
  return targets.reduce(
    (count, target) => count + publicVariantCountForUsages(target.usages),
    0,
  )
}

function missingVariantCount(
  sqlite: Database.Database,
  targets: readonly PublicationTarget[],
) {
  const profileId = activeWatermarkProfileId(sqlite)
  if (!profileId) {
    return requiredVariantCount(targets)
  }
  const profile = requireWatermarkProfile(sqlite, profileId)
  const formats = sqlite.prepare(`
    SELECT format FROM asset_variants
    WHERE asset_id = ? AND storage_scope = 'PUBLIC' AND status = 'READY'
      AND media_role = ? AND usage = ? AND width = ?
      AND recipe_version = ?
      AND watermark_profile = 'brand-centered-v2'
      AND watermark_profile_id = ? AND watermark_config_digest = ?
      AND logo_digest = ? AND watermark_anchor = 'center'
      AND watermark_opacity_percent = ? AND watermark_scale_percent = ?
      AND sha256 NOT GLOB '*[^0-9a-f]*' AND length(sha256) = 64
      AND byte_size > 0
  `)
  let missing = 0
  for (const target of targets) {
    for (const usage of target.usages) {
      for (const width of publicRecipeWidths(usage)) {
        const values = new Set(formats.pluck().all(
          target.asset.assetId,
          target.asset.role,
          usage,
          width,
          PUBLIC_RECIPE_VERSION,
          profile.id,
          profile.configDigest,
          profile.logoDigest,
          profile.opacityPercent,
          profile.scalePercent,
        ) as string[])
        if (!values.has('webp')) {
          missing += 1
        }
        if (!values.has('jpeg') && !values.has('png')) {
          missing += 1
        }
      }
    }
  }
  return missing
}

export function checkWorkPublication(
  sqlite: Database.Database,
  workId: string,
): WorkPublicationCheckDto {
  const work = requireWork(sqlite, workId)
  const targets = publicationTargets(sqlite, workId)
  const publicationPhotos = targets
    .map(target => target.asset)
    .filter(asset => asset.role === 'studio_photo')
  const designSheets = targets
    .map(target => target.asset)
    .filter(asset => asset.role === 'design_sheet')
  const blockers: PublicationBlocker[] = []
  if (
    work.slug.trim() === ''
    || work.characterName.trim() === ''
    || work.species.trim() === ''
    || !['full', 'partial'].includes(work.suitType)
    || work.ownerDisplay.trim() === ''
  ) {
    blockers.push('WORK_FIELDS_INVALID')
  }
  if (work.purpose === 'adoption') {
    if (work.adoptionMethod === 'event_drop') {
      blockers.push('EVENT_DROP_NOT_READY')
    }
    else if (
      work.adoptionMethod !== 'regular'
      || ![
        'preparing',
        'available',
        'scheduled',
        'in_production',
        'delivered',
      ].includes(work.businessStatus ?? '')
      || work.currentEventName !== null
      || (
        work.priceAmountMinor === null
          ? work.priceCurrency !== null
          : work.priceAmountMinor <= 0 || work.priceCurrency !== 'CNY'
      )
    ) {
      blockers.push('WORK_FIELDS_INVALID')
    }
    if (work.adoptionMethod === 'regular' && designSheets.length === 0) {
      blockers.push('DESIGN_SHEET_REQUIRED')
    }
    if (designSheets.some(sheet => sheet.status !== 'READY')) {
      blockers.push('DESIGN_SHEET_NOT_READY')
    }
    if (targets.some(target => (
      target.asset.role === 'design_sheet'
      && !sourceSupportsPublicUsages(target.asset, target.usages)
    ))) {
      blockers.push('DESIGN_SHEET_SOURCE_TOO_SMALL')
    }
    if (designSheets.some(sheet => !sheet.alt?.trim())) {
      blockers.push('DESIGN_SHEET_ALT_REQUIRED')
    }
  }
  else if (publicationPhotos.length === 0) {
    blockers.push('STUDIO_PHOTO_REQUIRED')
  }
  if (
    publicationPhotos.length > 0
    && publicationPhotos.filter(photo => photo.primary === 1).length !== 1
  ) {
    blockers.push('PRIMARY_STUDIO_PHOTO_REQUIRED')
  }
  if (publicationPhotos.some(photo => photo.status !== 'READY')) {
    blockers.push('STUDIO_PHOTO_NOT_READY')
  }
  if (targets.some(target => (
    target.asset.role === 'studio_photo'
    && !sourceSupportsPublicUsages(target.asset, target.usages)
  ))) {
    blockers.push('STUDIO_PHOTO_SOURCE_TOO_SMALL')
  }
  if (publicationPhotos.some(photo => !photo.alt || photo.alt.trim() === '')) {
    blockers.push('STUDIO_PHOTO_ALT_REQUIRED')
  }
  if (!activeWatermarkProfileId(sqlite)) {
    blockers.push('WATERMARK_PROFILE_REQUIRED')
  }
  return {
    workId,
    version: work.version,
    canPublish: blockers.length === 0,
    blockers,
    designSheetCount: designSheets.length,
    studioPhotoCount: publicationPhotos.length,
    requiredVariantCount: requiredVariantCount(targets),
    missingVariantCount: missingVariantCount(sqlite, targets),
  }
}

function createOperation(
  sqlite: Database.Database,
  workId: string,
  requestedVersion: number,
  type: 'PUBLISH' | 'UNPUBLISH',
  now: number,
) {
  const active = sqlite.prepare(`
    SELECT 1 FROM publication_operations
    WHERE entity_type = 'WORK' AND entity_id = ?
      AND status NOT IN ('FAILED', 'DONE')
    LIMIT 1
  `).pluck().get(workId)
  if (active) {
    throw new ServiceError(409, 'CONFLICT', 'A publication operation is already active.')
  }
  const id = randomUUID()
  sqlite.prepare(`
    INSERT INTO publication_operations (
      id, operation_type, entity_type, entity_id, requested_version,
      status, started_at, updated_at
    ) VALUES (?, ?, 'WORK', ?, ?, ?, ?, ?)
  `).run(
    id,
    type,
    workId,
    requestedVersion,
    type === 'PUBLISH' ? 'GENERATING_PUBLIC' : 'COMMITTING',
    now,
    now,
  )
  return requireOperation(sqlite, id)
}

function updateOperation(
  sqlite: Database.Database,
  id: string,
  status: PublicationOperationStatus,
  cleanupKeys: readonly string[],
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET status = ?, cleanup_object_keys_json = ?,
        internal_error_code = NULL, internal_error_message = NULL,
        failure_stage = NULL, version = version + 1, updated_at = ?
    WHERE id = ?
  `).run(status, JSON.stringify(cleanupKeys), now, id)
}

function failOperation(
  sqlite: Database.Database,
  id: string,
  stage: PublicationFailureStage,
  code: string,
  cleanupKeys: readonly string[],
  actorUserId: string,
  now: number,
) {
  sqlite.transaction(() => {
    if (cleanupKeys.length > 0) {
      const markVariant = sqlite.prepare(`
        UPDATE asset_variants
        SET status = 'FAILED', internal_error_code = 'PUBLIC_CLEANUP_PENDING',
            version = version + 1, updated_at = ?
        WHERE storage_scope = 'PUBLIC' AND object_key = ?
      `)
      cleanupKeys.forEach(key => markVariant.run(now, key))
    }
    sqlite.prepare(`
      UPDATE publication_operations
      SET status = 'FAILED', cleanup_object_keys_json = ?,
          internal_error_code = ?, internal_error_message = ?,
          failure_stage = ?, version = version + 1,
          updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(cleanupKeys),
      code,
      'Publication operation failed.',
      stage,
      now,
      now,
      id,
    )
    sqlite.prepare(`
      INSERT INTO audit_logs (
        id, actor_user_id, action, entity_type, entity_id, result, created_at
      ) VALUES (?, ?, 'WORK_PUBLICATION', 'WORK', ?, 'FAILURE', ?)
    `).run(randomUUID(), actorUserId, requireOperation(sqlite, id).entityId, now)
  })()
}

function publicKeys(sqlite: Database.Database, workId: string) {
  return sqlite.prepare(`
    SELECT variant.object_key
    FROM asset_variants AS variant
    JOIN work_assets AS relation ON relation.asset_id = variant.asset_id
    WHERE relation.work_id = ? AND variant.storage_scope = 'PUBLIC'
  `).pluck().all(workId) as string[]
}

function readyPublicKeys(sqlite: Database.Database, workId: string) {
  return sqlite.prepare(`
    SELECT variant.object_key
    FROM asset_variants AS variant
    JOIN work_assets AS relation ON relation.asset_id = variant.asset_id
    WHERE relation.work_id = ? AND variant.storage_scope = 'PUBLIC'
      AND variant.status = 'READY'
  `).pluck().all(workId) as string[]
}

function newlyCreatedKeys(
  sqlite: Database.Database,
  workId: string,
  before: ReadonlySet<string>,
) {
  return publicKeys(sqlite, workId).filter(key => !before.has(key))
}

async function cleanOperationKeys(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  expectedVersion: number,
  actorUserId: string,
  now: number,
  restorePublishFailure?: {
    code: string
    stage: PublicationFailureStage
  },
) {
  const operation = requireOperation(sqlite, operationId)
  if (operation.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
  }
  let remaining = parseCleanupKeys(operation.cleanupObjectKeysJson)
  if (remaining.length === 0) {
    throw new ServiceError(409, 'CONFLICT', 'Publication cleanup is not pending.')
  }
  updateOperation(sqlite, operationId, 'CLEANING_PUBLIC', remaining, now)
  for (const key of [...remaining]) {
    try {
      await storage.deletePublic(key)
      sqlite.transaction(() => {
        sqlite.prepare(`
          DELETE FROM asset_variants
          WHERE storage_scope = 'PUBLIC' AND object_key = ?
        `).run(key)
        remaining = remaining.filter(candidate => candidate !== key)
        sqlite.prepare(`
          UPDATE publication_operations
          SET cleanup_object_keys_json = ?, version = version + 1,
              updated_at = ? WHERE id = ?
        `).run(JSON.stringify(remaining), now, operationId)
      })()
    }
    catch {
      failOperation(
        sqlite,
        operationId,
        'CLEANING_PUBLIC',
        'PUBLIC_CLEANUP_FAILED',
        remaining,
        actorUserId,
        now,
      )
      return requireOperation(sqlite, operationId)
    }
  }

  if (restorePublishFailure) {
    failOperation(
      sqlite,
      operationId,
      restorePublishFailure.stage,
      restorePublishFailure.code,
      [],
      actorUserId,
      now,
    )
  }
  else {
    sqlite.prepare(`
      UPDATE publication_operations
      SET status = 'DONE', cleanup_object_keys_json = '[]',
          internal_error_code = NULL, internal_error_message = NULL,
          failure_stage = NULL, version = version + 1,
          updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(now, now, operationId)
  }
  return requireOperation(sqlite, operationId)
}

function repeatedOperation(
  sqlite: Database.Database,
  workId: string,
  expectedVersion: number,
  type: 'PUBLISH' | 'UNPUBLISH',
) {
  return sqlite.prepare(`
    ${selectOperation}
    WHERE entity_type = 'WORK' AND entity_id = ?
      AND requested_version = ? AND operation_type = ? AND status = 'DONE'
    ORDER BY started_at DESC LIMIT 1
  `).get(workId, expectedVersion, type) as OperationRow | undefined
}

export async function publishWork(
  sqlite: Database.Database,
  storage: MediaStorage,
  workId: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  let work = requireWork(sqlite, workId)
  const repeated = repeatedOperation(
    sqlite,
    workId,
    expectedVersion,
    'PUBLISH',
  )
  if (work.publicationStatus === 'published' && repeated) {
    return { operation: operationDto(repeated), work: workState(work) }
  }
  if (
    work.version === expectedVersion
    && work.publicationStatus !== 'published'
    && !checkWorkPublication(sqlite, workId).canPublish
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Resolve publication blockers before publishing.')
  }
  const operation = createOperation(
    sqlite,
    workId,
    expectedVersion,
    'PUBLISH',
    now,
  )
  const before = new Set(readyPublicKeys(sqlite, workId))
  let stage: PublicationFailureStage = 'VALIDATING'
  let failureCode = 'PUBLICATION_VALIDATION_FAILED'
  try {
    if (work.version !== expectedVersion || work.publicationStatus === 'published') {
      throw new Error('Publication version conflict.')
    }
    const check = checkWorkPublication(sqlite, workId)
    if (!check.canPublish) {
      throw new Error('Publication validation failed.')
    }
    stage = 'APPLYING_WATERMARK'
    failureCode = 'PUBLIC_MEDIA_GENERATION_FAILED'
    updateOperation(sqlite, operation.id, 'APPLYING_WATERMARK', [], now)
    for (const target of publicationTargets(sqlite, workId)) {
      try {
        await generatePublicVariants(
          sqlite,
          storage,
          target.asset.assetId,
          target.usages,
          now,
        )
      }
      catch {
        // ponytail: one bounded retry absorbs OSS cold-read/transient failures;
        // add a worker only if publication volume requires asynchronous jobs.
        await delay(1_000)
        await generatePublicVariants(
          sqlite,
          storage,
          target.asset.assetId,
          target.usages,
          now,
        )
      }
    }
    const generatedKeys = newlyCreatedKeys(sqlite, workId, before)
    stage = 'VERIFYING_PUBLIC'
    failureCode = 'PUBLIC_MEDIA_VERIFICATION_FAILED'
    updateOperation(sqlite, operation.id, 'VERIFYING_PUBLIC', generatedKeys, now)
    if (checkWorkPublication(sqlite, workId).missingVariantCount !== 0) {
      throw new Error('Public recipe is incomplete.')
    }
    stage = 'COMMITTING'
    failureCode = 'PUBLICATION_COMMIT_FAILED'
    updateOperation(sqlite, operation.id, 'COMMITTING', generatedKeys, now)
    sqlite.transaction(() => {
      const updated = sqlite.prepare(`
        UPDATE works
        SET publication_status = 'published', published_at = ?,
            version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND publication_status != 'published'
      `).run(now, now, workId, expectedVersion)
      if (updated.changes !== 1) {
        throw new Error('Publication version changed during generation.')
      }
      sqlite.prepare(`
        UPDATE publication_operations
        SET status = 'DONE', cleanup_object_keys_json = '[]',
            version = version + 1, updated_at = ?, completed_at = ?
        WHERE id = ? AND status = 'COMMITTING'
      `).run(now, now, operation.id)
      sqlite.prepare(`
        INSERT INTO audit_logs (
          id, actor_user_id, action, entity_type, entity_id, result, created_at
        ) VALUES (?, ?, 'WORK_PUBLISH', 'WORK', ?, 'SUCCESS', ?)
      `).run(randomUUID(), actorUserId, workId, now)
    })()
  }
  catch {
    const cleanupKeys = newlyCreatedKeys(sqlite, workId, before)
    failOperation(
      sqlite,
      operation.id,
      stage,
      failureCode,
      cleanupKeys,
      actorUserId,
      now,
    )
    if (cleanupKeys.length > 0) {
      const failed = requireOperation(sqlite, operation.id)
      await cleanOperationKeys(
        sqlite,
        storage,
        operation.id,
        failed.version,
        actorUserId,
        now,
        { stage, code: failureCode },
      )
    }
  }
  work = requireWork(sqlite, workId)
  return {
    operation: operationDto(requireOperation(sqlite, operation.id)),
    work: workState(work),
  }
}

export async function unpublishWork(
  sqlite: Database.Database,
  storage: MediaStorage,
  workId: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  let work = requireWork(sqlite, workId)
  const repeated = repeatedOperation(
    sqlite,
    workId,
    expectedVersion,
    'UNPUBLISH',
  )
  if (work.publicationStatus === 'unpublished' && repeated) {
    return { operation: operationDto(repeated), work: workState(work) }
  }
  if (
    work.version === expectedVersion
    && work.publicationStatus === 'published'
    && sqlite.prepare(`
      SELECT 1 FROM site_hero_slides
      WHERE linked_work_id = ? AND enabled = 1 LIMIT 1
    `).pluck().get(workId)
  ) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Disable or unlink enabled hero slides before unpublishing.',
    )
  }
  const operation = createOperation(
    sqlite,
    workId,
    expectedVersion,
    'UNPUBLISH',
    now,
  )
  if (work.version !== expectedVersion || work.publicationStatus !== 'published') {
    failOperation(
      sqlite,
      operation.id,
      'VALIDATING',
      'UNPUBLICATION_VALIDATION_FAILED',
      [],
      actorUserId,
      now,
    )
  }
  else {
    const keys = publicKeys(sqlite, workId)
    try {
      sqlite.transaction(() => {
        const updated = sqlite.prepare(`
          UPDATE works
          SET publication_status = 'unpublished', published_at = NULL,
              version = version + 1, updated_at = ?
          WHERE id = ? AND version = ? AND publication_status = 'published'
        `).run(now, workId, expectedVersion)
        if (updated.changes !== 1) {
          throw new Error('Unpublication version changed.')
        }
        const markVariant = sqlite.prepare(`
          UPDATE asset_variants
          SET status = 'FAILED', internal_error_code = 'PUBLIC_CLEANUP_PENDING',
              version = version + 1, updated_at = ?
          WHERE storage_scope = 'PUBLIC' AND object_key = ?
        `)
        keys.forEach(key => markVariant.run(now, key))
        updateOperation(sqlite, operation.id, 'CLEANING_PUBLIC', keys, now)
        sqlite.prepare(`
          INSERT INTO audit_logs (
            id, actor_user_id, action, entity_type, entity_id, result, created_at
          ) VALUES (?, ?, 'WORK_UNPUBLISH', 'WORK', ?, 'SUCCESS', ?)
        `).run(randomUUID(), actorUserId, workId, now)
      })()
    }
    catch {
      failOperation(
        sqlite,
        operation.id,
        'COMMITTING',
        'UNPUBLICATION_COMMIT_FAILED',
        [],
        actorUserId,
        now,
      )
    }
    if (requireOperation(sqlite, operation.id).status !== 'FAILED') {
      if (keys.length === 0) {
        updateOperation(sqlite, operation.id, 'DONE', [], now)
        sqlite.prepare(`
          UPDATE publication_operations SET completed_at = ? WHERE id = ?
        `).run(now, operation.id)
      }
      else {
        const cleaning = requireOperation(sqlite, operation.id)
        await cleanOperationKeys(
          sqlite,
          storage,
          operation.id,
          cleaning.version,
          actorUserId,
          now,
        )
      }
    }
  }
  work = requireWork(sqlite, workId)
  return {
    operation: operationDto(requireOperation(sqlite, operation.id)),
    work: workState(work),
  }
}

export function getPublicationOperation(
  sqlite: Database.Database,
  operationId: string,
) {
  return operationDto(requireOperation(sqlite, operationId))
}

export function getLatestPublicationOperations(
  sqlite: Database.Database,
  entityType: 'HOME' | 'WORK',
  entityIds: readonly string[],
) {
  const ids = [...new Set(entityIds)]
  if (ids.length === 0) {
    return []
  }
  const placeholders = ids.map(() => '?').join(', ')
  const rows = sqlite.prepare(`
    SELECT * FROM (
      SELECT ${operationColumns},
        row_number() OVER (
          PARTITION BY entity_id, operation_type
          ORDER BY started_at DESC, id DESC
        ) AS operationRank
      FROM publication_operations
      WHERE entity_type = ? AND entity_id IN (${placeholders})
    )
    WHERE operationRank = 1
  `).all(entityType, ...ids) as OperationRow[]
  return rows.map(operationDto)
}

export async function retryPublicationCleanup(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  const operation = requireOperation(sqlite, operationId)
  if (
    operation.status !== 'FAILED'
    || operation.failureStage !== 'CLEANING_PUBLIC'
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Publication cleanup is not retryable.')
  }
  return operationDto(await cleanOperationKeys(
    sqlite,
    storage,
    operationId,
    expectedVersion,
    actorUserId,
    now,
    operation.operationType === 'PUBLISH'
      ? {
          stage: 'CLEANING_PUBLIC',
          code: operation.internalErrorCode ?? 'PUBLICATION_FAILED',
        }
      : undefined,
  ))
}

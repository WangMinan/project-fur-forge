import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type Database from 'better-sqlite3'
import { publicationOperationDtoSchema } from '../../../shared/schemas/publication'
import type {
  PublicationBlocker,
  PublicationFailureStage,
  PublicationOperationDto,
  PublicationOperationStatus,
  WorkPublicationCheckDto,
} from '../../../shared/types/contracts'
import type { MediaStorage } from '../media-storage'
import {
  generatePublicVariants,
  PUBLIC_RECIPE_VERSION,
  publicRecipeWidths,
  publicVariantCountForUsages,
  sourceSupportsPublicUsages,
  workAssetPublicUsages,
} from '../recipe/media-recipe'
import type { PublicMediaUsage } from '../recipe/media-recipe'
import {
  completeOperation,
  deletePublicVariant,
  findDoneOperation,
  findLatestOperations,
  findPublicationOperation,
  findReadyVariantFormats,
  findRecoveryActorId,
  findWorkMediaAssets,
  findWorkOperationType,
  findWorkPublicKeys,
  findWorkState,
  hasActiveWorkOperation,
  hasEnabledHeroSlideForWork,
  insertWorkAuditLog,
  insertWorkOperation,
  markOperationFailed,
  markVariantsCleanupPending,
  publishWorkRow,
  setOperationCleanupKeys,
  unpublishWorkRow,
  updateOperationStatus,
} from '../repository/publication-repository'
import type {
  OperationRow,
  PublicationAsset,
  WorkState,
} from '../repository/publication-repository'
import {
  assertOperationLease,
  claimOperationLease,
  heartbeatOperationLease,
  holdsOperationLease,
  releaseOperationLease,
} from '../repository/operation-lease'
import type { OperationLease } from '../repository/operation-lease'
import { registerOperationResumer } from './operation-recovery'
import { safeLog } from '../safe-log'
import { ServiceError } from '../service-error'
import {
  assetSupportsSiteDisplay,
  generateSiteDisplayVariants,
  HOME_ENTRY_USAGES,
} from '../recipe/site-display-recipe'
import { activeWatermarkProfileId } from './watermark-branding'
import { requireWatermarkProfile } from '../service/watermark-profile'

interface PublicationTarget {
  asset: PublicationAsset
  usages: PublicMediaUsage[]
}

/**
 * T34-F4：SQL、行映射与条件更新已移入 publication-repository。
 * 本文件保留 service（校验、DTO 组合、事务入口）与 runner（operation、
 * OSS 副作用、阶段推进、心跳、失败与精确清理）。
 */

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

function requireOperation(sqlite: Database.Database, id: string) {
  const row = findPublicationOperation(sqlite, id)
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Publication operation was not found.')
  }
  return row
}

function requireWork(sqlite: Database.Database, id: string) {
  const row = findWorkState(sqlite, id)
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Work was not found.', 'RESOURCE_NOT_FOUND')
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
  return findWorkMediaAssets(sqlite, workId)
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
  let missing = 0
  for (const target of targets) {
    for (const usage of target.usages) {
      for (const width of publicRecipeWidths(usage)) {
        const values = new Set(findReadyVariantFormats(sqlite, {
          assetId: target.asset.assetId,
          configDigest: profile.configDigest,
          logoDigest: profile.logoDigest,
          opacityPercent: profile.opacityPercent,
          profileId: profile.id,
          recipeVersion: PUBLIC_RECIPE_VERSION,
          role: target.asset.role,
          scalePercent: profile.scalePercent,
          usage,
          width,
        }))
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
  if (hasActiveWorkOperation(sqlite, workId)) {
    throw new ServiceError(409, 'CONFLICT', 'A publication operation is already active.', 'ACTIVE_OPERATION_EXISTS')
  }
  const id = randomUUID()
  insertWorkOperation(sqlite, {
    id,
    requestedVersion,
    status: type === 'PUBLISH' ? 'GENERATING_PUBLIC' : 'COMMITTING',
    type,
    workId,
  }, now)
  return requireOperation(sqlite, id)
}

function updateOperation(
  sqlite: Database.Database,
  id: string,
  status: PublicationOperationStatus,
  cleanupKeys: readonly string[],
  now: number,
) {
  updateOperationStatus(sqlite, id, status, cleanupKeys, now)
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
      markVariantsCleanupPending(sqlite, cleanupKeys, now)
    }
    markOperationFailed(sqlite, id, { cleanupKeys, code, stage }, now)
    insertWorkAuditLog(sqlite, {
      action: 'WORK_PUBLICATION',
      actorUserId,
      id: randomUUID(),
      result: 'FAILURE',
      workId: requireOperation(sqlite, id).entityId,
    }, now)
  })()
}

function publicKeys(sqlite: Database.Database, workId: string) {
  return findWorkPublicKeys(sqlite, workId)
}

function readyPublicKeys(sqlite: Database.Database, workId: string) {
  return findWorkPublicKeys(sqlite, workId, true)
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
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
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
        deletePublicVariant(sqlite, key)
        remaining = remaining.filter(candidate => candidate !== key)
        setOperationCleanupKeys(sqlite, operationId, remaining, now)
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
    completeOperation(sqlite, operationId, now)
  }
  return requireOperation(sqlite, operationId)
}

/**
 * 常规领养设定图同时预生成首页领养入口的无水印变体。
 * 入口是站点展示位，缺失时首页受控隐藏，因此不阻塞作品发布。
 */
async function generateAdoptionEntryVariants(
  sqlite: Database.Database,
  storage: MediaStorage,
  work: WorkState,
  targets: readonly PublicationTarget[],
  now: number,
) {
  if (work.purpose !== 'adoption' || work.adoptionMethod !== 'regular') {
    return
  }
  for (const target of targets) {
    if (target.asset.role !== 'design_sheet') {
      continue
    }
    if (!assetSupportsSiteDisplay(
      sqlite,
      target.asset.assetId,
      [HOME_ENTRY_USAGES.adoption],
    )) {
      safeLog('warn', 'Adoption entry source is too small for site display.', {
        assetId: target.asset.assetId,
      })
      continue
    }
    try {
      await generateSiteDisplayVariants(
        sqlite,
        storage,
        target.asset.assetId,
        [HOME_ENTRY_USAGES.adoption],
        now,
      )
    }
    catch (error) {
      safeLog('error', 'Adoption entry variant generation failed.', {
        assetId: target.asset.assetId,
        errorCode: (error as { code?: unknown }).code,
      })
    }
  }
}

function repeatedOperation(
  sqlite: Database.Database,
  workId: string,
  expectedVersion: number,
  type: 'PUBLISH' | 'UNPUBLISH',
) {
  return findDoneOperation(sqlite, workId, expectedVersion, type)
}

export async function publishWork(
  sqlite: Database.Database,
  storage: MediaStorage,
  workId: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  const work = requireWork(sqlite, workId)
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
    throw new ServiceError(409, 'CONFLICT', 'Resolve publication blockers before publishing.', 'WORK_PUBLICATION_BLOCKED')
  }
  const operation = createOperation(
    sqlite,
    workId,
    expectedVersion,
    'PUBLISH',
    now,
  )
  return runWorkPublication(
    sqlite,
    storage,
    operation.id,
    actorUserId,
    now,
  )
}

/**
 * T34-F5：作品发布 runner。与 start 分离后，启动恢复可以在新 attempt 下
 * 重跑同一序列。公开变体按对象 Key 幂等，因此重复生成不会产生半套 SourceSet。
 */
async function runWorkPublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now: number,
) {
  const operation = requireOperation(sqlite, operationId)
  const workId = operation.entityId
  const expectedVersion = operation.requestedVersion
  let work = requireWork(sqlite, workId)
  const lease = claimOperationLease(sqlite, 'publication_operations', operationId, now)
  if (!lease) {
    return {
      operation: operationDto(requireOperation(sqlite, operationId)),
      work: workState(work),
    }
  }
  const before = new Set(readyPublicKeys(sqlite, workId))
  let stage: PublicationFailureStage = 'VALIDATING'
  let failureCode = 'PUBLICATION_VALIDATION_FAILED'
  try {
    // 发布提交与 operation 置 DONE 在同一事务内，因此不存在
    // "业务已提交但 operation 仍非终态" 的窗口：进程被杀只会回滚到
    // 提交前，恢复路径就是在新 attempt 下重跑同一序列。
    if (work.version !== expectedVersion || work.publicationStatus === 'published') {
      throw new Error('Publication version conflict.')
    }
    const check = checkWorkPublication(sqlite, workId)
    if (!check.canPublish) {
      throw new Error('Publication validation failed.')
    }
    stage = 'APPLYING_WATERMARK'
    failureCode = 'PUBLIC_MEDIA_GENERATION_FAILED'
    updateOperation(sqlite, operationId, 'APPLYING_WATERMARK', [], now)
    const targets = publicationTargets(sqlite, workId)
    for (const target of targets) {
      requireWorkLease(sqlite, lease)
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
      requireWorkLease(sqlite, lease)
    }
    await generateAdoptionEntryVariants(sqlite, storage, work, targets, now)
    const generatedKeys = newlyCreatedKeys(sqlite, workId, before)
    stage = 'VERIFYING_PUBLIC'
    failureCode = 'PUBLIC_MEDIA_VERIFICATION_FAILED'
    updateOperation(sqlite, operationId, 'VERIFYING_PUBLIC', generatedKeys, now)
    requireWorkLease(sqlite, lease)
    if (checkWorkPublication(sqlite, workId).missingVariantCount !== 0) {
      throw new Error('Public recipe is incomplete.')
    }
    stage = 'COMMITTING'
    failureCode = 'PUBLICATION_COMMIT_FAILED'
    updateOperation(sqlite, operationId, 'COMMITTING', generatedKeys, now)
    sqlite.transaction(() => {
      // lease CAS 与作品版本 CAS 同事务。
      assertOperationLease(sqlite, lease)
      const updated = publishWorkRow(sqlite, workId, expectedVersion, now)
      if (updated !== 1) {
        throw new Error('Publication version changed during generation.')
      }
      const committed = sqlite.prepare(`
        UPDATE publication_operations
        SET status = 'DONE', cleanup_object_keys_json = '[]',
            lease_owner = NULL, lease_expires_at = NULL,
            version = version + 1, updated_at = ?, completed_at = ?
        WHERE id = ? AND status = 'COMMITTING'
          AND lease_owner = ? AND attempt = ?
      `).run(now, now, operationId, lease.owner, lease.attempt)
      if (committed.changes !== 1) {
        throw new Error('Publication commit lost its lease.')
      }
      insertWorkAuditLog(sqlite, {
        action: 'WORK_PUBLISH',
        actorUserId,
        id: randomUUID(),
        result: 'SUCCESS',
        workId,
      }, now)
    })()
  }
  catch {
    if (!holdsOperationLease(sqlite, lease)) {
      // lease 已被接管：不清理对象、不改状态，避免删掉接管者的新对象。
      return {
        operation: operationDto(requireOperation(sqlite, operationId)),
        work: workState(requireWork(sqlite, workId)),
      }
    }
    const cleanupKeys = newlyCreatedKeys(sqlite, workId, before)
    failOperation(
      sqlite,
      operationId,
      stage,
      failureCode,
      cleanupKeys,
      actorUserId,
      now,
    )
    if (cleanupKeys.length > 0) {
      const failed = requireOperation(sqlite, operationId)
      await cleanOperationKeys(
        sqlite,
        storage,
        operationId,
        failed.version,
        actorUserId,
        now,
        { stage, code: failureCode },
      )
    }
    releaseOperationLease(sqlite, lease, now)
  }
  work = requireWork(sqlite, workId)
  return {
    operation: operationDto(requireOperation(sqlite, operationId)),
    work: workState(work),
  }
}

/** 长 OSS 操作前后更新心跳；失去 lease 立即停止。 */
function requireWorkLease(
  sqlite: Database.Database,
  lease: OperationLease,
) {
  if (!heartbeatOperationLease(sqlite, lease)) {
    throw new Error('Work publication lease was lost.')
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
  const work = requireWork(sqlite, workId)
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
    && hasEnabledHeroSlideForWork(sqlite, workId)
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
  return runWorkUnpublication(
    sqlite,
    storage,
    operation.id,
    actorUserId,
    now,
  )
}

/**
 * T34-F5：下架 runner。下架先在事务内提交状态并登记 cleanup 清单，
 * 再逐个删除公开对象，因此重启后从 cleanup 清单继续即可，不会重复删除。
 */
async function runWorkUnpublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now: number,
) {
  const started = requireOperation(sqlite, operationId)
  const workId = started.entityId
  const expectedVersion = started.requestedVersion
  let work = requireWork(sqlite, workId)
  const lease = claimOperationLease(sqlite, 'publication_operations', operationId, now)
  if (!lease) {
    return {
      operation: operationDto(requireOperation(sqlite, operationId)),
      work: workState(work),
    }
  }
  const operation = { id: operationId }
  if (
    work.publicationStatus === 'unpublished'
    && started.status === 'CLEANING_PUBLIC'
  ) {
    // 提交后重启：状态已切换，从残余 cleanup 清单继续删除。
    const cleaning = requireOperation(sqlite, operationId)
    await cleanOperationKeys(
      sqlite,
      storage,
      operationId,
      cleaning.version,
      actorUserId,
      now,
    )
    return {
      operation: operationDto(requireOperation(sqlite, operationId)),
      work: workState(requireWork(sqlite, workId)),
    }
  }
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
    releaseOperationLease(sqlite, lease, now)
  }
  else {
    const keys = publicKeys(sqlite, workId)
    try {
      sqlite.transaction(() => {
        assertOperationLease(sqlite, lease)
        const updated = unpublishWorkRow(sqlite, workId, expectedVersion, now)
        if (updated !== 1) {
          throw new Error('Unpublication version changed.')
        }
        markVariantsCleanupPending(sqlite, keys, now)
        updateOperation(sqlite, operation.id, 'CLEANING_PUBLIC', keys, now)
        insertWorkAuditLog(sqlite, {
          action: 'WORK_UNPUBLISH',
          actorUserId,
          id: randomUUID(),
          result: 'SUCCESS',
          workId,
        }, now)
      })()
    }
    catch {
      if (!holdsOperationLease(sqlite, lease)) {
        return {
          operation: operationDto(requireOperation(sqlite, operationId)),
          work: workState(requireWork(sqlite, workId)),
        }
      }
      failOperation(
        sqlite,
        operation.id,
        'COMMITTING',
        'UNPUBLICATION_COMMIT_FAILED',
        [],
        actorUserId,
        now,
      )
      releaseOperationLease(sqlite, lease, now)
    }
    if (requireOperation(sqlite, operation.id).status !== 'FAILED') {
      if (keys.length === 0) {
        updateOperation(sqlite, operation.id, 'DONE', [], now)
        sqlite.prepare(`
          UPDATE publication_operations
          SET completed_at = ?, lease_owner = NULL, lease_expires_at = NULL
          WHERE id = ?
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
        releaseOperationLease(sqlite, lease, now)
      }
    }
  }
  work = requireWork(sqlite, workId)
  return {
    operation: operationDto(requireOperation(sqlite, operation.id)),
    work: workState(work),
  }
}

function workOperationTypeOf(
  sqlite: Database.Database,
  operationId: string,
) {
  return findWorkOperationType(sqlite, operationId)
}

function recoveryActorId(sqlite: Database.Database) {
  return findRecoveryActorId(sqlite)
}

registerOperationResumer({
  table: 'publication_operations',
  matches: (sqlite, operationId) =>
    workOperationTypeOf(sqlite, operationId) === 'PUBLISH',
  failure: () => ({
    stage: 'GENERATING_PUBLIC',
    code: 'PUBLICATION_INTERRUPTED',
  }),
  resume: async (sqlite, storage, operationId, now) => {
    const actorUserId = recoveryActorId(sqlite)
    if (!actorUserId) {
      throw new Error('No auditable recovery identity is available.')
    }
    const result = await runWorkPublication(
      sqlite,
      storage,
      operationId,
      actorUserId,
      now,
    )
    if (
      result.operation.status !== 'DONE'
      && result.operation.status !== 'FAILED'
    ) {
      throw new Error('Work publication did not reach a terminal state.')
    }
  },
})

registerOperationResumer({
  table: 'publication_operations',
  matches: (sqlite, operationId) =>
    workOperationTypeOf(sqlite, operationId) === 'UNPUBLISH',
  failure: () => ({
    stage: 'CLEANING_PUBLIC',
    code: 'UNPUBLICATION_INTERRUPTED',
  }),
  resume: async (sqlite, storage, operationId, now) => {
    const actorUserId = recoveryActorId(sqlite)
    if (!actorUserId) {
      throw new Error('No auditable recovery identity is available.')
    }
    const result = await runWorkUnpublication(
      sqlite,
      storage,
      operationId,
      actorUserId,
      now,
    )
    if (
      result.operation.status !== 'DONE'
      && result.operation.status !== 'FAILED'
    ) {
      throw new Error('Work unpublication did not reach a terminal state.')
    }
  },
})

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
  return findLatestOperations(sqlite, entityType, entityIds).map(operationDto)
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
    throw new ServiceError(409, 'CONFLICT', 'Publication cleanup is not retryable.', 'OPERATION_NOT_RETRYABLE')
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

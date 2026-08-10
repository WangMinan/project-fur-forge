import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type Database from 'better-sqlite3'
import { publicationOperationDtoSchema } from '../../../shared/schemas/publication'
import type {
  PublicationFailureStage,
  PublicationOperationDto,
  PublicationOperationStatus,
} from '../../../shared/types/contracts'
import type { MediaStorage } from '../media-storage'
import { getPublicMediaCache } from '../public-media-cache'
import {
  completeOperation,
  deletePublicVariant,
  findPublicationOperation,
  findRecoveryActorId,
  markOperationFailed,
  markVariantsCleanupPending,
  setOperationCleanupKeys,
  setOperationEdgePurgeManifest,
  updateOperationStatus,
} from '../repository/publication-repository'
import type { OperationRow } from '../repository/publication-repository'
import {
  findDoneReturnPhotoOperation,
  findReturnPhotoOperationType,
  findReturnPhotoPublicKeys,
  hasActiveReturnPhotoOperation,
  insertReturnPhotoAuditLog,
  insertReturnPhotoOperation,
  listReturnPhotosForCharacter,
  publishReturnPhotoRow,
  unpublishReturnPhotoRow,
} from '../repository/return-photo-repository'
import {
  assertOperationLease,
  claimOperationLease,
  heartbeatOperationLease,
  holdsOperationLease,
  releaseOperationLease,
} from '../repository/operation-lease'
import type { OperationLease } from '../repository/operation-lease'
import { registerOperationResumer } from './operation-recovery'
import { ServiceError } from '../service-error'
import { generateReturnWallVariants } from '../recipe/return-display-recipe'
import {
  edgePurgeUrlsForObjectKeys,
  parseEdgePurgeUrls,
  runOperationEdgePurge,
} from './public-media-purge'
import {
  checkReturnPhotoPublication,
  deleteEmptyReturnCharacter,
  deleteReturnPhotoDraft,
  requireReturnCharacter,
  requireReturnPhoto,
} from '../service/return-photo'

/**
 * T36 返图发布 / 下架 runner。
 *
 * 复用 publication_operations 及其 attempt / lease / heartbeat /
 * recovery_reason / 提交 CAS，只用 entity_type='RETURN_PHOTO' 区分，
 * 不新建第二套任务状态机。
 *
 * 与作品发布的关键差异：返图没有水印阶段，因此状态序列是
 * GENERATING_PUBLIC → VERIFYING_PUBLIC → COMMITTING → DONE，
 * 且本文件不 import 任何 watermark 模块——活动 profile 切换
 * 在代码层面就不可能影响返图。
 */

function parseCleanupKeys(value: string) {
  const parsed = JSON.parse(value) as unknown
  if (
    !Array.isArray(parsed)
    || parsed.some(key => typeof key !== 'string' || key.length === 0)
  ) {
    throw new Error('Return publication cleanup manifest is invalid.')
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
    edgePurgeStatus: row.edgePurgeStatus,
    edgePurgeFailureReason: row.edgePurgeReason,
    edgePurgeFileCount: parseEdgePurgeUrls(row.edgePurgeUrlsJson).length,
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

function returnPhotoState(row: ReturnType<typeof requireReturnPhoto>) {
  return {
    returnPhotoId: row.id,
    version: row.version,
    publicationStatus: row.publicationStatus,
  }
}

function createOperation(
  sqlite: Database.Database,
  returnPhotoId: string,
  requestedVersion: number,
  type: 'PUBLISH' | 'UNPUBLISH',
  now: number,
) {
  if (hasActiveReturnPhotoOperation(sqlite, returnPhotoId)) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'A publication operation is already active.',
      'ACTIVE_OPERATION_EXISTS',
    )
  }
  const id = randomUUID()
  insertReturnPhotoOperation(sqlite, {
    id,
    requestedVersion,
    returnPhotoId,
    status: type === 'PUBLISH' ? 'GENERATING_PUBLIC' : 'COMMITTING',
    type,
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
    insertReturnPhotoAuditLog(sqlite, {
      action: 'RETURN_PHOTO_PUBLICATION',
      actorUserId,
      id: randomUUID(),
      result: 'FAILURE',
      returnPhotoId: requireOperation(sqlite, id).entityId,
    }, now)
  })()
}

/** 长 OSS 操作前后更新心跳；失去 lease 立即停止，不覆盖接管者的结果。 */
function requireReturnLease(
  sqlite: Database.Database,
  lease: OperationLease,
) {
  if (!heartbeatOperationLease(sqlite, lease)) {
    throw new Error('Return photo publication lease was lost.')
  }
}

function newlyCreatedKeys(
  sqlite: Database.Database,
  returnPhotoId: string,
  before: ReadonlySet<string>,
) {
  return findReturnPhotoPublicKeys(sqlite, returnPhotoId)
    .filter(key => !before.has(key))
}

/**
 * 按精确 Object Key 清单删除公开对象。
 * 每删掉一个就立刻缩短清单，因此重启后从残余清单继续即可，不会重复删除。
 */
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
  heartbeat?: () => void,
) {
  const operation = requireOperation(sqlite, operationId)
  if (operation.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  let remaining = parseCleanupKeys(operation.cleanupObjectKeysJson)
  if (
    remaining.length === 0
    && (
      restorePublishFailure
      || operation.operationType !== 'UNPUBLISH'
      || operation.edgePurgeStatus === 'NOT_REQUIRED'
      || operation.edgePurgeStatus === 'COMPLETE'
    )
  ) {
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
    const current = requireOperation(sqlite, operationId)
    if (current.operationType === 'UNPUBLISH') {
      const edgeFailure = await runOperationEdgePurge(
        sqlite,
        getPublicMediaCache(),
        operationId,
        now,
        heartbeat ? { heartbeat } : {},
      )
      if (edgeFailure) {
        failOperation(
          sqlite,
          operationId,
          'CLEANING_PUBLIC',
          edgeFailure,
          [],
          actorUserId,
          now,
        )
        return requireOperation(sqlite, operationId)
      }
    }
    completeOperation(sqlite, operationId, now)
  }
  return requireOperation(sqlite, operationId)
}

export async function publishReturnPhoto(
  sqlite: Database.Database,
  storage: MediaStorage,
  returnPhotoId: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  const photo = requireReturnPhoto(sqlite, returnPhotoId)
  const repeated = findDoneReturnPhotoOperation(
    sqlite,
    returnPhotoId,
    expectedVersion,
    'PUBLISH',
  )
  // 幂等：同一版本重复发布请求直接回放既有终态，不产生重复公开对象。
  if (photo.publicationStatus === 'published' && repeated) {
    return {
      operation: operationDto(requireOperation(sqlite, repeated.id)),
      returnPhoto: returnPhotoState(photo),
    }
  }
  if (
    photo.version === expectedVersion
    && photo.publicationStatus !== 'published'
    && !checkReturnPhotoPublication(sqlite, returnPhotoId).canPublish
  ) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resolve publication blockers before publishing.',
      'RETURN_PHOTO_PUBLICATION_BLOCKED',
    )
  }
  const operation = createOperation(
    sqlite,
    returnPhotoId,
    expectedVersion,
    'PUBLISH',
    now,
  )
  return runReturnPhotoPublication(
    sqlite,
    storage,
    operation.id,
    actorUserId,
    now,
  )
}

/**
 * 发布序列：固化版本 → 生成缺失无水印变体 → 验证公开对象 →
 * 原子切换返图状态 → 写审计。
 *
 * 业务提交与 operation 置 DONE 在同一事务内，因此不存在
 * “已提交但 operation 仍非终态”的窗口；进程被杀只会回滚到提交前，
 * 恢复路径就是在新 attempt 下重跑同一序列。公开变体按对象 Key 幂等，
 * 重复生成不会产生半套 SourceSet。
 */
async function runReturnPhotoPublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now: number,
) {
  const operation = requireOperation(sqlite, operationId)
  const returnPhotoId = operation.entityId
  const expectedVersion = operation.requestedVersion
  let photo = requireReturnPhoto(sqlite, returnPhotoId)
  const lease = claimOperationLease(
    sqlite,
    'publication_operations',
    operationId,
    now,
  )
  if (!lease) {
    return {
      operation: operationDto(requireOperation(sqlite, operationId)),
      returnPhoto: returnPhotoState(photo),
    }
  }
  const before = new Set(findReturnPhotoPublicKeys(sqlite, returnPhotoId, true))
  let stage: PublicationFailureStage = 'VALIDATING'
  let failureCode = 'RETURN_PUBLICATION_VALIDATION_FAILED'
  try {
    if (
      photo.version !== expectedVersion
      || photo.publicationStatus === 'published'
    ) {
      throw new Error('Return publication version conflict.')
    }
    if (!checkReturnPhotoPublication(sqlite, returnPhotoId).canPublish) {
      throw new Error('Return publication validation failed.')
    }
    if (photo.assetId === null) {
      throw new Error('Return publication has no image.')
    }

    stage = 'GENERATING_PUBLIC'
    failureCode = 'PUBLIC_MEDIA_GENERATION_FAILED'
    updateOperation(sqlite, operationId, 'GENERATING_PUBLIC', [], now)
    requireReturnLease(sqlite, lease)
    try {
      await generateReturnWallVariants(sqlite, storage, photo.assetId, now)
    }
    catch {
      // 一次有界重试吸收 OSS 冷读/瞬时失败，与作品发布一致。
      await delay(1_000)
      await generateReturnWallVariants(sqlite, storage, photo.assetId, now)
    }
    requireReturnLease(sqlite, lease)

    const generatedKeys = newlyCreatedKeys(sqlite, returnPhotoId, before)
    stage = 'VERIFYING_PUBLIC'
    failureCode = 'PUBLIC_MEDIA_VERIFICATION_FAILED'
    updateOperation(sqlite, operationId, 'VERIFYING_PUBLIC', generatedKeys, now)
    requireReturnLease(sqlite, lease)
    if (checkReturnPhotoPublication(sqlite, returnPhotoId).missingVariantCount !== 0) {
      throw new Error('Return wall recipe is incomplete.')
    }

    stage = 'COMMITTING'
    failureCode = 'RETURN_PUBLICATION_COMMIT_FAILED'
    updateOperation(sqlite, operationId, 'COMMITTING', generatedKeys, now)
    sqlite.transaction(() => {
      // lease CAS 与返图版本 CAS 同事务。
      assertOperationLease(sqlite, lease)
      const updated = publishReturnPhotoRow(
        sqlite,
        returnPhotoId,
        expectedVersion,
        now,
      )
      if (updated !== 1) {
        throw new Error('Return publication version changed during generation.')
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
        throw new Error('Return publication commit lost its lease.')
      }
      insertReturnPhotoAuditLog(sqlite, {
        action: 'RETURN_PHOTO_PUBLISH',
        actorUserId,
        id: randomUUID(),
        result: 'SUCCESS',
        returnPhotoId,
      }, now)
    })()
  }
  catch {
    if (!holdsOperationLease(sqlite, lease)) {
      // lease 已被接管：不清理对象、不改状态，避免删掉接管者的新对象。
      return {
        operation: operationDto(requireOperation(sqlite, operationId)),
        returnPhoto: returnPhotoState(requireReturnPhoto(sqlite, returnPhotoId)),
      }
    }
    const cleanupKeys = newlyCreatedKeys(sqlite, returnPhotoId, before)
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
  photo = requireReturnPhoto(sqlite, returnPhotoId)
  return {
    operation: operationDto(requireOperation(sqlite, operationId)),
    returnPhoto: returnPhotoState(photo),
  }
}

export async function unpublishReturnPhoto(
  sqlite: Database.Database,
  storage: MediaStorage,
  returnPhotoId: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  const photo = requireReturnPhoto(sqlite, returnPhotoId)
  const repeated = findDoneReturnPhotoOperation(
    sqlite,
    returnPhotoId,
    expectedVersion,
    'UNPUBLISH',
  )
  if (photo.publicationStatus === 'unpublished' && repeated) {
    return {
      operation: operationDto(requireOperation(sqlite, repeated.id)),
      returnPhoto: returnPhotoState(photo),
    }
  }
  const operation = createOperation(
    sqlite,
    returnPhotoId,
    expectedVersion,
    'UNPUBLISH',
    now,
  )
  return runReturnPhotoUnpublication(
    sqlite,
    storage,
    operation.id,
    actorUserId,
    now,
  )
}

/**
 * 下架序列：先在事务内撤销公开状态并登记精确清理清单，再逐个删除公开对象。
 * 因此重启后从残余清单继续即可；公开投影在状态撤销那一刻就已经隐藏，
 * 不依赖对象是否已删完。
 */
async function runReturnPhotoUnpublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now: number,
) {
  const started = requireOperation(sqlite, operationId)
  const returnPhotoId = started.entityId
  const expectedVersion = started.requestedVersion
  const photo = requireReturnPhoto(sqlite, returnPhotoId)
  const lease = claimOperationLease(
    sqlite,
    'publication_operations',
    operationId,
    now,
  )
  if (!lease) {
    return {
      operation: operationDto(requireOperation(sqlite, operationId)),
      returnPhoto: returnPhotoState(photo),
    }
  }

  if (
    photo.publicationStatus === 'unpublished'
    && started.status === 'CLEANING_PUBLIC'
  ) {
    // 提交后重启：状态已撤销，从残余 cleanup 清单继续删除。
    const cleaning = requireOperation(sqlite, operationId)
    await cleanOperationKeys(
      sqlite,
      storage,
      operationId,
      cleaning.version,
      actorUserId,
      now,
      undefined,
      () => requireReturnLease(sqlite, lease),
    )
    return {
      operation: operationDto(requireOperation(sqlite, operationId)),
      returnPhoto: returnPhotoState(requireReturnPhoto(sqlite, returnPhotoId)),
    }
  }

  if (
    photo.version !== expectedVersion
    || photo.publicationStatus !== 'published'
  ) {
    failOperation(
      sqlite,
      operationId,
      'VALIDATING',
      'RETURN_UNPUBLICATION_VALIDATION_FAILED',
      [],
      actorUserId,
      now,
    )
    releaseOperationLease(sqlite, lease, now)
  }
  else {
    const keys = findReturnPhotoPublicKeys(sqlite, returnPhotoId)
    const edgeUrls = edgePurgeUrlsForObjectKeys(getPublicMediaCache(), keys)
    try {
      sqlite.transaction(() => {
        assertOperationLease(sqlite, lease)
        const updated = unpublishReturnPhotoRow(
          sqlite,
          returnPhotoId,
          expectedVersion,
          now,
        )
        if (updated !== 1) {
          throw new Error('Return unpublication version changed.')
        }
        markVariantsCleanupPending(sqlite, keys, now)
        updateOperation(sqlite, operationId, 'CLEANING_PUBLIC', keys, now)
        setOperationEdgePurgeManifest(
          sqlite,
          operationId,
          edgeUrls,
          now,
        )
        insertReturnPhotoAuditLog(sqlite, {
          action: 'RETURN_PHOTO_UNPUBLISH',
          actorUserId,
          id: randomUUID(),
          result: 'SUCCESS',
          returnPhotoId,
        }, now)
      })()
    }
    catch {
      if (!holdsOperationLease(sqlite, lease)) {
        return {
          operation: operationDto(requireOperation(sqlite, operationId)),
          returnPhoto: returnPhotoState(requireReturnPhoto(sqlite, returnPhotoId)),
        }
      }
      failOperation(
        sqlite,
        operationId,
        'COMMITTING',
        'RETURN_UNPUBLICATION_COMMIT_FAILED',
        [],
        actorUserId,
        now,
      )
      releaseOperationLease(sqlite, lease, now)
    }

    if (requireOperation(sqlite, operationId).status !== 'FAILED') {
      if (keys.length === 0) {
        completeOperation(sqlite, operationId, now)
        releaseOperationLease(sqlite, lease, now)
      }
      else {
        const cleaning = requireOperation(sqlite, operationId)
        await cleanOperationKeys(
          sqlite,
          storage,
          operationId,
          cleaning.version,
          actorUserId,
          now,
          undefined,
          () => requireReturnLease(sqlite, lease),
        )
      }
    }
  }

  return {
    operation: operationDto(requireOperation(sqlite, operationId)),
    returnPhoto: returnPhotoState(requireReturnPhoto(sqlite, returnPhotoId)),
  }
}

/**
 * 删除设定：连带删除它的全部返图。
 *
 * 已发布的返图先走正常下架流程（撤销公开状态 → 按精确清单删除公开对象），
 * 因此不会留下孤立的公开图片；随后删除返图记录，最后删除设定本身。
 * 私有永久原图保留，`assets` 不参与本次删除。
 *
 * 任何一张返图下架失败就整体停下并抛错：宁可留下一个还能重试的设定，
 * 也不要删掉记录却留着公开可读的图片。
 */
export async function deleteReturnCharacterCascade(
  sqlite: Database.Database,
  storage: MediaStorage,
  characterId: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  const character = requireReturnCharacter(sqlite, characterId)
  if (character.version !== expectedVersion) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Resource version is stale.',
      'VERSION_CONFLICT',
    )
  }

  for (const photo of listReturnPhotosForCharacter(sqlite, characterId)) {
    let current = requireReturnPhoto(sqlite, photo.id)
    if (current.publicationStatus === 'published') {
      const result = await unpublishReturnPhoto(
        sqlite,
        storage,
        current.id,
        current.version,
        actorUserId,
        now,
      )
      if (result.operation.status !== 'DONE') {
        throw new ServiceError(
          409,
          'CONFLICT',
          'Return photo could not be unpublished before deletion.',
          'RETURN_PHOTO_PUBLICATION_BLOCKED',
        )
      }
      current = requireReturnPhoto(sqlite, current.id)
    }
    deleteReturnPhotoDraft(sqlite, current.id, current.version, now)
  }

  // 返图删除会 bump 设定的 updated_at，因此重新读取版本再删。
  const latest = requireReturnCharacter(sqlite, characterId)
  return deleteEmptyReturnCharacter(sqlite, characterId, latest.version)
}

/** 清理失败后的重试入口：只重放精确 Object Key 清单。 */
export async function retryReturnPhotoCleanup(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  const operation = requireOperation(sqlite, operationId)
  // 只接受返图 operation：作品/Hero 的清理各有自己的入口。
  if (!findReturnPhotoOperationType(sqlite, operationId)) {
    throw new ServiceError(404, 'NOT_FOUND', 'Publication operation was not found.')
  }
  if (
    operation.status !== 'FAILED'
    || operation.failureStage !== 'CLEANING_PUBLIC'
  ) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Publication cleanup is not retryable.',
      'OPERATION_NOT_RETRYABLE',
    )
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
          code: operation.internalErrorCode ?? 'RETURN_PUBLICATION_FAILED',
        }
      : undefined,
  ))
}

function recoveryActorId(sqlite: Database.Database) {
  return findRecoveryActorId(sqlite)
}

registerOperationResumer({
  table: 'publication_operations',
  matches: (sqlite, operationId) =>
    findReturnPhotoOperationType(sqlite, operationId) === 'PUBLISH',
  failure: () => ({
    stage: 'GENERATING_PUBLIC',
    code: 'RETURN_PUBLICATION_INTERRUPTED',
  }),
  resume: async (sqlite, storage, operationId, now) => {
    const actorUserId = recoveryActorId(sqlite)
    if (!actorUserId) {
      throw new Error('No auditable recovery identity is available.')
    }
    const result = await runReturnPhotoPublication(
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
      throw new Error('Return photo publication did not reach a terminal state.')
    }
  },
})

registerOperationResumer({
  table: 'publication_operations',
  matches: (sqlite, operationId) =>
    findReturnPhotoOperationType(sqlite, operationId) === 'UNPUBLISH',
  failure: () => ({
    stage: 'CLEANING_PUBLIC',
    code: 'RETURN_UNPUBLICATION_INTERRUPTED',
  }),
  resume: async (sqlite, storage, operationId, now) => {
    const actorUserId = recoveryActorId(sqlite)
    if (!actorUserId) {
      throw new Error('No auditable recovery identity is available.')
    }
    const result = await runReturnPhotoUnpublication(
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
      throw new Error('Return photo unpublication did not reach a terminal state.')
    }
  },
})

import type Database from 'better-sqlite3'
import type {
  EdgePurgeStatus,
  PublicationFailureStage,
  PublicationOperationStatus,
} from '../../../shared/types/contracts'

/**
 * T34-F4 发布仓储层。
 *
 * 只有 SQL、行映射和条件更新。**不含** 业务规则、OSS 副作用或状态机决策。
 * publication_operations 的 lease/heartbeat 列由 operation-lease 负责，
 * 这里只做发布语义相关的读写。
 *
 * SQL 文本与列别名与拆分前保持一致：F4 是边界重排，不是行为变更。
 */

export interface OperationRow {
  cleanupObjectKeysJson: string
  completedAt: number | null
  edgePurgeCheckedAt: number | null
  edgePurgeReason: string | null
  edgePurgeStatus: EdgePurgeStatus
  edgePurgeTaskId: string | null
  edgePurgeUrlsJson: string
  entityId: string
  entityType: 'HOME' | 'RETURN_PHOTO' | 'WORK'
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

export interface WorkState {
  adoptionMethod: string | null
  businessStatus: string | null
  characterName: string
  eventName: string | null
  eventTime: string | null
  id: string
  ownerDisplay: string
  priceAmountMinor: number | null
  priceCurrency: string | null
  publicationStatus: 'draft' | 'published' | 'unpublished'
  purpose: 'commission' | 'adoption' | 'showcase'
  slug: string
  species: string
  suitType: string
  version: number
}

export interface PublicationAsset {
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

export const operationColumns = `
    id, operation_type AS operationType, entity_type AS entityType,
    entity_id AS entityId,
    requested_version AS requestedVersion, status,
    cleanup_object_keys_json AS cleanupObjectKeysJson,
    edge_purge_urls_json AS edgePurgeUrlsJson,
    edge_purge_task_id AS edgePurgeTaskId,
    edge_purge_status AS edgePurgeStatus,
    edge_purge_reason AS edgePurgeReason,
    edge_purge_checked_at AS edgePurgeCheckedAt,
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
    event_name AS eventName,
    event_time AS eventTime,
    price_amount_minor AS priceAmountMinor,
    price_currency AS priceCurrency,
    owner_display AS ownerDisplay,
    publication_status AS publicationStatus
  FROM works
`

export function findPublicationOperation(
  sqlite: Database.Database,
  id: string,
) {
  return sqlite.prepare(`${selectOperation} WHERE id = ?`)
    .get(id) as OperationRow | undefined
}

export function hasActivePublicationOperation(
  sqlite: Database.Database,
  entityType: OperationRow['entityType'],
  entityId: string,
) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM publication_operations
    WHERE entity_type = ? AND entity_id = ?
      AND status NOT IN ('FAILED', 'DONE')
    LIMIT 1
  `).pluck().get(entityType, entityId))
}

export function insertPublicationOperation(
  sqlite: Database.Database,
  input: {
    entityId: string
    entityType: OperationRow['entityType']
    id: string
    operationType: OperationRow['operationType']
    requestedVersion: number
    status: PublicationOperationStatus
  },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO publication_operations (
      id, operation_type, entity_type, entity_id, requested_version,
      status, started_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.operationType,
    input.entityType,
    input.entityId,
    input.requestedVersion,
    input.status,
    now,
    now,
  )
}

export function findWorkState(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectWork} WHERE id = ?`)
    .get(id) as WorkState | undefined
}

export function findLatestOperations(
  sqlite: Database.Database,
  entityType: 'HOME' | 'WORK',
  entityIds: readonly string[],
) {
  const ids = [...new Set(entityIds)]
  if (ids.length === 0) {
    return []
  }
  const placeholders = ids.map(() => '?').join(', ')
  return sqlite.prepare(`
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
}

export function findDoneOperation(
  sqlite: Database.Database,
  workId: string,
  requestedVersion: number,
  operationType: 'PUBLISH' | 'UNPUBLISH',
) {
  return sqlite.prepare(`
    ${selectOperation}
    WHERE entity_type = 'WORK' AND entity_id = ?
      AND requested_version = ? AND operation_type = ? AND status = 'DONE'
    ORDER BY started_at DESC LIMIT 1
  `).get(workId, requestedVersion, operationType) as OperationRow | undefined
}

export function hasActiveWorkOperation(
  sqlite: Database.Database,
  workId: string,
) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM publication_operations
    WHERE entity_type = 'WORK' AND entity_id = ?
      AND status NOT IN ('FAILED', 'DONE')
    LIMIT 1
  `).pluck().get(workId))
}

export function insertWorkOperation(
  sqlite: Database.Database,
  input: {
    id: string
    requestedVersion: number
    status: PublicationOperationStatus
    type: 'PUBLISH' | 'UNPUBLISH'
    workId: string
  },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO publication_operations (
      id, operation_type, entity_type, entity_id, requested_version,
      status, started_at, updated_at
    ) VALUES (?, ?, 'WORK', ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.type,
    input.workId,
    input.requestedVersion,
    input.status,
    now,
    now,
  )
}

export function updateOperationStatus(
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

export function resetFailedPublicationOperation(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  status: PublicationOperationStatus,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE publication_operations
    SET status = ?, failure_stage = NULL,
        internal_error_code = NULL, internal_error_message = NULL,
        cleanup_object_keys_json = '[]', completed_at = NULL,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND status = 'FAILED'
  `).run(status, now, id, expectedVersion).changes
}

export function markOperationFailed(
  sqlite: Database.Database,
  id: string,
  input: {
    cleanupKeys: readonly string[]
    code: string
    stage: PublicationFailureStage
  },
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET status = 'FAILED', cleanup_object_keys_json = ?,
        internal_error_code = ?, internal_error_message = ?,
        failure_stage = ?, version = version + 1,
        updated_at = ?, completed_at = ?
    WHERE id = ?
  `).run(
    JSON.stringify(input.cleanupKeys),
    input.code,
    'Publication operation failed.',
    input.stage,
    now,
    now,
    id,
  )
}

export function markVariantsCleanupPending(
  sqlite: Database.Database,
  objectKeys: readonly string[],
  now: number,
) {
  const markVariant = sqlite.prepare(`
    UPDATE asset_variants
    SET status = 'FAILED', internal_error_code = 'PUBLIC_CLEANUP_PENDING',
        version = version + 1, updated_at = ?
    WHERE storage_scope = 'PUBLIC' AND object_key = ?
  `)
  objectKeys.forEach(key => markVariant.run(now, key))
}

export function setOperationCleanupKeys(
  sqlite: Database.Database,
  id: string,
  cleanupKeys: readonly string[],
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET cleanup_object_keys_json = ?, version = version + 1,
        updated_at = ? WHERE id = ?
  `).run(JSON.stringify(cleanupKeys), now, id)
}

export function setOperationEdgePurgeManifest(
  sqlite: Database.Database,
  id: string,
  urls: readonly string[],
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET edge_purge_urls_json = ?, edge_purge_task_id = NULL,
        edge_purge_status = ?, edge_purge_reason = NULL,
        edge_purge_checked_at = NULL, version = version + 1,
        updated_at = ?
    WHERE id = ?
  `).run(
    JSON.stringify(urls),
    urls.length > 0 ? 'PENDING' : 'NOT_REQUIRED',
    now,
    id,
  )
}

export function markOperationEdgePurgeSubmitted(
  sqlite: Database.Database,
  id: string,
  taskId: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET status = 'CLEANING_PUBLIC', edge_purge_task_id = ?,
        edge_purge_status = 'PURGING', edge_purge_reason = NULL,
        edge_purge_checked_at = ?, internal_error_code = NULL,
        internal_error_message = NULL, failure_stage = NULL,
        completed_at = NULL, version = version + 1, updated_at = ?
    WHERE id = ?
  `).run(taskId, now, now, id)
}

export function markOperationEdgePurgeChecked(
  sqlite: Database.Database,
  id: string,
  input: {
    reason?: string
    status: 'COMPLETE' | 'FAILED' | 'PURGING'
  },
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET edge_purge_status = ?, edge_purge_reason = ?,
        edge_purge_checked_at = ?, version = version + 1,
        updated_at = ?
    WHERE id = ?
  `).run(input.status, input.reason ?? null, now, now, id)
}

export function resetOperationEdgePurge(
  sqlite: Database.Database,
  id: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET status = 'CLEANING_PUBLIC', edge_purge_task_id = NULL,
        edge_purge_status = 'PENDING', edge_purge_reason = NULL,
        edge_purge_checked_at = NULL, internal_error_code = NULL,
        internal_error_message = NULL, failure_stage = NULL,
        completed_at = NULL, version = version + 1, updated_at = ?
    WHERE id = ? AND edge_purge_urls_json != '[]'
  `).run(now, id)
}

export function deletePublicVariant(
  sqlite: Database.Database,
  objectKey: string,
) {
  sqlite.prepare(`
    DELETE FROM asset_variants
    WHERE storage_scope = 'PUBLIC' AND object_key = ?
  `).run(objectKey)
}

export function completeOperation(
  sqlite: Database.Database,
  id: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET status = 'DONE', cleanup_object_keys_json = '[]',
        internal_error_code = NULL, internal_error_message = NULL,
        failure_stage = NULL, lease_owner = NULL, lease_expires_at = NULL,
        version = version + 1, updated_at = ?, completed_at = ?
    WHERE id = ?
  `).run(now, now, id)
}

export function findWorkMediaAssets(
  sqlite: Database.Database,
  workId: string,
) {
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

export function findWorkPublicKeys(
  sqlite: Database.Database,
  workId: string,
  readyOnly = false,
) {
  return sqlite.prepare(`
    SELECT variant.object_key
    FROM asset_variants AS variant
    JOIN work_assets AS relation ON relation.asset_id = variant.asset_id
    WHERE relation.work_id = ? AND variant.storage_scope = 'PUBLIC'
      ${readyOnly ? `AND variant.status = 'READY'` : ''}
  `).pluck().all(workId) as string[]
}

/** 已就绪公开变体的格式集合，用于判定配方完整性。 */
export function findReadyVariantFormats(
  sqlite: Database.Database,
  input: {
    assetId: string
    configDigest: string
    logoDigest: string
    opacityPercent: number
    profileId: string
    recipeVersion: string
    role: string
    scalePercent: number
    usage: string
    width: number
  },
) {
  return sqlite.prepare(`
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
  `).pluck().all(
    input.assetId,
    input.role,
    input.usage,
    input.width,
    input.recipeVersion,
    input.profileId,
    input.configDigest,
    input.logoDigest,
    input.opacityPercent,
    input.scalePercent,
  ) as string[]
}

/** 公开状态 CAS：只有版本与当前发布状态都匹配才切换。 */
export function publishWorkRow(
  sqlite: Database.Database,
  workId: string,
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE works
    SET publication_status = 'published', published_at = ?,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND publication_status != 'published'
  `).run(now, now, workId, expectedVersion).changes
}

export function unpublishWorkRow(
  sqlite: Database.Database,
  workId: string,
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE works
    SET publication_status = 'unpublished', published_at = NULL,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND publication_status = 'published'
  `).run(now, workId, expectedVersion).changes
}

export function hasEnabledHeroSlideForWork(
  sqlite: Database.Database,
  workId: string,
) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM site_hero_slides
    WHERE linked_work_id = ? AND enabled = 1 LIMIT 1
  `).pluck().get(workId))
}

export function insertWorkAuditLog(
  sqlite: Database.Database,
  input: {
    action: string
    actorUserId: string
    id: string
    result: 'SUCCESS' | 'FAILURE'
    workId: string
  },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, result, created_at
    ) VALUES (?, ?, ?, 'WORK', ?, ?, ?)
  `).run(
    input.id,
    input.actorUserId,
    input.action,
    input.workId,
    input.result,
    now,
  )
}

export function findWorkOperationType(
  sqlite: Database.Database,
  operationId: string,
) {
  return sqlite.prepare(`
    SELECT operation_type FROM publication_operations
    WHERE id = ? AND entity_type = 'WORK'
  `).pluck().get(operationId) as string | undefined
}

/** 恢复身份：没有交互式管理员时使用数据库中的唯一管理员。 */
export function findRecoveryActorId(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT id FROM users ORDER BY created_at LIMIT 1
  `).pluck().get() as string | undefined ?? null
}

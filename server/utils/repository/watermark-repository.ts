import type Database from 'better-sqlite3'
import type { WatermarkOperationStatus } from '../../../shared/types/contracts'

/**
 * T34-F4 水印仓储层。
 *
 * 只有 SQL、行映射和条件更新。**不含** 业务规则、OSS 副作用或 profile
 * 状态机决策——那些分别属于 watermark-profile（service）与
 * watermark-branding（apply runner）。
 *
 * SQL 文本与列别名与拆分前保持一致：F4 是边界重排，不是行为变更。
 */

export interface WatermarkOperationRow {
  affectedWorkCount: number
  brandingVersion: number
  cleanupObjectKeysJson: string
  completedAt: number | null
  failureStage: string | null
  generatedVariantCount: number
  id: string
  internalErrorCode: string | null
  operationType: 'WATERMARK_PREVIEW' | 'WATERMARK_REBUILD'
  previewManifestJson: string
  profileId: string
  startedAt: number
  status: WatermarkOperationStatus
  targetVariantCount: number
  updatedAt: number
  verifiedVariantCount: number
  version: number
}

export interface WatermarkTargetRow {
  assetId: string
  hasPrimaryStudioPhoto: number
  primary: number
  role: string
}

export interface WatermarkCandidateRow {
  assetId: string
  createdAt: number
  height: number
  mimeType: string
  sha256: string
  status: string
  version: number
  width: number
}

const selectOperation = `
  SELECT
    id, operation_type AS operationType, profile_id AS profileId,
    branding_version AS brandingVersion, status,
    affected_work_count AS affectedWorkCount,
    target_variant_count AS targetVariantCount,
    generated_variant_count AS generatedVariantCount,
    verified_variant_count AS verifiedVariantCount,
    preview_manifest_json AS previewManifestJson,
    cleanup_object_keys_json AS cleanupObjectKeysJson,
    internal_error_code AS internalErrorCode,
    failure_stage AS failureStage, version,
    started_at AS startedAt, updated_at AS updatedAt,
    completed_at AS completedAt
  FROM watermark_operations
`

export function findWatermarkOperation(
  sqlite: Database.Database,
  id: string,
) {
  return sqlite.prepare(`${selectOperation} WHERE id = ?`)
    .get(id) as WatermarkOperationRow | undefined
}

export function findDoneRebuildForProfile(
  sqlite: Database.Database,
  profileId: string,
) {
  return sqlite.prepare(`
    ${selectOperation}
    WHERE operation_type = 'WATERMARK_REBUILD' AND profile_id = ?
      AND status = 'DONE' ORDER BY started_at DESC LIMIT 1
  `).get(profileId) as WatermarkOperationRow | undefined
}

export function hasActiveWatermarkOperation(sqlite: Database.Database) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM watermark_operations
    WHERE status NOT IN ('FAILED', 'DONE') LIMIT 1
  `).pluck().get())
}

export function insertWatermarkOperation(
  sqlite: Database.Database,
  input: {
    brandingVersion: number
    id: string
    operationType: WatermarkOperationRow['operationType']
    profileId: string
  },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO watermark_operations (
      id, operation_type, profile_id, branding_version,
      status, started_at, updated_at
    ) VALUES (?, ?, ?, ?, 'GENERATING_PUBLIC', ?, ?)
  `).run(
    input.id,
    input.operationType,
    input.profileId,
    input.brandingVersion,
    now,
    now,
  )
}

/** site_branding 版本 CAS：返回受影响行数供调用方判定冲突。 */
export function claimBrandingOperation(
  sqlite: Database.Database,
  operationId: string,
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE site_branding
    SET last_watermark_operation_id = ?, version = version + 1,
        updated_at = ?
    WHERE id = 'site' AND version = ?
  `).run(operationId, now, expectedVersion).changes
}

export function updateWatermarkOperationRow(
  sqlite: Database.Database,
  id: string,
  status: WatermarkOperationStatus,
  fields: {
    cleanupJson?: string | null
    generated?: number | null
    previewJson?: string | null
    target?: number | null
    verified?: number | null
  },
  now: number,
) {
  sqlite.prepare(`
    UPDATE watermark_operations
    SET status = ?,
        target_variant_count = COALESCE(?, target_variant_count),
        generated_variant_count = COALESCE(?, generated_variant_count),
        verified_variant_count = COALESCE(?, verified_variant_count),
        preview_manifest_json = COALESCE(?, preview_manifest_json),
        cleanup_object_keys_json = COALESCE(?, cleanup_object_keys_json),
        internal_error_code = NULL, failure_stage = NULL,
        version = version + 1, updated_at = ?
    WHERE id = ?
  `).run(
    status,
    fields.target ?? null,
    fields.generated ?? null,
    fields.verified ?? null,
    fields.previewJson ?? null,
    fields.cleanupJson ?? null,
    now,
    id,
  )
}

export function markWatermarkOperationFailed(
  sqlite: Database.Database,
  id: string,
  input: { cleanupJson: string, code: string, stage: string },
  now: number,
) {
  sqlite.prepare(`
    UPDATE watermark_operations
    SET status = 'FAILED', cleanup_object_keys_json = ?,
        internal_error_code = ?, failure_stage = ?,
        version = version + 1, updated_at = ?, completed_at = ?
  WHERE id = ?
  `).run(input.cleanupJson, input.code, input.stage, now, now, id)
}

export function failApplyingProfile(
  sqlite: Database.Database,
  profileId: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE watermark_profiles
    SET status = 'FAILED', version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'APPLYING'
  `).run(now, profileId)
}

export function setWatermarkCleanupJson(
  sqlite: Database.Database,
  id: string,
  cleanupJson: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE watermark_operations
    SET cleanup_object_keys_json = ?, version = version + 1,
        updated_at = ? WHERE id = ?
  `).run(cleanupJson, now, id)
}

export function completeWatermarkOperation(
  sqlite: Database.Database,
  id: string,
  now: number,
  lease?: { attempt: number, owner: string },
) {
  return sqlite.prepare(`
    UPDATE watermark_operations
    SET status = 'DONE', lease_owner = NULL, lease_expires_at = NULL,
        version = version + 1, updated_at = ?, completed_at = ?
    WHERE id = ?${lease ? ' AND lease_owner = ? AND attempt = ?' : ''}
  `).run(
    ...(lease
      ? [now, now, id, lease.owner, lease.attempt]
      : [now, now, id]),
  ).changes
}

export function finishWatermarkRebuild(
  sqlite: Database.Database,
  id: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE watermark_operations
    SET status = 'DONE', cleanup_object_keys_json = '[]',
        lease_owner = NULL, lease_expires_at = NULL,
        version = version + 1, updated_at = ?, completed_at = ?
    WHERE id = ?
  `).run(now, now, id)
}

/**
 * 重试前把 FAILED 重新打开为运行态。
 *
 * T34-F5 之后 runner 必须先抢到 lease 才推进，而 lease 不会授予终态记录；
 * 因此重试必须先离开 FAILED，否则 runRebuild 会静默什么都不做。
 * 与其它持久 operation 的重试处理一致。
 */
export function reopenFailedWatermarkOperation(
  sqlite: Database.Database,
  id: string,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE watermark_operations
    SET status = 'GENERATING_PUBLIC', internal_error_code = NULL,
        failure_stage = NULL, completed_at = NULL,
        lease_owner = NULL, lease_expires_at = NULL,
        version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'FAILED'
  `).run(now, id).changes
}

/**
 * 从 FAILED 重试成功后收尾：必须同时清掉 internal_error_code 与 failure_stage，
 * 否则 watermark_operations_failure_state 约束会拒绝 status='DONE' 的行。
 */
export function resolveFailedWatermarkOperation(
  sqlite: Database.Database,
  id: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE watermark_operations
    SET status = 'DONE', cleanup_object_keys_json = '[]',
        internal_error_code = NULL, failure_stage = NULL,
        lease_owner = NULL, lease_expires_at = NULL,
        version = version + 1, updated_at = ?, completed_at = ?
    WHERE id = ?
  `).run(now, now, id)
}

export function clearPreviewManifests(
  sqlite: Database.Database,
  profileId: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE watermark_operations
    SET preview_manifest_json = '[]', version = version + 1,
        updated_at = ?
    WHERE profile_id = ? AND operation_type = 'WATERMARK_PREVIEW'
  `).run(now, profileId)
}

export function findPreviewManifestJson(
  sqlite: Database.Database,
  profileId: string,
) {
  return sqlite.prepare(`
    SELECT preview_manifest_json FROM watermark_operations
    WHERE profile_id = ? AND operation_type = 'WATERMARK_PREVIEW'
      AND preview_manifest_json != '[]'
  `).pluck().all(profileId) as string[]
}

export function findWatermarkTargets(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT DISTINCT
      asset.id AS assetId, asset.role,
      relation.is_primary AS "primary",
      EXISTS (
        SELECT 1 FROM work_assets AS primary_photo
        WHERE primary_photo.work_id = work.id
          AND primary_photo.role = 'studio_photo'
          AND primary_photo.is_primary = 1
      ) AS hasPrimaryStudioPhoto
    FROM works AS work
    JOIN work_assets AS relation ON relation.work_id = work.id
    JOIN assets AS asset ON asset.id = relation.asset_id
    WHERE work.publication_status = 'published' AND asset.status = 'READY'
      AND relation.role IN ('studio_photo', 'design_sheet', 'adoption_cover')
  `).all() as WatermarkTargetRow[]
}

export function countPublishedWorks(sqlite: Database.Database) {
  return Number(sqlite.prepare(`
    SELECT count(*) FROM works WHERE publication_status = 'published'
  `).pluck().get())
}

export function countSiteDisplayVariants(
  sqlite: Database.Database,
  recipeVersion: string,
) {
  return Number(sqlite.prepare(`
    SELECT count(*) FROM asset_variants
    WHERE storage_scope = 'PUBLIC' AND status = 'READY'
      AND protection_mode = 'none'
      AND recipe_version = ?
  `).pluck().get(recipeVersion))
}

export function findWatermarkCandidates(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT
      id AS assetId, version, status, mime_type AS mimeType,
      width, height, sha256, created_at AS createdAt
    FROM assets
    WHERE role = 'watermark_logo' AND status = 'READY'
    ORDER BY created_at DESC, id
  `).all() as WatermarkCandidateRow[]
}

export function findWatermarkCandidateSource(
  sqlite: Database.Database,
  assetId: string,
) {
  return sqlite.prepare(`
    SELECT
      id AS assetId, private_object_key AS objectKey,
      sha256 AS logoDigest, width, height
    FROM assets
    WHERE id = ? AND role = 'watermark_logo'
      AND status = 'READY' AND mime_type = 'image/png'
  `).get(assetId) as {
    assetId: string
    height: number
    logoDigest: string
    objectKey: string
    width: number
  } | undefined
}

export function findPreviewSample(
  sqlite: Database.Database,
  role: 'design_sheet' | 'studio_photo',
) {
  return sqlite.prepare(`
    SELECT asset.id AS assetId, asset.private_object_key AS privateObjectKey
    FROM assets AS asset
    LEFT JOIN work_assets AS relation ON relation.asset_id = asset.id
    LEFT JOIN works AS work ON work.id = relation.work_id
    WHERE asset.role = ? AND asset.status = 'READY'
    ORDER BY (work.publication_status = 'published') DESC,
             asset.created_at DESC LIMIT 1
  `).get(role) as { assetId: string, privateObjectKey: string } | undefined
}

export function findPublicKeysForOtherProfiles(
  sqlite: Database.Database,
  profileId: string,
) {
  return sqlite.prepare(`
    SELECT object_key FROM asset_variants
    WHERE storage_scope = 'PUBLIC'
      AND protection_mode = 'watermark'
      AND watermark_profile_id IS NOT ?
  `).pluck().all(profileId) as string[]
}

export function findPublicKeysForProfile(
  sqlite: Database.Database,
  profileId: string,
) {
  return sqlite.prepare(`
    SELECT object_key FROM asset_variants
    WHERE storage_scope = 'PUBLIC' AND protection_mode = 'watermark'
      AND watermark_profile_id = ?
  `).pluck().all(profileId) as string[]
}

export function setRebuildCounts(
  sqlite: Database.Database,
  id: string,
  counts: {
    affectedWorkCount: number
    targetVariantCount: number
  },
  now: number,
) {
  sqlite.prepare(`
    UPDATE watermark_operations
    SET affected_work_count = ?, target_variant_count = ?, generated_variant_count = 0,
        verified_variant_count = 0, version = version + 1, updated_at = ?
    WHERE id = ?
  `).run(
    counts.affectedWorkCount,
    counts.targetVariantCount,
    now,
    id,
  )
}

export function retireActiveProfile(
  sqlite: Database.Database,
  profileId: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE watermark_profiles
    SET status = 'RETIRED', version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'ACTIVE'
  `).run(now, profileId)
}

export function activateApplyingProfile(
  sqlite: Database.Database,
  profileId: string,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE watermark_profiles
    SET status = 'ACTIVE', version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'APPLYING'
  `).run(now, profileId).changes
}

export function switchActiveProfile(
  sqlite: Database.Database,
  profileId: string,
  expectedBrandingVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE site_branding
    SET active_watermark_profile_id = ?, draft_watermark_profile_id = NULL,
        version = version + 1, updated_at = ?
    WHERE id = 'site' AND version = ?
  `).run(profileId, now, expectedBrandingVersion).changes
}

export function startApplyingProfile(
  sqlite: Database.Database,
  profileId: string,
  now: number,
  onlyFromFailed = false,
) {
  sqlite.prepare(`
    UPDATE watermark_profiles
    SET status = 'APPLYING', version = version + 1, updated_at = ?
    WHERE id = ? AND status ${onlyFromFailed ? `= 'FAILED'` : `IN ('DRAFT', 'FAILED')`}
  `).run(now, profileId)
}

export function findWatermarkOperationType(
  sqlite: Database.Database,
  operationId: string,
) {
  return sqlite.prepare(`
    SELECT operation_type FROM watermark_operations WHERE id = ?
  `).pluck().get(operationId) as string | undefined
}

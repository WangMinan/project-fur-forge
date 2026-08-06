import type Database from 'better-sqlite3'

/**
 * T34-F4 变体持久化仓储层。
 *
 * media-recipe 与 site-display-recipe 是 recipe/identity 层：处理串、身份哈希、
 * 尺寸推导都是纯函数。它们唯一需要的持久化就是"落一行变体"和"按 Object Key
 * 查一行变体"，那部分 SQL 集中在这里，配方本身不再直接写表。
 *
 * SQL 文本与列顺序与拆分前保持一致：F4 是边界重排，不是行为变更。
 */

export interface UpscaleVariantInsert {
  byteSize: number
  cropIdentity: string
  height: number
  id: string
  inputSha256: string
  mediaRole: string
  objectKey: string
  recipeVersion: string
  sha256: string
  sourceAssetId: string
  width: number
}

/** 私有放大源：INSERT OR IGNORE 保证并发重复生成不报错。 */
export function insertUpscaleVariant(
  sqlite: Database.Database,
  input: UpscaleVariantInsert,
  now: number,
) {
  sqlite.prepare(`
    INSERT OR IGNORE INTO asset_variants (
      id, asset_id, storage_scope, status, object_key, input_sha256,
      media_role, usage, width, height, format, quality, crop_identity,
      recipe_version, protection_mode, watermark_profile, logo_digest,
      watermark_anchor, sha256, byte_size, created_at, updated_at
    ) VALUES (?, ?, 'PRIVATE', 'READY', ?, ?, ?, 'preprocess', ?, ?,
              'png', 100, ?, ?, 'none', 'none', 'none', 'none', ?, ?, ?, ?)
  `).run(
    input.id,
    input.sourceAssetId,
    input.objectKey,
    input.inputSha256,
    input.mediaRole,
    input.width,
    input.height,
    input.cropIdentity,
    input.recipeVersion,
    input.sha256,
    input.byteSize,
    now,
    now,
  )
}

export function findVariantIdByObjectKey(
  sqlite: Database.Database,
  objectKey: string,
) {
  return sqlite.prepare(`
    SELECT id FROM asset_variants WHERE object_key = ?
  `).get(objectKey) as { id: string } | undefined
}

/** 已就绪变体的完整身份列；两种配方共用同一组列，只在过滤条件上不同。 */
const readyVariantColumns = `
  SELECT
    id, asset_id AS assetId, source_variant_id AS sourceVariantId,
    object_key AS objectKey, input_sha256 AS inputSha256,
    media_role AS mediaRole, usage, width, height, format,
    recipe_version AS recipeVersion, protection_mode AS protectionMode,
    watermark_profile AS watermarkProfile,
    watermark_profile_id AS watermarkProfileId,
    watermark_config_digest AS watermarkConfigDigest,
    logo_digest AS logoDigest, watermark_anchor AS watermarkAnchor,
    watermark_opacity_percent AS watermarkOpacityPercent,
    watermark_scale_percent AS watermarkScalePercent,
    sha256, byte_size AS byteSize
  FROM asset_variants
  WHERE storage_scope = 'PUBLIC' AND status = 'READY'
`

/**
 * 读回刚写入的水印变体行。行类型由调用方（配方层）声明，因为配方拥有
 * 自己的身份类型；这里只负责 SQL。
 */
export function findReadyWatermarkVariant<T>(
  sqlite: Database.Database,
  objectKey: string,
) {
  return sqlite.prepare(`
    ${readyVariantColumns}
      AND protection_mode = 'watermark'
      AND object_key = ?
  `).get(objectKey) as T | undefined
}

export function findReadySiteDisplayVariant<T>(
  sqlite: Database.Database,
  objectKey: string,
  recipeVersion: string,
) {
  return sqlite.prepare(`
    ${readyVariantColumns}
      AND protection_mode = 'none'
      AND recipe_version = ?
      AND object_key = ?
  `).get(recipeVersion, objectKey) as T | undefined
}

/** 复用同一 Object Key 的既有行：内容校验通过后只回填摘要与字节数。 */
export function refreshVariantContent(
  sqlite: Database.Database,
  id: string,
  sha256: string,
  byteSize: number,
  now: number,
) {
  sqlite.prepare(`
    UPDATE asset_variants
    SET status = 'READY', sha256 = ?, byte_size = ?,
        internal_error_code = NULL, version = version + 1,
        updated_at = ?
    WHERE id = ?
  `).run(sha256, byteSize, now, id)
}

export interface PublicVariantInsert {
  byteSize: number
  configDigest: string
  cropIdentity: string
  format: string
  height: number
  id: string
  inputSha256: string
  logoDigest: string
  mediaRole: string
  objectKey: string
  opacityPercent: number | null
  profileId: string | null
  quality: number
  recipeVersion: string
  scalePercent: number | null
  sha256: string
  sourceAssetId: string
  sourceVariantId: string | null
  usage: string
  watermarkAnchor: string
  watermarkProfile: string
  width: number
}

export function insertPublicVariant(
  sqlite: Database.Database,
  input: PublicVariantInsert,
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO asset_variants (
    id, asset_id, source_variant_id, storage_scope, status,
    object_key, input_sha256, media_role, usage, width, height,
    format, quality, crop_identity, recipe_version, protection_mode,
    watermark_profile, watermark_profile_id,
    watermark_config_digest, logo_digest, watermark_anchor,
    watermark_opacity_percent, watermark_scale_percent,
    sha256, byte_size, created_at, updated_at
    ) VALUES (?, ?, ?, 'PUBLIC', 'READY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              'watermark', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.sourceAssetId,
    input.sourceVariantId,
    input.objectKey,
    input.inputSha256,
    input.mediaRole,
    input.usage,
    input.width,
    input.height,
    input.format,
    input.quality,
    input.cropIdentity,
    input.recipeVersion,
    input.watermarkProfile,
    input.profileId,
    input.configDigest,
    input.logoDigest,
    input.watermarkAnchor,
    input.opacityPercent,
    input.scalePercent,
    input.sha256,
    input.byteSize,
    now,
    now,
  )
}

export interface SiteDisplayVariantInsert {
  byteSize: number
  cropIdentity: string
  format: string
  height: number
  id: string
  inputSha256: string
  mediaRole: string
  objectKey: string
  quality: number
  recipeVersion: string
  sha256: string
  sourceAssetId: string
  sourceVariantId: string | null
  usage: string
  width: number
}

/** 站点展示变体：protection_mode='none'，所有水印身份列固定为 none/NULL。 */
export function insertSiteDisplayVariant(
  sqlite: Database.Database,
  input: SiteDisplayVariantInsert,
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO asset_variants (
      id, asset_id, source_variant_id, storage_scope, status,
      object_key, input_sha256, media_role, usage, width, height,
      format, quality, crop_identity, recipe_version, protection_mode,
      watermark_profile, watermark_profile_id, watermark_config_digest,
      logo_digest, watermark_anchor, watermark_opacity_percent,
      watermark_scale_percent, sha256, byte_size, created_at, updated_at
    ) VALUES (?, ?, ?, 'PUBLIC', 'READY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              'none', 'none', NULL, 'none', 'none', 'none', NULL, NULL,
              ?, ?, ?, ?)
  `).run(
    input.id,
    input.sourceAssetId,
    input.sourceVariantId,
    input.objectKey,
    input.inputSha256,
    input.mediaRole,
    input.usage,
    input.width,
    input.height,
    input.format,
    input.quality,
    input.cropIdentity,
    input.recipeVersion,
    input.sha256,
    input.byteSize,
    now,
    now,
  )
}

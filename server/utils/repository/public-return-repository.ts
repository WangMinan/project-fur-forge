import type Database from 'better-sqlite3'
import {
  publicReturnWallDtoSchema,
  RETURN_WALL_PAGE_SIZE,
} from '../../../shared/schemas/return-photo'
import type { PublicReturnWallDto } from '../../../shared/types/contracts'
import { toPublicSourceSetDto, toSafePublicAlt } from '../recipe/media-mapper'
import type { VariantRecord } from '../recipe/media-mapper'
import {
  completeReturnWallVariants,
  returnWallWidths,
} from '../recipe/return-display-recipe'
import { getDatabase } from '../database'
import { getRuntimeConfig } from '../runtime-config'

/**
 * T36 公开返图墙投影。
 *
 * 这一层刻意只 SELECT 公开需要的列：返图 id、alt、关联作品的
 * 角色名与 slug、以及公开变体。授权来源 / 确认时间 / 内部备注、
 * 私有 Object Key、原文件名和 EXIF 根本不在查询里，
 * 因此不可能因为某个映射疏漏而进入公开响应。
 *
 * 可见性同时要求返图与关联作品都是 published：
 * 作品下架后关联返图立即从这里消失，但返图记录与私有原图保留。
 */

interface PublicReturnRow {
  alt: string
  assetHeight: number
  assetId: string
  assetWidth: number
  id: string
  workCharacterName: string
  workSlug: string
}

interface PublicReturnVariantRow extends VariantRecord {
  assetId: string
}

function countPublishedReturns(sqlite: Database.Database) {
  return (sqlite.prepare(`
    SELECT COUNT(*) AS total
    FROM return_photos AS photo
    JOIN works AS work ON work.id = photo.work_id
    JOIN assets AS asset ON asset.id = photo.asset_id
    WHERE photo.publication_status = 'published'
      AND work.publication_status = 'published'
      AND asset.role = 'return_photo'
      AND asset.status = 'READY'
  `).get() as { total: number }).total
}

/** 公开排序：人工 sort_order 后接稳定 ID，保证分页无重复无遗漏。 */
function loadPublishedReturns(
  sqlite: Database.Database,
  limit: number,
  offset: number,
) {
  return sqlite.prepare(`
    SELECT
      photo.id,
      photo.alt,
      photo.asset_id AS assetId,
      asset.width AS assetWidth,
      asset.height AS assetHeight,
      work.character_name AS workCharacterName,
      work.slug AS workSlug
    FROM return_photos AS photo
    JOIN works AS work ON work.id = photo.work_id
    JOIN assets AS asset ON asset.id = photo.asset_id
    WHERE photo.publication_status = 'published'
      AND work.publication_status = 'published'
      AND asset.role = 'return_photo'
      AND asset.status = 'READY'
    ORDER BY photo.sort_order, photo.id
    LIMIT ? OFFSET ?
  `).all(limit, offset) as PublicReturnRow[]
}

/**
 * 只取 `return-wall` / `return-display-v1` / `protection_mode='none'` 变体。
 * 查询里没有 watermark_profile 关联，因此活动 profile 切换
 * 不会改变返图的 URL、摘要或可见性。
 */
function loadReturnVariants(
  sqlite: Database.Database,
  assetIds: readonly string[],
) {
  if (assetIds.length === 0) {
    return []
  }
  const placeholders = assetIds.map(() => '?').join(', ')
  return sqlite.prepare(`
    SELECT
      variant.id, variant.asset_id AS assetId,
      variant.byte_size AS byteSize,
      variant.storage_scope AS storageScope,
      variant.status, variant.object_key AS objectKey,
      variant.width, variant.height, variant.format,
      variant.input_sha256 AS inputSha256,
      variant.internal_error_code AS internalErrorCode,
      variant.logo_digest AS logoDigest,
      variant.media_role AS mediaRole,
      variant.recipe_version AS recipeVersion,
      variant.sha256, variant.usage,
      variant.watermark_anchor AS watermarkAnchor,
      variant.watermark_config_digest AS watermarkConfigDigest,
      variant.watermark_opacity_percent AS watermarkOpacityPercent,
      variant.watermark_profile AS watermarkProfile,
      variant.watermark_profile_id AS watermarkProfileId,
      variant.watermark_scale_percent AS watermarkScalePercent
    FROM asset_variants AS variant
    WHERE variant.asset_id IN (${placeholders})
      AND variant.storage_scope = 'PUBLIC'
      AND variant.status = 'READY'
      AND variant.usage = 'return-wall'
      AND variant.recipe_version = 'return-display-v1'
      AND variant.protection_mode = 'none'
      AND length(variant.sha256) = 64
      AND variant.sha256 NOT GLOB '*[^0-9a-f]*'
      AND variant.byte_size > 0
    ORDER BY variant.asset_id, variant.width, variant.format
  `).all(...assetIds) as PublicReturnVariantRow[]
}

export function getPublicReturnWall(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  page = 1,
): PublicReturnWallDto {
  const total = countPublishedReturns(sqlite)
  const pageCount = Math.ceil(total / RETURN_WALL_PAGE_SIZE)
  const rows = loadPublishedReturns(
    sqlite,
    RETURN_WALL_PAGE_SIZE,
    (page - 1) * RETURN_WALL_PAGE_SIZE,
  )
  const variants = loadReturnVariants(sqlite, rows.map(row => row.assetId))
  const items = rows.flatMap((row) => {
    const complete = completeReturnWallVariants(
      row.assetWidth,
      variants.filter(variant => variant.assetId === row.assetId),
    )
    if (!complete) {
      // 变体不完整的单条返图受控跳过：不回退私有原图，也不让整页 500。
      return []
    }
    let sources
    try {
      sources = toPublicSourceSetDto(
        complete,
        mediaBaseUrl,
        returnWallWidths(row.assetWidth),
      )
    }
    catch {
      return []
    }
    // 固有宽高取最大宽度变体，浏览器据此预留空间避免 CLS。
    const largest = complete.reduce(
      (widest, variant) => (variant.width > widest.width ? variant : widest),
      complete[0]!,
    )
    return [{
      id: row.id,
      image: {
        alt: toSafePublicAlt(row.alt, `${row.workCharacterName}的返图`),
        height: largest.height,
        sources,
        width: largest.width,
      },
      work: {
        characterName: row.workCharacterName,
        href: `/works/${row.workSlug}`,
        slug: row.workSlug,
      },
    }]
  })

  return publicReturnWallDtoSchema.parse({
    items,
    page,
    pageCount,
    pageSize: RETURN_WALL_PAGE_SIZE,
    resultCount: total,
  })
}

export function getPublicReturnWallForRequest(page = 1) {
  return getPublicReturnWall(
    getDatabase().sqlite,
    getRuntimeConfig().mediaBaseUrl,
    page,
  )
}

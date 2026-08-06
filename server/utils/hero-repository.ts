import type Database from 'better-sqlite3'
import type { HeroPlacement } from '../../shared/types/contracts'
import type { VariantRecord } from './media-mapper'
import { ServiceError } from './service-error'

/**
 * T34-F4 Hero 仓储层。
 *
 * 只有 SQL、行映射和条件更新（含版本 CAS）。**不含** 业务规则、DTO 组合、
 * OSS 副作用或 operation 状态机——那些分别属于 service 与 runner。
 *
 * 这里刻意保留原有 SQL 文本与列别名：F4 是边界重排，不是行为变更。
 */

export type HeroMediaRole = 'home_hero_landscape' | 'home_hero_portrait'

export interface HomeRow {
  autoRotate: number
  autoRotateIntervalMs: number
  contactEmail: string
  contactQq: string
  tagline: string
  version: number
}

export interface HeroAssetRow {
  assetId: string
  height: number
  role: HeroMediaRole
  status: string
  uploadedForHome: number
  width: number
}

export interface SlideRow {
  alt: string
  enabled: number
  id: string
  landscapeAssetId: string
  landscapeHeight: number
  landscapePreviewObjectKey: string | null
  landscapePrivateObjectKey: string
  landscapeSha256: string
  landscapeWidth: number
  linkedWorkId: string | null
  linkedWorkSlug: string | null
  linkedWorkStatus: 'draft' | 'published' | 'unpublished' | null
  placement: HeroPlacement
  portraitAssetId: string
  portraitHeight: number
  portraitPreviewObjectKey: string | null
  portraitPrivateObjectKey: string
  portraitSha256: string
  portraitWidth: number
  previewExpiresAt: number | null
  sortOrder: number
  version: number
}

export interface HeroVariantRow extends VariantRecord {
  assetId: string
}

const selectSlides = `
  SELECT
    slide.id, slide.version, slide.alt_text AS alt,
    slide.placement,
    slide.sort_order AS sortOrder, slide.enabled,
    slide.landscape_asset_id AS landscapeAssetId,
    landscape.width AS landscapeWidth,
    landscape.height AS landscapeHeight,
    landscape.sha256 AS landscapeSha256,
    landscape.private_object_key AS landscapePrivateObjectKey,
    slide.landscape_preview_object_key AS landscapePreviewObjectKey,
    slide.portrait_asset_id AS portraitAssetId,
    portrait.width AS portraitWidth,
    portrait.height AS portraitHeight,
    portrait.sha256 AS portraitSha256,
    portrait.private_object_key AS portraitPrivateObjectKey,
    slide.portrait_preview_object_key AS portraitPreviewObjectKey,
    slide.preview_expires_at AS previewExpiresAt,
    slide.linked_work_id AS linkedWorkId,
    linked.slug AS linkedWorkSlug,
    linked.publication_status AS linkedWorkStatus
  FROM site_hero_slides AS slide
  JOIN assets AS landscape ON landscape.id = slide.landscape_asset_id
  JOIN assets AS portrait ON portrait.id = slide.portrait_asset_id
  LEFT JOIN works AS linked ON linked.id = slide.linked_work_id
`

const selectHeroVariants = `
  SELECT
      id, asset_id AS assetId, byte_size AS byteSize,
      storage_scope AS storageScope, status, object_key AS objectKey,
      width, height, format, input_sha256 AS inputSha256,
      internal_error_code AS internalErrorCode,
      logo_digest AS logoDigest, media_role AS mediaRole,
      protection_mode AS protectionMode,
      recipe_version AS recipeVersion, sha256, usage,
      watermark_anchor AS watermarkAnchor,
      watermark_config_digest AS watermarkConfigDigest,
      watermark_opacity_percent AS watermarkOpacityPercent,
      watermark_profile AS watermarkProfile,
      watermark_profile_id AS watermarkProfileId,
      watermark_scale_percent AS watermarkScalePercent
    FROM asset_variants
`

export function findHome(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT
      version, hero_tagline AS tagline,
      contact_email AS contactEmail, contact_qq AS contactQq,
      hero_auto_rotate AS autoRotate,
      hero_auto_rotate_interval_ms AS autoRotateIntervalMs
    FROM site_content WHERE id = 'site'
  `).get() as HomeRow | undefined
}

export function findSlides(
  sqlite: Database.Database,
  placement: HeroPlacement = 'home',
) {
  return sqlite.prepare(`${selectSlides} WHERE slide.placement = ? ORDER BY slide.enabled DESC, slide.sort_order, slide.id`)
    .all(placement) as SlideRow[]
}

export function findSlide(
  sqlite: Database.Database,
  id: string,
  placement?: HeroPlacement,
) {
  return sqlite.prepare(`${selectSlides} WHERE slide.id = ?${placement ? ' AND slide.placement = ?' : ''}`)
    .get(...(placement ? [id, placement] : [id])) as SlideRow | undefined
}

export function findVariantsForAssets(
  sqlite: Database.Database,
  assetIds: readonly string[],
) {
  const ids = [...new Set(assetIds)]
  const grouped = new Map(ids.map(id => [id, [] as HeroVariantRow[]]))
  if (ids.length === 0) {
    return grouped
  }
  const placeholders = ids.map(() => '?').join(', ')
  const rows = sqlite.prepare(`
    ${selectHeroVariants}
    WHERE asset_id IN (${placeholders})
    ORDER BY asset_id, usage, width, format
  `).all(...ids) as HeroVariantRow[]
  for (const row of rows) {
    grouped.get(row.assetId)!.push(row)
  }
  return grouped
}

export function findHeroAsset(
  sqlite: Database.Database,
  assetId: string,
) {
  return sqlite.prepare(`
    SELECT
      asset.id AS assetId, asset.role, asset.status,
      asset.width, asset.height,
      EXISTS (
        SELECT 1 FROM upload_sessions AS upload
        WHERE upload.asset_id = asset.id
          AND upload.owner_type = 'site'
          AND upload.owner_id = 'home'
          AND upload.status = 'COMPLETED'
      ) AS uploadedForHome
    FROM assets AS asset WHERE asset.id = ?
  `).get(assetId) as HeroAssetRow | undefined
}

/** 首页设置版本 CAS：抢不到即视为版本过期。 */
export function claimHomeVersion(
  sqlite: Database.Database,
  expectedVersion: number,
  now: number,
) {
  const result = sqlite.prepare(`
    UPDATE site_content
    SET version = version + 1, updated_at = ?
    WHERE id = 'site' AND version = ?
  `).run(now, expectedVersion)
  if (result.changes !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
}

export function countEnabledSlides(
  sqlite: Database.Database,
  placement: HeroPlacement,
) {
  return Number(sqlite.prepare(`
    SELECT count(*) FROM site_hero_slides
    WHERE enabled = 1 AND placement = ?
  `).pluck().get(placement))
}

export function hasEnabledSlideAtOrder(
  sqlite: Database.Database,
  placement: HeroPlacement,
  sortOrder: number,
) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM site_hero_slides
    WHERE enabled = 1 AND placement = ? AND sort_order = ? LIMIT 1
  `).pluck().get(placement, sortOrder))
}

export function isHeroAssetAssigned(
  sqlite: Database.Database,
  landscapeAssetId: string,
  portraitAssetId: string,
  exceptSlideId?: string,
) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM site_hero_slides
    WHERE id != COALESCE(?, '')
      AND (
        landscape_asset_id IN (?, ?)
        OR portrait_asset_id IN (?, ?)
      )
    LIMIT 1
  `).pluck().get(
    exceptSlideId ?? null,
    landscapeAssetId,
    portraitAssetId,
    landscapeAssetId,
    portraitAssetId,
  ))
}

export function isWorkPublished(
  sqlite: Database.Database,
  workId: string,
) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM works
    WHERE id = ? AND publication_status = 'published'
  `).pluck().get(workId))
}

export function insertSlide(
  sqlite: Database.Database,
  input: {
    alt: string
    id: string
    landscapeAssetId: string
    linkedWorkId: string | null
    placement: HeroPlacement
    portraitAssetId: string
    sortOrder: number
  },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO site_hero_slides (
      id, placement, landscape_asset_id, portrait_asset_id, alt_text,
      sort_order, enabled, linked_work_id, version,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, ?, ?)
  `).run(
    input.id,
    input.placement,
    input.landscapeAssetId,
    input.portraitAssetId,
    input.alt,
    input.sortOrder,
    input.linkedWorkId,
    now,
    now,
  )
}

export function updateDisabledSlide(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  input: {
    alt: string
    landscapeAssetId: string
    linkedWorkId: string | null
    portraitAssetId: string
    sortOrder: number
  },
  now: number,
) {
  sqlite.prepare(`
    UPDATE site_hero_slides
    SET landscape_asset_id = ?, portrait_asset_id = ?, alt_text = ?,
        sort_order = ?, linked_work_id = ?, version = version + 1,
        updated_at = ?
    WHERE id = ? AND enabled = 0 AND placement = ?
  `).run(
    input.landscapeAssetId,
    input.portraitAssetId,
    input.alt,
    input.sortOrder,
    input.linkedWorkId,
    now,
    id,
    placement,
  )
}

export function deleteDisabledSlide(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
) {
  sqlite.prepare(`
    DELETE FROM site_hero_slides
    WHERE id = ? AND enabled = 0 AND placement = ?
  `).run(id, placement)
}

export function updateHomeSettingsRow(
  sqlite: Database.Database,
  input: {
    autoRotate: boolean
    autoRotateIntervalMs: number
    tagline: string
  },
  expectedVersion: number,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE site_content
    SET hero_tagline = ?, hero_auto_rotate = ?,
        hero_auto_rotate_interval_ms = ?, version = version + 1,
        updated_at = ?
    WHERE id = 'site' AND version = ?
  `).run(
    input.tagline,
    input.autoRotate ? 1 : 0,
    input.autoRotateIntervalMs,
    now,
    expectedVersion,
  ).changes
}

export function setSlideEnabled(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  enabled: boolean,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE site_hero_slides
    SET enabled = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND enabled = ? AND placement = ?
  `).run(enabled ? 1 : 0, now, id, enabled ? 0 : 1, placement).changes
}

export function replaceEnabledOrder(
  sqlite: Database.Database,
  placement: HeroPlacement,
  slideIds: readonly string[],
  now: number,
) {
  sqlite.prepare(`
    UPDATE site_hero_slides SET enabled = 0
    WHERE enabled = 1 AND placement = ?
  `).run(placement)
  const update = sqlite.prepare(`
    UPDATE site_hero_slides
    SET sort_order = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND enabled = 0 AND placement = ?
  `)
  slideIds.forEach((id, index) => update.run(index, now, id, placement))
  const enable = sqlite.prepare(`
    UPDATE site_hero_slides SET enabled = 1
    WHERE id = ? AND placement = ?
  `)
  slideIds.forEach(id => enable.run(id, placement))
}

export function setSlidePreviewKeys(
  sqlite: Database.Database,
  id: string,
  input: {
    expiresAt: number
    landscapeObjectKey: string
    portraitObjectKey: string
  },
) {
  sqlite.prepare(`
    UPDATE site_hero_slides
    SET landscape_preview_object_key = ?, portrait_preview_object_key = ?,
        preview_expires_at = ?
    WHERE id = ? AND enabled = 0
  `).run(
    input.landscapeObjectKey,
    input.portraitObjectKey,
    input.expiresAt,
    id,
  )
}

export function clearSlidePreviewKeys(
  sqlite: Database.Database,
  id: string,
) {
  sqlite.prepare(`
    UPDATE site_hero_slides
    SET landscape_preview_object_key = NULL,
        portrait_preview_object_key = NULL,
        preview_expires_at = NULL
    WHERE id = ?
  `).run(id)
}

export function findPublicKeysForSlide(
  sqlite: Database.Database,
  slide: Pick<SlideRow, 'landscapeAssetId' | 'portraitAssetId'>,
) {
  return sqlite.prepare(`
    SELECT object_key FROM asset_variants
    WHERE storage_scope = 'PUBLIC'
      AND asset_id IN (?, ?)
  `).pluck().all(
    slide.landscapeAssetId,
    slide.portraitAssetId,
  ) as string[]
}

export function deletePublicVariantRow(
  sqlite: Database.Database,
  objectKey: string,
) {
  sqlite.prepare(`
    DELETE FROM asset_variants
    WHERE storage_scope = 'PUBLIC' AND object_key = ?
  `).run(objectKey)
}

export function insertHomeAuditLog(
  sqlite: Database.Database,
  input: {
    action: string
    actorUserId: string
    entityId: string
    id: string
    result: 'SUCCESS' | 'FAILURE'
  },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, result, created_at
    ) VALUES (?, ?, ?, 'HOME', ?, ?, ?)
  `).run(
    input.id,
    input.actorUserId,
    input.action,
    input.entityId,
    input.result,
    now,
  )
}

/** 恢复身份：没有交互式管理员时使用数据库中的唯一管理员作为可审计身份。 */
export function findSystemRecoveryActorId(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT id FROM users ORDER BY created_at LIMIT 1
  `).pluck().get() as string | undefined ?? null
}

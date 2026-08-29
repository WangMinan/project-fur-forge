import type Database from 'better-sqlite3'
import type {
  HeroOrientation,
  HeroPlacement,
} from '../../../shared/types/contracts'
import type { VariantRecord } from '../recipe/media-mapper'
import { ServiceError } from '../service-error'

export interface HeroVariantRow extends VariantRecord {
  assetId: string
}

const selectHeroVariants = `
  SELECT
    id, asset_id AS assetId, byte_size AS byteSize,
    storage_scope AS storageScope, status, object_key AS objectKey,
    width, height, format, input_sha256 AS inputSha256,
    internal_error_code AS internalErrorCode,
    media_role AS mediaRole,
    recipe_version AS recipeVersion, sha256, usage
  FROM asset_variants
`

function findVariantsForAssets(
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

export interface HeroCollectionRow {
  orientation: HeroOrientation
  placement: HeroPlacement
  version: number
}

export interface HeroItemRow {
  alt: string
  assetId: string
  assetVersion: number
  enabled: number
  focalX: number
  focalY: number
  height: number
  id: string
  orientation: HeroOrientation
  placement: HeroPlacement
  previewExpiresAt: number | null
  previewObjectKey: string | null
  privateObjectKey: string
  role: 'home_hero_landscape' | 'home_hero_portrait'
  sha256: string
  sortOrder: number
  status: string
  version: number
  width: number
}

export interface HeroItemAssetRow {
  assetId: string
  version: number
  focalX: number
  focalY: number
  height: number
  privateObjectKey: string
  role: 'home_hero_landscape' | 'home_hero_portrait'
  sha256: string
  status: string
  uploadedForCollection: number
  width: number
}

const selectItems = `
  SELECT
    item.id, item.placement, item.orientation, item.version,
    item.alt_text AS alt, item.sort_order AS sortOrder, item.enabled,
    item.preview_object_key AS previewObjectKey,
    item.preview_expires_at AS previewExpiresAt,
    asset.id AS assetId, asset.role, asset.status,
    asset.version AS assetVersion,
    asset.focal_x AS focalX, asset.focal_y AS focalY,
    asset.width, asset.height, asset.sha256,
    asset.private_object_key AS privateObjectKey
  FROM site_hero_items AS item
  JOIN assets AS asset ON asset.id = item.asset_id
`

export function insertHeroAuditLog(
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

export function heroOwnerId(
  placement: HeroPlacement,
  orientation: HeroOrientation,
) {
  return `hero-${placement}-${orientation}` as const
}

export function findHeroCollection(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
) {
  return sqlite.prepare(`
    SELECT placement, orientation, version
    FROM site_hero_collections
    WHERE placement = ? AND orientation = ?
  `).get(placement, orientation) as HeroCollectionRow | undefined
}

export function claimHeroCollectionVersion(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  expectedVersion: number,
  now: number,
) {
  const result = sqlite.prepare(`
    UPDATE site_hero_collections
    SET version = version + 1, updated_at = ?
    WHERE placement = ? AND orientation = ? AND version = ?
  `).run(now, placement, orientation, expectedVersion)
  if (result.changes !== 1) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Hero collection version is stale.',
      'VERSION_CONFLICT',
    )
  }
}

export function findHeroItems(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
) {
  return sqlite.prepare(`${selectItems}
    WHERE item.placement = ? AND item.orientation = ?
    ORDER BY item.enabled DESC, item.sort_order, item.id
  `).all(placement, orientation) as HeroItemRow[]
}

export function findHeroItem(
  sqlite: Database.Database,
  id: string,
  placement?: HeroPlacement,
  orientation?: HeroOrientation,
) {
  const scope = placement && orientation
    ? ' AND item.placement = ? AND item.orientation = ?'
    : ''
  return sqlite.prepare(`${selectItems} WHERE item.id = ?${scope}`)
    .get(...(scope ? [id, placement, orientation] : [id])) as HeroItemRow | undefined
}

export function findHeroItemAsset(
  sqlite: Database.Database,
  assetId: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
) {
  return sqlite.prepare(`
    SELECT
      asset.id AS assetId, asset.role, asset.status,
      asset.version, asset.focal_x AS focalX, asset.focal_y AS focalY,
      asset.width, asset.height, asset.sha256,
      asset.private_object_key AS privateObjectKey,
      EXISTS (
        SELECT 1 FROM upload_sessions AS upload
        WHERE upload.asset_id = asset.id
          AND upload.owner_type = 'site'
          AND upload.owner_id = ?
          AND upload.status = 'COMPLETED'
      ) AS uploadedForCollection
    FROM assets AS asset WHERE asset.id = ?
  `).get(heroOwnerId(placement, orientation), assetId) as HeroItemAssetRow | undefined
}

export function findHeroItemVariants(
  sqlite: Database.Database,
  assetIds: readonly string[],
): ReadonlyMap<string, readonly HeroVariantRow[]> {
  return findVariantsForAssets(sqlite, assetIds)
}

export function isHeroItemAssetAssigned(
  sqlite: Database.Database,
  assetId: string,
  exceptItemId?: string,
) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM site_hero_items
    WHERE asset_id = ? AND id != COALESCE(?, '') LIMIT 1
  `).pluck().get(assetId, exceptItemId ?? null))
}

export function countHeroItemAssetAssignments(
  sqlite: Database.Database,
  assetId: string,
  exceptItemId?: string,
) {
  return Number(sqlite.prepare(`
    SELECT count(*) FROM site_hero_items
    WHERE asset_id = ? AND id != COALESCE(?, '')
  `).pluck().get(assetId, exceptItemId ?? null))
}

export function updateHeroAssetFocal(
  sqlite: Database.Database,
  assetId: string,
  expectedVersion: number,
  focalX: number,
  focalY: number,
  now: number,
) {
  const result = sqlite.prepare(`
    UPDATE assets
    SET focal_x = ?, focal_y = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `).run(focalX, focalY, now, assetId, expectedVersion)
  if (result.changes !== 1) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Hero asset version is stale.',
      'VERSION_CONFLICT',
    )
  }
}

export function insertHeroItem(
  sqlite: Database.Database,
  input: {
    alt: string
    assetId: string
    id: string
    orientation: HeroOrientation
    placement: HeroPlacement
    sortOrder: number
  },
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO site_hero_items (
      id, placement, orientation, asset_id, alt_text, sort_order,
      enabled, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
  `).run(
    input.id,
    input.placement,
    input.orientation,
    input.assetId,
    input.alt,
    input.sortOrder,
    now,
    now,
  )
}

export function updateDisabledHeroItem(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  input: { alt: string, assetId: string, sortOrder: number },
  now: number,
) {
  return sqlite.prepare(`
    UPDATE site_hero_items
    SET asset_id = ?, alt_text = ?, sort_order = ?,
        version = version + 1, updated_at = ?
    WHERE id = ? AND placement = ? AND orientation = ? AND enabled = 0
  `).run(
    input.assetId,
    input.alt,
    input.sortOrder,
    now,
    id,
    placement,
    orientation,
  ).changes
}

export function deleteDisabledHeroItem(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
) {
  return sqlite.prepare(`
    DELETE FROM site_hero_items
    WHERE id = ? AND placement = ? AND orientation = ? AND enabled = 0
  `).run(id, placement, orientation).changes
}

export function countEnabledHeroItems(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
) {
  return Number(sqlite.prepare(`
    SELECT count(*) FROM site_hero_items
    WHERE placement = ? AND orientation = ? AND enabled = 1
  `).pluck().get(placement, orientation))
}

export function hasEnabledHeroItemAtOrder(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  sortOrder: number,
) {
  return Boolean(sqlite.prepare(`
    SELECT 1 FROM site_hero_items
    WHERE placement = ? AND orientation = ?
      AND enabled = 1 AND sort_order = ? LIMIT 1
  `).pluck().get(placement, orientation, sortOrder))
}

export function setHeroItemEnabled(
  sqlite: Database.Database,
  id: string,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  enabled: boolean,
  now: number,
) {
  return sqlite.prepare(`
    UPDATE site_hero_items
    SET enabled = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND placement = ? AND orientation = ? AND enabled = ?
  `).run(
    enabled ? 1 : 0,
    now,
    id,
    placement,
    orientation,
    enabled ? 0 : 1,
  ).changes
}

export function replaceEnabledHeroItemOrder(
  sqlite: Database.Database,
  placement: HeroPlacement,
  orientation: HeroOrientation,
  itemIds: readonly string[],
  now: number,
) {
  sqlite.prepare(`
    UPDATE site_hero_items SET enabled = 0
    WHERE placement = ? AND orientation = ? AND enabled = 1
  `).run(placement, orientation)
  const update = sqlite.prepare(`
    UPDATE site_hero_items
    SET sort_order = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND placement = ? AND orientation = ? AND enabled = 0
  `)
  itemIds.forEach((id, index) => update.run(
    index,
    now,
    id,
    placement,
    orientation,
  ))
  const enable = sqlite.prepare(`
    UPDATE site_hero_items SET enabled = 1
    WHERE id = ? AND placement = ? AND orientation = ?
  `)
  itemIds.forEach(id => enable.run(id, placement, orientation))
}

export function setHeroItemPreview(
  sqlite: Database.Database,
  id: string,
  objectKey: string,
  expiresAt: number,
) {
  sqlite.prepare(`
    UPDATE site_hero_items
    SET preview_object_key = ?, preview_expires_at = ?
    WHERE id = ? AND enabled = 0
  `).run(objectKey, expiresAt, id)
}

export function clearHeroItemPreview(
  sqlite: Database.Database,
  id: string,
) {
  sqlite.prepare(`
    UPDATE site_hero_items
    SET preview_object_key = NULL, preview_expires_at = NULL
    WHERE id = ?
  `).run(id)
}

export function findPublicKeysForHeroItem(
  sqlite: Database.Database,
  item: Pick<HeroItemRow, 'assetId' | 'orientation' | 'placement'>,
) {
  const usage = item.placement === 'home'
    ? `home-hero-${item.orientation}`
    : `commission-hero-${item.orientation}`
  const usages = item.placement === 'commission' && item.orientation === 'landscape'
    ? [usage, 'home-entry-commission']
    : [usage]
  const placeholders = usages.map(() => '?').join(', ')
  return sqlite.prepare(`
    SELECT object_key FROM asset_variants
    WHERE asset_id = ? AND storage_scope = 'PUBLIC'
      AND usage IN (${placeholders})
  `).pluck().all(item.assetId, ...usages) as string[]
}

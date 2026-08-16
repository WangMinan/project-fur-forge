import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  managedAdoptionCoverDtoSchema,
  managedDesignSheetDtoSchema,
  managedWorkDtoSchema,
  publicSafeWorkPreviewDtoSchema,
  workListItemDtoSchema,
} from '../../../shared/schemas/work'
import type {
  ManagedAdoptionCoverDto,
  ManagedDesignSheetDto,
  ManagedWorkDto,
  FeaturedWorkOrderItem,
  PublicSafeWorkPreviewDto,
  WatermarkAnchor,
  WorkFields,
  WorkListItemDto,
} from '../../../shared/types/contracts'
import type { MediaStorage } from '../media-storage'
import { ServiceError } from '../service-error'
import { hasBlockingPublicationCleanup } from '../repository/publication-repository'

interface StudioPhotoInput {
  alt: string
  assetId: string
  crop: {
    height: number
    width: number
    x: number
    y: number
  }
  focalX: number
  focalY: number
  primary: boolean
  watermarkAnchor?: WatermarkAnchor | undefined
}

interface DesignSheetInput {
  alt: string
  assetId: string
}

interface AdoptionCoverInput {
  alt: string
  assetId: string
  crop: StudioPhotoInput['crop']
  focalX: number
  focalY: number
}

interface WorkRow {
  adoptionMethod: 'regular' | 'event_drop' | null
  businessStatus: 'preparing' | 'available' | 'event_sale' | 'scheduled' | 'in_production' | 'delivered' | null
  adoptionStatus: 'available' | 'adopted' | null
  characterName: string
  eventName: string | null
  eventTime: string | null
  featured: number
  id: string
  ownerContact: string | null
  ownerDisplay: string
  priceAmountMinor: number | null
  priceCurrency: 'CNY' | null
  publicationStatus: 'draft' | 'published' | 'unpublished'
  purpose: 'commission' | 'adoption' | 'showcase'
  slug: string
  sortOrder: number
  species: string
  suitType: 'full' | 'partial'
  version: number
}

interface FeaturedOrderRow {
  id: string
  sortOrder: number
  version: number
}

const selectWork = `
  SELECT
    id, version, slug, character_name AS characterName,
    species, suit_type AS suitType, purpose,
    adoption_method AS adoptionMethod,
    business_status AS businessStatus,
    adoption_status AS adoptionStatus,
    event_name AS eventName,
    event_time AS eventTime,
    owner_display AS ownerDisplay, owner_contact AS ownerContact,
    price_amount_minor AS priceAmountMinor,
    price_currency AS priceCurrency,
    publication_status AS publicationStatus,
    sort_order AS sortOrder, featured
  FROM works
`

function findWork(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`${selectWork} WHERE id = ?`)
    .get(id) as WorkRow | undefined
}

function requireWork(sqlite: Database.Database, id: string) {
  const work = findWork(sqlite, id)
  if (!work) {
    throw new ServiceError(404, 'NOT_FOUND', 'Work was not found.', 'RESOURCE_NOT_FOUND')
  }
  return work
}

function featureTags(sqlite: Database.Database, workId: string) {
  return sqlite.prepare(`
    SELECT value FROM work_feature_tags
    WHERE work_id = ? ORDER BY position
  `).pluck().all(workId) as string[]
}

function studioPhotos(sqlite: Database.Database, workId: string) {
  return sqlite.prepare(`
    SELECT
      relation.asset_id AS assetId,
      relation.alt_text AS alt,
      relation.position,
      relation.is_primary AS "primary",
      relation.focal_x AS focalX,
      relation.focal_y AS focalY,
      relation.crop_x AS cropX,
      relation.crop_y AS cropY,
      relation.crop_width AS cropWidth,
      relation.crop_height AS cropHeight,
      relation.watermark_anchor AS watermarkAnchor,
      asset.version, asset.status, asset.width, asset.height,
      (
        SELECT count(*) FROM asset_variants AS variant
        WHERE variant.asset_id = asset.id
          AND variant.storage_scope = 'PUBLIC'
          AND variant.status = 'READY'
          AND variant.watermark_profile_id = (
            SELECT active_watermark_profile_id
            FROM site_branding WHERE id = 'site'
          )
      ) AS publicVariantCount
    FROM work_assets AS relation
    JOIN assets AS asset ON asset.id = relation.asset_id
    WHERE relation.work_id = ? AND relation.role = 'studio_photo'
    ORDER BY relation.position
  `).all(workId).map((row) => {
    const photo = row as Record<string, unknown>
    return {
      assetId: photo.assetId,
      alt: photo.alt,
      primary: Boolean(photo.primary),
      focalX: photo.focalX,
      focalY: photo.focalY,
      crop: {
        x: photo.cropX,
        y: photo.cropY,
        width: photo.cropWidth,
        height: photo.cropHeight,
      },
      watermarkAnchor: photo.watermarkAnchor,
      version: photo.version,
      status: photo.status,
      width: photo.width,
      height: photo.height,
      position: photo.position,
      publicVariantCount: photo.publicVariantCount,
    }
  })
}

function designSheet(
  sqlite: Database.Database,
  workId: string,
): ManagedDesignSheetDto | null {
  const row = sqlite.prepare(`
    SELECT
      relation.asset_id AS assetId,
      relation.alt_text AS alt,
      relation.position,
      asset.version, asset.status, asset.width, asset.height,
      (
        SELECT count(*) FROM asset_variants AS variant
        WHERE variant.asset_id = asset.id
          AND variant.storage_scope = 'PUBLIC'
          AND variant.status = 'READY'
          AND variant.watermark_profile_id = (
            SELECT active_watermark_profile_id
            FROM site_branding WHERE id = 'site'
          )
      ) AS publicVariantCount
    FROM work_assets AS relation
    JOIN assets AS asset ON asset.id = relation.asset_id
    WHERE relation.work_id = ? AND relation.role = 'design_sheet'
  `).get(workId)
  return row ? managedDesignSheetDtoSchema.parse(row) : null
}

function adoptionCover(
  sqlite: Database.Database,
  workId: string,
): ManagedAdoptionCoverDto | null {
  const row = sqlite.prepare(`
    SELECT
      relation.asset_id AS assetId,
      relation.alt_text AS alt,
      relation.position,
      relation.focal_x AS focalX,
      relation.focal_y AS focalY,
      relation.crop_x AS cropX,
      relation.crop_y AS cropY,
      relation.crop_width AS cropWidth,
      relation.crop_height AS cropHeight,
      asset.version, asset.status, asset.width, asset.height,
      (
        SELECT count(*) FROM asset_variants AS variant
        WHERE variant.asset_id = asset.id
          AND variant.storage_scope = 'PUBLIC'
          AND variant.status = 'READY'
          AND variant.usage = 'adoption-card'
          AND variant.watermark_profile_id = (
            SELECT active_watermark_profile_id
            FROM site_branding WHERE id = 'site'
          )
      ) AS publicVariantCount
    FROM work_assets AS relation
    JOIN assets AS asset ON asset.id = relation.asset_id
    WHERE relation.work_id = ? AND relation.role = 'adoption_cover'
  `).get(workId) as Record<string, unknown> | undefined
  return row ? managedAdoptionCoverDtoSchema.parse({
    assetId: row.assetId,
    alt: row.alt,
    focalX: row.focalX,
    focalY: row.focalY,
    crop: {
      x: row.cropX,
      y: row.cropY,
      width: row.cropWidth,
      height: row.cropHeight,
    },
    version: row.version,
    status: row.status,
    width: row.width,
    height: row.height,
    position: row.position,
    publicVariantCount: row.publicVariantCount,
  }) : null
}

function managedWork(
  sqlite: Database.Database,
  row: WorkRow,
): ManagedWorkDto {
  const base = {
    id: row.id,
    version: row.version,
    slug: row.slug,
    characterName: row.characterName,
    species: row.species,
    suitType: row.suitType,
    purpose: row.purpose,
    ownerDisplay: row.ownerDisplay,
    featureTags: featureTags(sqlite, row.id),
    sortOrder: row.sortOrder,
    featured: Boolean(row.featured),
    publicationStatus: row.publicationStatus,
    studioPhotos: studioPhotos(sqlite, row.id),
    private: {
      ownerContact: row.ownerContact,
    },
  }
  return managedWorkDtoSchema.parse(row.purpose === 'adoption'
    ? {
        ...base,
        adoptionStatus: row.adoptionStatus,
        adoptionCover: adoptionCover(sqlite, row.id),
        designSheet: designSheet(sqlite, row.id),
        adoptionMethod: row.adoptionMethod,
        businessStatus: row.businessStatus,
        eventName: row.eventName,
        eventTime: row.eventTime,
        priceCnyMinor: row.priceCurrency === 'CNY'
          ? row.priceAmountMinor
          : null,
      }
    : base)
}

/**
 * 展会字段只在“领养 + 展会掉落”下有值。
 * 其他业务类型统一返回 null，保证切换类型后不留僵尸值。
 */
function eventFieldFor(
  input: WorkFields,
  field: 'eventName' | 'eventTime',
) {
  if (input.purpose !== 'adoption' || input.adoptionMethod !== 'event_drop') {
    return null
  }
  const value = input[field]
  return value === undefined ? null : value
}

function translateConstraint(error: unknown): never {
  const message = String(error)
  if (message.includes('works.slug') || message.includes('works_slug_unique')) {
    throw new ServiceError(409, 'CONFLICT', 'Work slug is already in use.', 'WORK_SLUG_TAKEN')
  }
  if (
    message.includes('work_assets_asset_unique')
    || message.includes('UNIQUE constraint failed: work_assets.asset_id')
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Asset is already linked to a work.', 'ASSET_ALREADY_LINKED')
  }
  throw error
}

function replaceTags(
  sqlite: Database.Database,
  workId: string,
  values: readonly string[],
) {
  sqlite.prepare('DELETE FROM work_feature_tags WHERE work_id = ?').run(workId)
  const insert = sqlite.prepare(`
    INSERT INTO work_feature_tags (work_id, position, value)
    VALUES (?, ?, ?)
  `)
  values.forEach((value, position) => insert.run(workId, position, value))
}

function featuredOrderRows(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT id, version, sort_order AS sortOrder
    FROM works
    WHERE featured = 1
    ORDER BY sort_order, id
  `).all() as FeaturedOrderRow[]
}

function featuredIdsForMembership(
  sqlite: Database.Database,
  id: string,
  featured: boolean,
) {
  const ids = featuredOrderRows(sqlite).map(row => row.id)
  const existingIndex = ids.indexOf(id)
  if (!featured) {
    return ids.filter(value => value !== id)
  }
  if (existingIndex >= 0) {
    return ids
  }
  return [...ids, id]
}

/**
 * 把精选序号压成连续 0..n-1。只更新实际变化的其他作品，避免一次勾选
 * 无意义地使全部资源版本失效；目标作品由调用方与其业务字段一起更新。
 */
function normalizeFeaturedRows(
  sqlite: Database.Database,
  orderedIds: readonly string[],
  now: number,
  skipId?: string,
) {
  const current = new Map(featuredOrderRows(sqlite).map(row => [row.id, row]))
  const update = sqlite.prepare(`
    UPDATE works
    SET sort_order = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND featured = 1 AND sort_order != ?
  `)
  orderedIds.forEach((id, index) => {
    if (id === skipId || current.get(id)?.sortOrder === index) {
      return
    }
    update.run(index, now, id, index)
  })
}

export function listManagedWorks(
  sqlite: Database.Database,
): WorkListItemDto[] {
  const rows = sqlite.prepare(`
    SELECT
      work.id, work.version, work.slug,
      work.character_name AS characterName,
      work.species, work.suit_type AS suitType, work.purpose,
      work.adoption_method AS adoptionMethod,
      work.business_status AS businessStatus,
      work.event_name AS eventName,
      work.event_time AS eventTime,
      work.owner_display AS ownerDisplay,
      work.price_amount_minor AS priceAmountMinor,
      work.price_currency AS priceCurrency,
      work.publication_status AS publicationStatus,
      work.sort_order AS sortOrder, work.featured,
      count(photo.asset_id) AS studioPhotoCount,
      max(CASE WHEN photo.is_primary = 1 THEN photo.asset_id END) AS primaryAssetId,
      (
        SELECT asset_id FROM work_assets
        WHERE work_id = work.id AND role = 'design_sheet'
      ) AS designSheetAssetId
    FROM works AS work
    LEFT JOIN work_assets AS photo
      ON photo.work_id = work.id AND photo.role = 'studio_photo'
    GROUP BY work.id
    ORDER BY work.updated_at DESC, work.id
  `).all()
  return rows.map((value) => {
    const row = value as WorkRow & {
      primaryAssetId: string | null
      designSheetAssetId: string | null
      studioPhotoCount: number
    }
    const base = {
      id: row.id,
      version: row.version,
      slug: row.slug,
      characterName: row.characterName,
      species: row.species,
      suitType: row.suitType,
      purpose: row.purpose,
      ownerDisplay: row.ownerDisplay,
      publicationStatus: row.publicationStatus,
      sortOrder: row.sortOrder,
      featured: Boolean(row.featured),
      studioPhotoCount: row.studioPhotoCount,
      primaryAssetId: row.primaryAssetId,
    }
    return workListItemDtoSchema.parse(row.purpose === 'adoption'
      ? {
          ...base,
          designSheetAssetId: row.designSheetAssetId,
          adoptionMethod: row.adoptionMethod,
          businessStatus: row.businessStatus,
          eventName: row.eventName,
        eventTime: row.eventTime,
          priceCnyMinor: row.priceCurrency === 'CNY'
            ? row.priceAmountMinor
            : null,
        }
      : base)
  })
}

export function listFeaturedManagedWorks(
  sqlite: Database.Database,
) {
  return listManagedWorks(sqlite)
    .filter(work => work.featured)
    .toSorted((left, right) => (
      left.sortOrder - right.sortOrder || (left.id < right.id ? -1 : 1)
    ))
}

export function saveFeaturedManagedWorkOrder(
  sqlite: Database.Database,
  items: readonly FeaturedWorkOrderItem[],
  now = Date.now(),
) {
  sqlite.transaction(() => {
    const current = featuredOrderRows(sqlite)
    const submittedIds = items.map(item => item.id)
    const uniqueIds = new Set(submittedIds)
    const currentIds = new Set(current.map(row => row.id))
    const versions = new Map(current.map(row => [row.id, row.version]))
    const sameSet = uniqueIds.size === submittedIds.length
      && submittedIds.length === current.length
      && submittedIds.every(id => currentIds.has(id))
    const versionsMatch = sameSet && items.every(
      item => versions.get(item.id) === item.expectedVersion,
    )
    if (!sameSet || !versionsMatch) {
      throw new ServiceError(
        409,
        'CONFLICT',
        'Featured work order changed.',
        'FEATURED_ORDER_CONFLICT',
      )
    }

    const update = sqlite.prepare(`
      UPDATE works
      SET sort_order = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ? AND featured = 1
    `)
    items.forEach((item, index) => {
      const result = update.run(index, now, item.id, item.expectedVersion)
      if (result.changes !== 1) {
        throw new ServiceError(
          409,
          'CONFLICT',
          'Featured work order changed.',
          'FEATURED_ORDER_CONFLICT',
        )
      }
    })
  })()

  return listFeaturedManagedWorks(sqlite)
}

export function getManagedWork(
  sqlite: Database.Database,
  id: string,
) {
  return managedWork(sqlite, requireWork(sqlite, id))
}

export function createManagedWork(
  sqlite: Database.Database,
  input: WorkFields,
  now = Date.now(),
) {
  const id = randomUUID()
  try {
    sqlite.transaction(() => {
      const featuredIds = input.featured
        ? featuredOrderRows(sqlite).map(row => row.id)
        : []
      const sortOrder = input.featured ? featuredIds.length : 0
      sqlite.prepare(`
        INSERT INTO works (
          id, slug, character_name, species, suit_type, purpose,
          adoption_method, business_status, event_name, event_time,
          owner_display, owner_contact, price_amount_minor, price_currency,
          publication_status, sort_order, featured, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
      `).run(
        id,
        input.slug,
        input.characterName,
        input.species,
        input.suitType,
        input.purpose,
        input.purpose === 'adoption' ? input.adoptionMethod : null,
        input.purpose === 'adoption' ? input.businessStatus : null,
        input.ownerDisplay,
        input.ownerContact,
        input.purpose === 'adoption' ? input.priceCnyMinor : null,
        input.purpose === 'adoption' && input.priceCnyMinor !== null
          ? 'CNY'
          : null,
        sortOrder,
        input.featured ? 1 : 0,
        now,
        now,
      )
      replaceTags(sqlite, id, input.featureTags)
      if (input.featured) {
        normalizeFeaturedRows(sqlite, [...featuredIds, id], now, id)
      }
    })()
  }
  catch (error) {
    translateConstraint(error)
  }
  return getManagedWork(sqlite, id)
}

export function updateManagedWork(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  input: WorkFields,
  now = Date.now(),
) {
  const current = requireWork(sqlite, id)
  if (current.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  if (current.publicationStatus === 'published') {
    throw new ServiceError(409, 'CONFLICT', 'Unpublish the work before editing it.', 'WORK_PUBLISHED_READONLY')
  }
  if (current.purpose === 'adoption' && input.purpose !== 'adoption') {
    const designSheetCount = sqlite.prepare(`
      SELECT count(*) FROM work_assets
      WHERE work_id = ? AND role = 'design_sheet'
    `).pluck().get(id) as number
    if (designSheetCount > 0) {
      throw new ServiceError(
        409,
        'CONFLICT',
        'Remove the design sheet before changing the work purpose.',
      )
    }
  }
  try {
    sqlite.transaction(() => {
      const featuredIds = featuredIdsForMembership(sqlite, id, input.featured)
      const sortOrder = input.featured ? featuredIds.indexOf(id) : 0
      const result = sqlite.prepare(`
        UPDATE works
        SET slug = ?, character_name = ?, species = ?, suit_type = ?,
            purpose = ?, adoption_method = ?, business_status = ?,
            event_name = ?, event_time = ?,
            owner_display = ?, owner_contact = ?,
            price_amount_minor = ?, price_currency = ?,
            sort_order = ?, featured = ?,
            version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND publication_status != 'published'
      `).run(
        input.slug,
        input.characterName,
        input.species,
        input.suitType,
        input.purpose,
        input.purpose === 'adoption' ? input.adoptionMethod : null,
        input.purpose === 'adoption' ? input.businessStatus : null,
        // 只有展会掉落才写展会字段：切换到其他业务类型时这里一律写 NULL，
        // 因此不会留下僵尸值（数据库 CHECK 同样会拒绝残留）。
        eventFieldFor(input, 'eventName'),
        eventFieldFor(input, 'eventTime'),
        input.ownerDisplay,
        input.ownerContact,
        input.purpose === 'adoption' ? input.priceCnyMinor : null,
        input.purpose === 'adoption' && input.priceCnyMinor !== null
          ? 'CNY'
          : null,
        sortOrder,
        input.featured ? 1 : 0,
        now,
        id,
        expectedVersion,
      )
      if (result.changes !== 1) {
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
      }
      replaceTags(sqlite, id, input.featureTags)
      if (current.featured || input.featured) {
        normalizeFeaturedRows(sqlite, featuredIds, now, id)
      }
    })()
  }
  catch (error) {
    if (error instanceof ServiceError) {
      throw error
    }
    translateConstraint(error)
  }
  return getManagedWork(sqlite, id)
}

/** 展示设置不改作品事实或媒体，因此已发布作品也可安全调整。 */
export function updateManagedWorkPresentation(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  input: { featured: boolean, sortOrder?: number | undefined },
  now = Date.now(),
) {
  const current = requireWork(sqlite, id)
  if (current.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  sqlite.transaction(() => {
    const featuredIds = featuredIdsForMembership(sqlite, id, input.featured)
    const sortOrder = input.featured ? featuredIds.indexOf(id) : 0
    const result = sqlite.prepare(`
      UPDATE works
      SET sort_order = ?, featured = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(
      sortOrder,
      input.featured ? 1 : 0,
      now,
      id,
      expectedVersion,
    )
    if (result.changes !== 1) {
      throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
    }
    if (current.featured || input.featured) {
      normalizeFeaturedRows(sqlite, featuredIds, now, id)
    }
  })()
  return getManagedWork(sqlite, id)
}

export async function deleteManagedWork(
  sqlite: Database.Database,
  storage: MediaStorage,
  id: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  const current = requireWork(sqlite, id)
  if (current.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  if (current.publicationStatus === 'published') {
    throw new ServiceError(409, 'CONFLICT', 'Unpublish the work before deleting it.', 'WORK_PUBLISHED_READONLY')
  }
  if (hasBlockingPublicationCleanup(sqlite, 'WORK', id)) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Finish public media cleanup before deleting the work.',
      'PUBLICATION_CLEANUP_PENDING',
    )
  }
  const claimed = sqlite.prepare(`
    UPDATE works SET version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND publication_status != 'published'
  `).run(now, id, expectedVersion)
  if (claimed.changes !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }

  const publicKeys = sqlite.prepare(`
    SELECT variant.object_key
    FROM asset_variants AS variant
    JOIN work_assets AS relation ON relation.asset_id = variant.asset_id
    WHERE relation.work_id = ? AND variant.storage_scope = 'PUBLIC'
  `).pluck().all(id) as string[]

  try {
    for (const key of publicKeys) {
      await storage.deletePublic(key)
      sqlite.prepare(`
        DELETE FROM asset_variants
        WHERE storage_scope = 'PUBLIC' AND object_key = ?
      `).run(key)
    }

    sqlite.transaction(() => {
      const deleted = sqlite.prepare(`
        DELETE FROM works
        WHERE id = ? AND version = ? AND publication_status != 'published'
      `).run(id, expectedVersion + 1)
      if (deleted.changes !== 1) {
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
      }
      sqlite.prepare(`
        INSERT INTO audit_logs (
          id, actor_user_id, action, entity_type, entity_id, result, created_at
        ) VALUES (?, ?, 'WORK_DELETE', 'WORK', ?, 'SUCCESS', ?)
      `).run(randomUUID(), actorUserId, id, now)
      if (current.featured) {
        normalizeFeaturedRows(
          sqlite,
          featuredOrderRows(sqlite).map(row => row.id),
          now,
        )
      }
    })()
  }
  catch (error) {
    if (error instanceof ServiceError) {
      throw error
    }
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Work deletion failed.')
  }

  return { id }
}

function assertReadyWorkAsset(
  sqlite: Database.Database,
  workId: string,
  assetId: string,
  role: 'adoption_cover' | 'design_sheet' | 'studio_photo',
) {
  const select = sqlite.prepare(`
    SELECT
      asset.role, asset.status,
      relation.work_id AS linkedWorkId,
      EXISTS (
        SELECT 1 FROM upload_sessions AS upload
        WHERE upload.asset_id = asset.id
          AND upload.owner_type = 'work'
          AND upload.owner_id = ?
          AND upload.status = 'COMPLETED'
      ) AS ownedByWork
    FROM assets AS asset
    LEFT JOIN work_assets AS relation ON relation.asset_id = asset.id
    WHERE asset.id = ?
  `)
  const row = select.get(workId, assetId) as {
    linkedWorkId: string | null
    ownedByWork: number
    role: string
    status: string
  } | undefined
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Work media asset was not found.')
  }
  if (row.role !== role || row.status !== 'READY' || row.ownedByWork !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Asset role, status or work ownership is invalid.')
  }
  if (row.linkedWorkId !== null && row.linkedWorkId !== workId) {
    throw new ServiceError(409, 'CONFLICT', 'Asset is already linked to a work.', 'ASSET_ALREADY_LINKED')
  }
}

function assertStudioPhotoAssets(
  sqlite: Database.Database,
  workId: string,
  photos: readonly StudioPhotoInput[],
) {
  photos.forEach(photo => assertReadyWorkAsset(
    sqlite,
    workId,
    photo.assetId,
    'studio_photo',
  ))
}

export function replaceManagedDesignSheet(
  sqlite: Database.Database,
  workId: string,
  expectedVersion: number,
  input: DesignSheetInput | null,
  now = Date.now(),
) {
  const current = requireWork(sqlite, workId)
  if (current.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  if (current.purpose !== 'adoption') {
    throw new ServiceError(409, 'CONFLICT', 'Design sheets require an adoption work.')
  }
  if (current.publicationStatus === 'published') {
    throw new ServiceError(409, 'CONFLICT', 'Unpublish the work before editing media.', 'WORK_PUBLISHED_READONLY')
  }
  if (input) {
    assertReadyWorkAsset(sqlite, workId, input.assetId, 'design_sheet')
  }
  try {
    sqlite.transaction(() => {
      sqlite.prepare(`
        DELETE FROM work_assets
        WHERE work_id = ? AND role = 'design_sheet'
      `).run(workId)
      if (input) {
        sqlite.prepare(`
          INSERT INTO work_assets (
            work_id, asset_id, role, alt_text, position, is_primary
          ) VALUES (?, ?, 'design_sheet', ?, 0, 0)
        `).run(workId, input.assetId, input.alt)
      }
      const result = sqlite.prepare(`
        UPDATE works SET version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND publication_status != 'published'
      `).run(now, workId, expectedVersion)
      if (result.changes !== 1) {
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
      }
    })()
  }
  catch (error) {
    if (error instanceof ServiceError) {
      throw error
    }
    translateConstraint(error)
  }
  return getManagedWork(sqlite, workId)
}

export function replaceManagedAdoptionCover(
  sqlite: Database.Database,
  workId: string,
  expectedVersion: number,
  input: AdoptionCoverInput | null,
  now = Date.now(),
) {
  const current = requireWork(sqlite, workId)
  if (current.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  if (current.purpose !== 'adoption') {
    throw new ServiceError(409, 'CONFLICT', 'Adoption covers require an adoption work.')
  }
  if (current.publicationStatus === 'published') {
    throw new ServiceError(409, 'CONFLICT', 'Unpublish the work before editing media.', 'WORK_PUBLISHED_READONLY')
  }
  if (input) {
    assertReadyWorkAsset(sqlite, workId, input.assetId, 'adoption_cover')
  }
  try {
    sqlite.transaction(() => {
      sqlite.prepare(`
        DELETE FROM work_assets
        WHERE work_id = ? AND role = 'adoption_cover'
      `).run(workId)
      if (input) {
        sqlite.prepare(`
          INSERT INTO work_assets (
            work_id, asset_id, role, alt_text, position, is_primary,
            focal_x, focal_y, crop_x, crop_y, crop_width, crop_height
          ) VALUES (?, ?, 'adoption_cover', ?, 0, 0, ?, ?, ?, ?, ?, ?)
        `).run(
          workId,
          input.assetId,
          input.alt,
          input.focalX,
          input.focalY,
          input.crop.x,
          input.crop.y,
          input.crop.width,
          input.crop.height,
        )
        sqlite.prepare(`
          UPDATE assets
          SET focal_x = ?, focal_y = ?, version = version + 1, updated_at = ?
          WHERE id = ? AND status = 'READY' AND role = 'adoption_cover'
        `).run(input.focalX, input.focalY, now, input.assetId)
      }
      const result = sqlite.prepare(`
        UPDATE works SET version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND publication_status != 'published'
      `).run(now, workId, expectedVersion)
      if (result.changes !== 1) {
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
      }
    })()
  }
  catch (error) {
    if (error instanceof ServiceError) {
      throw error
    }
    translateConstraint(error)
  }
  return getManagedWork(sqlite, workId)
}

/** T11: no PII or legacy owner/contact fields leave this review inventory. */
export function listAmbiguousAdoptionStatusReviews(sqlite: Database.Database) {
  return sqlite.prepare(`
    SELECT
      id, character_name AS characterName,
      business_status AS legacyBusinessStatus,
      publication_status AS publicationStatus
    FROM works
    WHERE purpose = 'adoption' AND adoption_status IS NULL
    ORDER BY publication_status = 'published' DESC, character_name, id
  `).all() as Array<{
    characterName: string
    id: string
    legacyBusinessStatus: WorkRow['businessStatus']
    publicationStatus: WorkRow['publicationStatus']
  }>
}

export function replaceManagedStudioPhotos(
  sqlite: Database.Database,
  workId: string,
  expectedVersion: number,
  photos: readonly StudioPhotoInput[],
  now = Date.now(),
) {
  const current = requireWork(sqlite, workId)
  if (current.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  if (current.publicationStatus === 'published') {
    throw new ServiceError(409, 'CONFLICT', 'Unpublish the work before editing media.', 'WORK_PUBLISHED_READONLY')
  }
  assertStudioPhotoAssets(sqlite, workId, photos)
  try {
    sqlite.transaction(() => {
      sqlite.prepare(`
        DELETE FROM work_assets
        WHERE work_id = ? AND role = 'studio_photo'
      `).run(workId)
      const insert = sqlite.prepare(`
        INSERT INTO work_assets (
          work_id, asset_id, role, alt_text, position, is_primary,
          focal_x, focal_y, crop_x, crop_y, crop_width, crop_height,
          watermark_anchor
        ) VALUES (?, ?, 'studio_photo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const updateAssetPresentation = sqlite.prepare(`
        UPDATE assets
        SET focal_x = ?, focal_y = ?, watermark_anchor = ?,
            version = version + 1, updated_at = ?
        WHERE id = ? AND status = 'READY' AND role = 'studio_photo'
      `)
      photos.forEach((photo, position) => {
        insert.run(
          workId,
          photo.assetId,
          photo.alt,
          position,
          photo.primary ? 1 : 0,
          photo.focalX,
          photo.focalY,
          photo.crop.x,
          photo.crop.y,
          photo.crop.width,
          photo.crop.height,
          'top-left',
        )
        updateAssetPresentation.run(
          photo.focalX,
          photo.focalY,
          'top-left',
          now,
          photo.assetId,
        )
      })
      const result = sqlite.prepare(`
        UPDATE works SET version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND publication_status != 'published'
      `).run(now, workId, expectedVersion)
      if (result.changes !== 1) {
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
      }
    })()
  }
  catch (error) {
    if (error instanceof ServiceError) {
      throw error
    }
    translateConstraint(error)
  }
  return getManagedWork(sqlite, workId)
}

export function getPublicSafeWorkPreview(
  sqlite: Database.Database,
  id: string,
): PublicSafeWorkPreviewDto {
  const work = getManagedWork(sqlite, id)
  const safeWork = Object.fromEntries(
    Object.entries(work).filter(([key]) => key !== 'private'),
  )
  return publicSafeWorkPreviewDtoSchema.parse({
    ...safeWork,
    mediaReady: (work.purpose === 'adoption'
      ? work.designSheet !== null
        && work.designSheet.status === 'READY'
        && Boolean(work.designSheet.alt?.trim())
        && (
          work.studioPhotos.length === 0
          || work.studioPhotos.filter(photo => photo.primary).length === 1
        )
      : work.studioPhotos.length > 0
        && work.studioPhotos.filter(photo => photo.primary).length === 1)
      && work.studioPhotos.every(photo =>
        photo.status === 'READY' && photo.alt.trim() !== '',
      ),
  })
}

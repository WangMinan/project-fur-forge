import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  managedWorkDtoSchema,
  publicSafeWorkPreviewDtoSchema,
  workListItemDtoSchema,
} from '../../shared/schemas/work'
import type {
  ManagedWorkDto,
  PublicSafeWorkPreviewDto,
  WatermarkAnchor,
  WorkListItemDto,
} from '../../shared/types/contracts'
import { ServiceError } from './service-error'

interface NonAdoptionWorkInput {
  characterName: string
  featureTags: string[]
  ownerContact: string | null
  ownerDisplay: '有点小狗工作室' | '不公开'
  purpose: 'commission' | 'showcase'
  slug: string
  species: string
  suitType: 'full' | 'partial'
}

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
  watermarkAnchor: WatermarkAnchor
}

interface WorkRow {
  characterName: string
  id: string
  ownerContact: string | null
  ownerDisplay: '有点小狗工作室' | '不公开'
  publicationStatus: 'draft' | 'published' | 'unpublished'
  purpose: 'commission' | 'showcase'
  slug: string
  species: string
  suitType: 'full' | 'partial'
  version: number
}

const selectWork = `
  SELECT
    id, version, slug, character_name AS characterName,
    species, suit_type AS suitType, purpose,
    owner_display AS ownerDisplay, owner_contact AS ownerContact,
    publication_status AS publicationStatus
  FROM works
`

function findWork(sqlite: Database.Database, id: string) {
  return sqlite.prepare(`
    ${selectWork}
    WHERE id = ? AND purpose IN ('commission', 'showcase')
  `).get(id) as WorkRow | undefined
}

function requireWork(sqlite: Database.Database, id: string) {
  const work = findWork(sqlite, id)
  if (!work) {
    throw new ServiceError(404, 'NOT_FOUND', 'Work was not found.')
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

function managedWork(
  sqlite: Database.Database,
  row: WorkRow,
): ManagedWorkDto {
  return managedWorkDtoSchema.parse({
    id: row.id,
    version: row.version,
    slug: row.slug,
    characterName: row.characterName,
    species: row.species,
    suitType: row.suitType,
    purpose: row.purpose,
    ownerDisplay: row.ownerDisplay,
    featureTags: featureTags(sqlite, row.id),
    publicationStatus: row.publicationStatus,
    studioPhotos: studioPhotos(sqlite, row.id),
    private: {
      ownerContact: row.ownerContact,
    },
  })
}

function translateConstraint(error: unknown): never {
  const message = String(error)
  if (message.includes('works.slug') || message.includes('works_slug_unique')) {
    throw new ServiceError(409, 'CONFLICT', 'Work slug is already in use.')
  }
  if (
    message.includes('work_assets_asset_unique')
    || message.includes('UNIQUE constraint failed: work_assets.asset_id')
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Asset is already linked to a work.')
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

export function listManagedWorks(
  sqlite: Database.Database,
): WorkListItemDto[] {
  const rows = sqlite.prepare(`
    SELECT
      work.id, work.version, work.slug,
      work.character_name AS characterName,
      work.species, work.suit_type AS suitType, work.purpose,
      work.owner_display AS ownerDisplay,
      work.publication_status AS publicationStatus,
      count(photo.asset_id) AS studioPhotoCount,
      max(CASE WHEN photo.is_primary = 1 THEN photo.asset_id END) AS primaryAssetId
    FROM works AS work
    LEFT JOIN work_assets AS photo
      ON photo.work_id = work.id AND photo.role = 'studio_photo'
    WHERE work.purpose IN ('commission', 'showcase')
    GROUP BY work.id
    ORDER BY work.updated_at DESC, work.id
  `).all()
  return rows.map(row => workListItemDtoSchema.parse(row))
}

export function getManagedWork(
  sqlite: Database.Database,
  id: string,
) {
  return managedWork(sqlite, requireWork(sqlite, id))
}

export function createManagedWork(
  sqlite: Database.Database,
  input: NonAdoptionWorkInput,
  now = Date.now(),
) {
  const id = randomUUID()
  try {
    sqlite.transaction(() => {
      sqlite.prepare(`
        INSERT INTO works (
          id, slug, character_name, species, suit_type, purpose,
          owner_display, owner_contact, publication_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
      `).run(
        id,
        input.slug,
        input.characterName,
        input.species,
        input.suitType,
        input.purpose,
        input.ownerDisplay,
        input.ownerContact,
        now,
        now,
      )
      replaceTags(sqlite, id, input.featureTags)
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
  input: NonAdoptionWorkInput,
  now = Date.now(),
) {
  const current = requireWork(sqlite, id)
  if (current.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
  }
  if (current.publicationStatus === 'published') {
    throw new ServiceError(409, 'CONFLICT', 'Unpublish the work before editing it.')
  }
  try {
    sqlite.transaction(() => {
      const result = sqlite.prepare(`
        UPDATE works
        SET slug = ?, character_name = ?, species = ?, suit_type = ?,
            purpose = ?, owner_display = ?, owner_contact = ?,
            version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND publication_status != 'published'
      `).run(
        input.slug,
        input.characterName,
        input.species,
        input.suitType,
        input.purpose,
        input.ownerDisplay,
        input.ownerContact,
        now,
        id,
        expectedVersion,
      )
      if (result.changes !== 1) {
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
      }
      replaceTags(sqlite, id, input.featureTags)
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

function assertStudioPhotoAssets(
  sqlite: Database.Database,
  workId: string,
  photos: readonly StudioPhotoInput[],
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
  for (const photo of photos) {
    const row = select.get(workId, photo.assetId) as {
      linkedWorkId: string | null
      ownedByWork: number
      role: string
      status: string
    } | undefined
    if (!row) {
      throw new ServiceError(404, 'NOT_FOUND', 'Studio photo asset was not found.')
    }
    if (
      row.role !== 'studio_photo'
      || row.status !== 'READY'
      || row.ownedByWork !== 1
    ) {
      throw new ServiceError(409, 'CONFLICT', 'Asset is not a ready studio photo for this work.')
    }
    if (row.linkedWorkId !== null && row.linkedWorkId !== workId) {
      throw new ServiceError(409, 'CONFLICT', 'Asset is already linked to a work.')
    }
  }
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
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
  }
  if (current.publicationStatus === 'published') {
    throw new ServiceError(409, 'CONFLICT', 'Unpublish the work before editing media.')
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
          photo.watermarkAnchor,
        )
        updateAssetPresentation.run(
          photo.focalX,
          photo.focalY,
          photo.watermarkAnchor,
          now,
          photo.assetId,
        )
      })
      const result = sqlite.prepare(`
        UPDATE works SET version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND publication_status != 'published'
      `).run(now, workId, expectedVersion)
      if (result.changes !== 1) {
        throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
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
    mediaReady: work.studioPhotos.length > 0
      && work.studioPhotos.filter(photo => photo.primary).length === 1
      && work.studioPhotos.every(photo =>
        photo.status === 'READY' && photo.alt.trim() !== '',
      ),
  })
}

import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  adminHeroPreviewDtoSchema,
  adminHeroSlideDtoSchema,
  adminHomeDtoSchema,
  publicHomeDtoSchema,
} from '../../shared/schemas/home'
import type {
  AdminHeroPreviewDto,
  AdminHeroSlideDto,
  AdminHomeDto,
  PublicationFailureStage,
  PublicationOperationDto,
  PublicHomeDto,
} from '../../shared/types/contracts'
import {
  completeHeroVariants,
  missingHeroVariantCount,
  validateHeroSlidesForPublication,
} from './hero-publication'
import type {
  HeroMediaRole,
} from './hero-publication'
import { toPublicHeroSlideDto } from './media-mapper'
import type {
  HeroSlideRecord,
  VariantRecord,
} from './media-mapper'
import type { MediaStorage } from './media-storage'
import {
  generatePrivateWatermarkPreview,
  generatePublicVariants,
} from './media-recipe'
import { ServiceError } from './service-error'
import { activeWatermarkProfileId } from './watermark-branding'
import { getPublicationOperation } from './work-publication'

export interface HeroSlideInput {
  alt: string
  landscapeAssetId: string
  linkedWorkId: string | null
  portraitAssetId: string
  sortOrder: number
}

export interface HomeSettingsInput {
  autoRotate: boolean
  autoRotateIntervalMs: number
  tagline: string
}

interface HomeRow {
  autoRotate: number
  autoRotateIntervalMs: number
  tagline: string
  version: number
}

interface HeroAssetRow {
  assetId: string
  height: number
  role: HeroMediaRole
  status: string
  uploadedForHome: number
  width: number
}

interface SlideRow {
  alt: string
  enabled: number
  id: string
  landscapeAssetId: string
  landscapeHeight: number
  landscapePrivateObjectKey: string
  landscapeWidth: number
  linkedWorkId: string | null
  linkedWorkSlug: string | null
  linkedWorkStatus: 'draft' | 'published' | 'unpublished' | null
  portraitAssetId: string
  portraitHeight: number
  portraitPrivateObjectKey: string
  portraitWidth: number
  sortOrder: number
  version: number
}

interface HomeOperationRow {
  cleanupObjectKeysJson: string
  entityId: string
  entityType: 'HOME'
  id: string
  operationType: 'PUBLISH'
  requestedVersion: number
  status: string
  version: number
}

interface HeroVariantRow extends VariantRecord {
  assetId: string
}

const selectSlides = `
  SELECT
    slide.id, slide.version, slide.alt_text AS alt,
    slide.sort_order AS sortOrder, slide.enabled,
    slide.landscape_asset_id AS landscapeAssetId,
    landscape.width AS landscapeWidth,
    landscape.height AS landscapeHeight,
    landscape.private_object_key AS landscapePrivateObjectKey,
    slide.portrait_asset_id AS portraitAssetId,
    portrait.width AS portraitWidth,
    portrait.height AS portraitHeight,
    portrait.private_object_key AS portraitPrivateObjectKey,
    slide.linked_work_id AS linkedWorkId,
    linked.slug AS linkedWorkSlug,
    linked.publication_status AS linkedWorkStatus
  FROM site_hero_slides AS slide
  JOIN assets AS landscape ON landscape.id = slide.landscape_asset_id
  JOIN assets AS portrait ON portrait.id = slide.portrait_asset_id
  LEFT JOIN works AS linked ON linked.id = slide.linked_work_id
`

function requireHome(sqlite: Database.Database) {
  const row = sqlite.prepare(`
    SELECT
      version, hero_tagline AS tagline,
      hero_auto_rotate AS autoRotate,
      hero_auto_rotate_interval_ms AS autoRotateIntervalMs
    FROM site_content WHERE id = 'site'
  `).get() as HomeRow | undefined
  if (!row || !row.tagline) {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Home settings are unavailable.')
  }
  return row
}

function requireHomeVersion(sqlite: Database.Database, expectedVersion: number) {
  const home = requireHome(sqlite)
  if (home.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
  }
  return home
}

function slides(sqlite: Database.Database) {
  return sqlite.prepare(`${selectSlides} ORDER BY slide.enabled DESC, slide.sort_order, slide.id`)
    .all() as SlideRow[]
}

function requireSlide(sqlite: Database.Database, id: string) {
  const slide = sqlite.prepare(`${selectSlides} WHERE slide.id = ?`)
    .get(id) as SlideRow | undefined
  if (!slide) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero slide was not found.')
  }
  return slide
}

function variantsForAsset(sqlite: Database.Database, assetId: string) {
  return sqlite.prepare(`
    SELECT
      id, asset_id AS assetId, byte_size AS byteSize,
      storage_scope AS storageScope, status, object_key AS objectKey,
      width, height, format, input_sha256 AS inputSha256,
      internal_error_code AS internalErrorCode,
      logo_digest AS logoDigest, media_role AS mediaRole,
      recipe_version AS recipeVersion, sha256, usage,
      watermark_anchor AS watermarkAnchor,
      watermark_config_digest AS watermarkConfigDigest,
      watermark_opacity_percent AS watermarkOpacityPercent,
      watermark_profile AS watermarkProfile,
      watermark_profile_id AS watermarkProfileId,
      watermark_scale_percent AS watermarkScalePercent
    FROM asset_variants WHERE asset_id = ?
    ORDER BY usage, width, format
  `).all(assetId) as HeroVariantRow[]
}

function latestHomePublicationOperation(
  sqlite: Database.Database,
  slideId: string,
) {
  const id = sqlite.prepare(`
    SELECT id FROM publication_operations
    WHERE entity_type = 'HOME' AND entity_id = ?
      AND operation_type = 'PUBLISH'
    ORDER BY started_at DESC LIMIT 1
  `).pluck().get(slideId) as string | undefined
  if (!id) {
    return null
  }
  const operation = getPublicationOperation(sqlite, id)
  return operation.status === 'DONE' ? null : operation
}

function adminSlide(
  sqlite: Database.Database,
  row: SlideRow,
  profileId: string | null,
): AdminHeroSlideDto {
  const missingVariantCount = profileId
    ? missingHeroVariantCount(
        'home_hero_landscape',
        variantsForAsset(sqlite, row.landscapeAssetId),
        profileId,
      ) + missingHeroVariantCount(
        'home_hero_portrait',
        variantsForAsset(sqlite, row.portraitAssetId),
        profileId,
      )
    : 12
  return adminHeroSlideDtoSchema.parse({
    id: row.id,
    version: row.version,
    alt: row.alt,
    sortOrder: row.sortOrder,
    enabled: row.enabled === 1,
    landscape: {
      assetId: row.landscapeAssetId,
      width: row.landscapeWidth,
      height: row.landscapeHeight,
    },
    portrait: {
      assetId: row.portraitAssetId,
      width: row.portraitWidth,
      height: row.portraitHeight,
    },
    linkedWork: row.linkedWorkId
      ? {
          id: row.linkedWorkId,
          slug: row.linkedWorkSlug,
          publicationStatus: row.linkedWorkStatus,
        }
      : null,
    missingVariantCount,
    publicationOperation: latestHomePublicationOperation(sqlite, row.id),
  })
}

export function getAdminHome(sqlite: Database.Database): AdminHomeDto {
  const home = requireHome(sqlite)
  const profileId = activeWatermarkProfileId(sqlite)
  return adminHomeDtoSchema.parse({
    version: home.version,
    tagline: home.tagline,
    autoRotate: home.autoRotate === 1,
    autoRotateIntervalMs: home.autoRotateIntervalMs,
    slides: slides(sqlite).map(slide => adminSlide(sqlite, slide, profileId)),
  })
}

const HERO_PREVIEW_TTL_MS = 5 * 60 * 1_000

function heroPreviewKey(
  privateObjectKey: string,
  slideId: string,
  orientation: 'landscape' | 'portrait',
) {
  const marker = privateObjectKey.indexOf('/original/')
  if (marker < 1) {
    throw new Error('Hero asset has no environment prefix.')
  }
  return `${privateObjectKey.slice(0, marker)}/preview/home/${slideId}/${orientation}.webp`
}

export async function createHeroSlidePreview(
  sqlite: Database.Database,
  storage: MediaStorage,
  slideId: string,
  expectedVersion: number,
  now = Date.now(),
): Promise<AdminHeroPreviewDto> {
  requireHomeVersion(sqlite, expectedVersion)
  const slide = requireSlide(sqlite, slideId)
  assertAssetPair(sqlite, {
    landscapeAssetId: slide.landscapeAssetId,
    portraitAssetId: slide.portraitAssetId,
  }, slide.id)
  const profileId = activeWatermarkProfileId(sqlite)
  if (!profileId) {
    throw new ServiceError(409, 'CONFLICT', 'Active watermark profile is unavailable.')
  }
  const expiresAt = now + HERO_PREVIEW_TTL_MS
  const preview = async (input: {
    assetId: string
    orientation: 'landscape' | 'portrait'
    privateObjectKey: string
    usage: 'home-hero-landscape' | 'home-hero-portrait'
    width: 480 | 768
  }) => {
    const objectKey = heroPreviewKey(
      input.privateObjectKey,
      slide.id,
      input.orientation,
    )
    const dimensions = await generatePrivateWatermarkPreview(
      sqlite,
      storage,
      {
        assetId: input.assetId,
        objectKey,
        profileId,
        usage: input.usage,
        width: input.width,
      },
    )
    return {
      ...await storage.signPrivateGet(objectKey, expiresAt),
      width: dimensions.width,
      height: dimensions.height,
    }
  }
  const [landscape, portrait] = await Promise.all([
    preview({
      assetId: slide.landscapeAssetId,
      orientation: 'landscape',
      privateObjectKey: slide.landscapePrivateObjectKey,
      usage: 'home-hero-landscape',
      width: 768,
    }),
    preview({
      assetId: slide.portraitAssetId,
      orientation: 'portrait',
      privateObjectKey: slide.portraitPrivateObjectKey,
      usage: 'home-hero-portrait',
      width: 480,
    }),
  ])
  requireHomeVersion(sqlite, expectedVersion)
  if (activeWatermarkProfileId(sqlite) !== profileId) {
    throw new ServiceError(409, 'CONFLICT', 'Active watermark profile changed.')
  }
  return adminHeroPreviewDtoSchema.parse({ landscape, portrait })
}

export function getPublicHome(
  sqlite: Database.Database,
  mediaBaseUrl: string,
): PublicHomeDto {
  const home = requireHome(sqlite)
  const enabled = slides(sqlite).filter(slide => slide.enabled === 1)
  const profileId = activeWatermarkProfileId(sqlite)
  if (enabled.length > 0 && !profileId) {
    throw new Error('Active watermark profile is unavailable.')
  }
  const projected = enabled.map((slide) => {
    const record: HeroSlideRecord = {
      activeWatermarkProfileId: profileId!,
      id: slide.id,
      version: slide.version,
      enabled: true,
      altText: slide.alt,
      sortOrder: slide.sortOrder,
      landscapeVariants: variantsForAsset(sqlite, slide.landscapeAssetId),
      portraitVariants: variantsForAsset(sqlite, slide.portraitAssetId),
      linkedWork: slide.linkedWorkId
        ? {
            publicationStatus: slide.linkedWorkStatus!,
            slug: slide.linkedWorkSlug!,
          }
        : null,
    }
    const dto = toPublicHeroSlideDto(record, mediaBaseUrl)
    if (!dto) {
      throw new Error('Enabled hero slide could not be projected.')
    }
    return dto
  })
  return publicHomeDtoSchema.parse({
    tagline: home.tagline,
    autoRotate: home.autoRotate === 1,
    autoRotateIntervalMs: home.autoRotateIntervalMs,
    slides: projected,
  })
}

function claimHomeVersion(
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
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
  }
}

function heroAsset(
  sqlite: Database.Database,
  assetId: string,
): HeroAssetRow | undefined {
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

function assertAssetPair(
  sqlite: Database.Database,
  input: Pick<HeroSlideInput, 'landscapeAssetId' | 'portraitAssetId'>,
  exceptSlideId?: string,
) {
  if (input.landscapeAssetId === input.portraitAssetId) {
    throw new ServiceError(409, 'CONFLICT', 'Hero assets must be distinct.')
  }
  const landscape = heroAsset(sqlite, input.landscapeAssetId)
  const portrait = heroAsset(sqlite, input.portraitAssetId)
  if (!landscape || !portrait) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero asset was not found.')
  }
  if (
    landscape.role !== 'home_hero_landscape'
    || landscape.status !== 'READY'
    || landscape.width <= landscape.height
    || landscape.uploadedForHome !== 1
    || portrait.role !== 'home_hero_portrait'
    || portrait.status !== 'READY'
    || portrait.height <= portrait.width
    || portrait.uploadedForHome !== 1
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Hero assets are not publication-ready.')
  }
  const used = sqlite.prepare(`
    SELECT 1 FROM site_hero_slides
    WHERE id != COALESCE(?, '')
      AND (
        landscape_asset_id IN (?, ?)
        OR portrait_asset_id IN (?, ?)
      )
    LIMIT 1
  `).pluck().get(
    exceptSlideId ?? null,
    input.landscapeAssetId,
    input.portraitAssetId,
    input.landscapeAssetId,
    input.portraitAssetId,
  )
  if (used) {
    throw new ServiceError(409, 'CONFLICT', 'Hero asset is already assigned.')
  }
}

function assertLinkedWork(sqlite: Database.Database, linkedWorkId: string | null) {
  if (!linkedWorkId) {
    return
  }
  const published = sqlite.prepare(`
    SELECT 1 FROM works
    WHERE id = ? AND publication_status = 'published'
  `).pluck().get(linkedWorkId)
  if (!published) {
    throw new ServiceError(409, 'CONFLICT', 'Linked work must be published.')
  }
}

function translateHomeConstraint(error: unknown): never {
  if (error instanceof ServiceError) {
    throw error
  }
  const message = String(error)
  if (message.includes('UNIQUE') || message.includes('hero slide')) {
    throw new ServiceError(409, 'CONFLICT', 'Home content changed or conflicts.')
  }
  throw error
}

export function createHeroSlide(
  sqlite: Database.Database,
  expectedVersion: number,
  input: HeroSlideInput,
  now = Date.now(),
) {
  requireHomeVersion(sqlite, expectedVersion)
  assertAssetPair(sqlite, input)
  assertLinkedWork(sqlite, input.linkedWorkId)
  try {
    sqlite.transaction(() => {
      claimHomeVersion(sqlite, expectedVersion, now)
      sqlite.prepare(`
        INSERT INTO site_hero_slides (
          id, landscape_asset_id, portrait_asset_id, alt_text,
          sort_order, enabled, linked_work_id, version,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, ?)
      `).run(
        randomUUID(),
        input.landscapeAssetId,
        input.portraitAssetId,
        input.alt,
        input.sortOrder,
        input.linkedWorkId,
        now,
        now,
      )
    })()
  }
  catch (error) {
    translateHomeConstraint(error)
  }
  return getAdminHome(sqlite)
}

export function updateHeroSlide(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  input: HeroSlideInput,
  now = Date.now(),
) {
  requireHomeVersion(sqlite, expectedVersion)
  const current = requireSlide(sqlite, id)
  if (current.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Disable the hero slide before editing it.')
  }
  assertAssetPair(sqlite, input, id)
  assertLinkedWork(sqlite, input.linkedWorkId)
  try {
    sqlite.transaction(() => {
      claimHomeVersion(sqlite, expectedVersion, now)
      sqlite.prepare(`
        UPDATE site_hero_slides
        SET landscape_asset_id = ?, portrait_asset_id = ?, alt_text = ?,
            sort_order = ?, linked_work_id = ?, version = version + 1,
            updated_at = ?
        WHERE id = ? AND enabled = 0
      `).run(
        input.landscapeAssetId,
        input.portraitAssetId,
        input.alt,
        input.sortOrder,
        input.linkedWorkId,
        now,
        id,
      )
    })()
  }
  catch (error) {
    translateHomeConstraint(error)
  }
  return getAdminHome(sqlite)
}

export function deleteHeroSlide(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  now = Date.now(),
) {
  requireHomeVersion(sqlite, expectedVersion)
  if (requireSlide(sqlite, id).enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Disable the hero slide before deleting it.')
  }
  sqlite.transaction(() => {
    claimHomeVersion(sqlite, expectedVersion, now)
    sqlite.prepare('DELETE FROM site_hero_slides WHERE id = ? AND enabled = 0')
      .run(id)
  })()
  return getAdminHome(sqlite)
}

export function updateHomeSettings(
  sqlite: Database.Database,
  expectedVersion: number,
  input: HomeSettingsInput,
  now = Date.now(),
) {
  const result = sqlite.prepare(`
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
  )
  if (result.changes !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
  }
  return getAdminHome(sqlite)
}

export function reorderEnabledHeroSlides(
  sqlite: Database.Database,
  expectedVersion: number,
  slideIds: readonly string[],
  now = Date.now(),
) {
  requireHomeVersion(sqlite, expectedVersion)
  const enabledIds = slides(sqlite)
    .filter(slide => slide.enabled === 1)
    .map(slide => slide.id)
  if (
    slideIds.length < 1
    || slideIds.length > 5
    || new Set(slideIds).size !== slideIds.length
    || slideIds.length !== enabledIds.length
    || slideIds.some(id => !enabledIds.includes(id))
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Enabled hero slide order is stale.')
  }
  sqlite.transaction(() => {
    claimHomeVersion(sqlite, expectedVersion, now)
    sqlite.prepare('UPDATE site_hero_slides SET enabled = 0 WHERE enabled = 1').run()
    const update = sqlite.prepare(`
      UPDATE site_hero_slides
      SET sort_order = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND enabled = 0
    `)
    slideIds.forEach((id, index) => update.run(index, now, id))
    const enable = sqlite.prepare(`
      UPDATE site_hero_slides SET enabled = 1 WHERE id = ?
    `)
    slideIds.forEach(id => enable.run(id))
    validateHeroSlidesForPublication(sqlite)
  })()
  return getAdminHome(sqlite)
}

export function disableHeroSlide(
  sqlite: Database.Database,
  id: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
) {
  requireHomeVersion(sqlite, expectedVersion)
  const slide = requireSlide(sqlite, id)
  if (slide.enabled !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Hero slide is already disabled.')
  }
  const enabledCount = Number(sqlite.prepare(`
    SELECT count(*) FROM site_hero_slides WHERE enabled = 1
  `).pluck().get())
  if (enabledCount <= 1) {
    throw new ServiceError(409, 'CONFLICT', 'At least one hero slide must remain enabled.')
  }
  sqlite.transaction(() => {
    claimHomeVersion(sqlite, expectedVersion, now)
    sqlite.prepare(`
      UPDATE site_hero_slides
      SET enabled = 0, version = version + 1, updated_at = ?
      WHERE id = ? AND enabled = 1
    `).run(now, id)
    sqlite.prepare(`
      INSERT INTO audit_logs (
        id, actor_user_id, action, entity_type, entity_id, result, created_at
      ) VALUES (?, ?, 'HOME_HERO_DISABLE', 'HOME', ?, 'SUCCESS', ?)
    `).run(randomUUID(), actorUserId, id, now)
  })()
  return getAdminHome(sqlite)
}

function assertSlideCanEnable(sqlite: Database.Database, slide: SlideRow) {
  if (slide.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Hero slide is already enabled.')
  }
  if (slide.sortOrder < 0 || slide.sortOrder > 4) {
    throw new ServiceError(409, 'CONFLICT', 'Enabled hero slide order must be between 0 and 4.')
  }
  const enabledCount = Number(sqlite.prepare(`
    SELECT count(*) FROM site_hero_slides WHERE enabled = 1
  `).pluck().get())
  const orderConflict = sqlite.prepare(`
    SELECT 1 FROM site_hero_slides
    WHERE enabled = 1 AND sort_order = ? LIMIT 1
  `).pluck().get(slide.sortOrder)
  if (enabledCount >= 5 || orderConflict) {
    throw new ServiceError(409, 'CONFLICT', 'Enabled hero slides must have 1 to 5 unique positions.')
  }
  assertAssetPair(sqlite, {
    landscapeAssetId: slide.landscapeAssetId,
    portraitAssetId: slide.portraitAssetId,
  }, slide.id)
  assertLinkedWork(sqlite, slide.linkedWorkId)
  if (!activeWatermarkProfileId(sqlite)) {
    throw new ServiceError(409, 'CONFLICT', 'Active watermark profile is unavailable.')
  }
}

function homeOperation(sqlite: Database.Database, id: string) {
  const row = sqlite.prepare(`
    SELECT
      id, operation_type AS operationType, entity_type AS entityType,
      entity_id AS entityId, requested_version AS requestedVersion,
      status, cleanup_object_keys_json AS cleanupObjectKeysJson, version
    FROM publication_operations
    WHERE id = ? AND entity_type = 'HOME' AND operation_type = 'PUBLISH'
  `).get(id) as HomeOperationRow | undefined
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Home publication operation was not found.')
  }
  return row
}

export function startHeroSlidePublication(
  sqlite: Database.Database,
  slideId: string,
  expectedVersion: number,
  now = Date.now(),
): PublicationOperationDto {
  requireHomeVersion(sqlite, expectedVersion)
  assertSlideCanEnable(sqlite, requireSlide(sqlite, slideId))
  const active = sqlite.prepare(`
    SELECT 1 FROM publication_operations
    WHERE entity_type = 'HOME' AND entity_id = ?
      AND status NOT IN ('FAILED', 'DONE')
  `).pluck().get(slideId)
  if (active) {
    throw new ServiceError(409, 'CONFLICT', 'A home publication operation is already active.')
  }
  const id = randomUUID()
  sqlite.prepare(`
    INSERT INTO publication_operations (
      id, operation_type, entity_type, entity_id, requested_version,
      status, started_at, updated_at
    ) VALUES (?, 'PUBLISH', 'HOME', ?, ?, 'GENERATING_PUBLIC', ?, ?)
  `).run(id, slideId, expectedVersion, now, now)
  return getPublicationOperation(sqlite, id)
}

function setOperationStatus(
  sqlite: Database.Database,
  id: string,
  status: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET status = ?, failure_stage = NULL, internal_error_code = NULL,
        internal_error_message = NULL, cleanup_object_keys_json = '[]',
        version = version + 1, updated_at = ?
    WHERE id = ?
  `).run(status, now, id)
}

function publicKeysForSlide(sqlite: Database.Database, slide: SlideRow) {
  return sqlite.prepare(`
    SELECT object_key FROM asset_variants
    WHERE storage_scope = 'PUBLIC'
      AND asset_id IN (?, ?)
  `).pluck().all(
    slide.landscapeAssetId,
    slide.portraitAssetId,
  ) as string[]
}

async function cleanPublicKeys(
  sqlite: Database.Database,
  storage: MediaStorage,
  keys: readonly string[],
) {
  const remaining: string[] = []
  for (const key of keys) {
    try {
      await storage.deletePublic(key)
      sqlite.prepare(`
        DELETE FROM asset_variants
        WHERE storage_scope = 'PUBLIC' AND object_key = ?
      `).run(key)
    }
    catch {
      remaining.push(key)
    }
  }
  return remaining
}

function failHomeOperation(
  sqlite: Database.Database,
  id: string,
  stage: PublicationFailureStage,
  code: string,
  cleanupKeys: readonly string[],
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET status = 'FAILED', failure_stage = ?, internal_error_code = ?,
        internal_error_message = 'Home publication failed.',
        cleanup_object_keys_json = ?, version = version + 1,
        updated_at = ?, completed_at = ?
    WHERE id = ?
  `).run(stage, code, JSON.stringify(cleanupKeys), now, now, id)
}

function assertCompleteHeroPair(
  sqlite: Database.Database,
  slide: SlideRow,
) {
  const profileId = activeWatermarkProfileId(sqlite)
  if (!profileId) {
    throw new Error('Active watermark profile is unavailable.')
  }
  completeHeroVariants(
    'home_hero_landscape',
    variantsForAsset(sqlite, slide.landscapeAssetId),
    profileId,
  )
  completeHeroVariants(
    'home_hero_portrait',
    variantsForAsset(sqlite, slide.portraitAssetId),
    profileId,
  )
}

export async function runHeroSlidePublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now = Date.now(),
) {
  const operation = homeOperation(sqlite, operationId)
  if (operation.status === 'DONE' || operation.status === 'FAILED') {
    return getPublicationOperation(sqlite, operationId)
  }
  const slide = requireSlide(sqlite, operation.entityId)
  const before = new Set(publicKeysForSlide(sqlite, slide))
  let stage: PublicationFailureStage = 'VALIDATING'
  let code = 'HOME_PUBLICATION_VALIDATION_FAILED'
  try {
    requireHomeVersion(sqlite, operation.requestedVersion)
    assertSlideCanEnable(sqlite, slide)
    stage = 'APPLYING_WATERMARK'
    code = 'PUBLIC_MEDIA_GENERATION_FAILED'
    setOperationStatus(sqlite, operationId, 'APPLYING_WATERMARK', now)
    await generatePublicVariants(
      sqlite,
      storage,
      slide.landscapeAssetId,
      ['home-hero-landscape'],
      now,
    )
    await generatePublicVariants(
      sqlite,
      storage,
      slide.portraitAssetId,
      ['home-hero-portrait'],
      now,
    )
    stage = 'VERIFYING_PUBLIC'
    code = 'PUBLIC_MEDIA_VERIFICATION_FAILED'
    setOperationStatus(sqlite, operationId, 'VERIFYING_PUBLIC', now)
    assertCompleteHeroPair(sqlite, slide)
    stage = 'COMMITTING'
    code = 'HOME_PUBLICATION_COMMIT_FAILED'
    setOperationStatus(sqlite, operationId, 'COMMITTING', now)
    sqlite.transaction(() => {
      requireHomeVersion(sqlite, operation.requestedVersion)
      assertSlideCanEnable(sqlite, requireSlide(sqlite, slide.id))
      claimHomeVersion(sqlite, operation.requestedVersion, now)
      sqlite.prepare(`
        UPDATE site_hero_slides
        SET enabled = 1, version = version + 1, updated_at = ?
        WHERE id = ? AND enabled = 0
      `).run(now, slide.id)
      validateHeroSlidesForPublication(sqlite)
      sqlite.prepare(`
        UPDATE publication_operations
        SET status = 'DONE', failure_stage = NULL,
            internal_error_code = NULL, internal_error_message = NULL,
            cleanup_object_keys_json = '[]', version = version + 1,
            updated_at = ?, completed_at = ?
        WHERE id = ? AND status = 'COMMITTING'
      `).run(now, now, operationId)
      sqlite.prepare(`
        INSERT INTO audit_logs (
          id, actor_user_id, action, entity_type, entity_id, result, created_at
        ) VALUES (?, ?, 'HOME_HERO_ENABLE', 'HOME', ?, 'SUCCESS', ?)
      `).run(randomUUID(), actorUserId, slide.id, now)
    })()
  }
  catch {
    const generated = publicKeysForSlide(sqlite, slide)
      .filter(key => !before.has(key))
    const remaining = await cleanPublicKeys(sqlite, storage, generated)
    failHomeOperation(
      sqlite,
      operationId,
      remaining.length > 0 ? 'CLEANING_PUBLIC' : stage,
      remaining.length > 0 ? 'PUBLIC_CLEANUP_FAILED' : code,
      remaining,
      now,
    )
  }
  return getPublicationOperation(sqlite, operationId)
}

export async function retryHeroSlidePublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  expectedVersion: number,
  now = Date.now(),
) {
  const operation = homeOperation(sqlite, operationId)
  if (operation.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
  }
  if (operation.status !== 'FAILED') {
    throw new ServiceError(409, 'CONFLICT', 'Home publication is not retryable.')
  }
  requireHomeVersion(sqlite, operation.requestedVersion)
  const cleanup = JSON.parse(operation.cleanupObjectKeysJson) as unknown
  if (!Array.isArray(cleanup) || cleanup.some(key => typeof key !== 'string')) {
    throw new Error('Home cleanup manifest is invalid.')
  }
  const remaining = await cleanPublicKeys(sqlite, storage, cleanup)
  if (remaining.length > 0) {
    failHomeOperation(
      sqlite,
      operationId,
      'CLEANING_PUBLIC',
      'PUBLIC_CLEANUP_FAILED',
      remaining,
      now,
    )
    return getPublicationOperation(sqlite, operationId)
  }
  sqlite.prepare(`
    UPDATE publication_operations
    SET status = 'GENERATING_PUBLIC', failure_stage = NULL,
        internal_error_code = NULL, internal_error_message = NULL,
        cleanup_object_keys_json = '[]', completed_at = NULL,
        version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND status = 'FAILED'
  `).run(now, operationId, expectedVersion)
  return getPublicationOperation(sqlite, operationId)
}

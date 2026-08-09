import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  adminHeroPreviewDtoSchema,
  adminHeroSlideDtoSchema,
  adminHomeDtoSchema,
  publicCommissionHeroDtoSchema,
  publicHomeDtoSchema,
} from '../../../shared/schemas/home'
import type {
  AdminHeroPreviewDto,
  AdminHeroSlideDto,
  AdminHomeDto,
  HeroPlacement,
  HomeEntryKind,
  PublicationFailureStage,
  PublicationOperationDto,
  PublicCommissionHeroDto,
  PublicHomeDto,
} from '../../../shared/types/contracts'
import {
  validateHeroSlidesForPublication,
} from '../recipe/hero-publication'
import {
  claimHomeVersion,
  clearSlidePreviewKeys,
  countEnabledSlides,
  deleteDisabledSlide,
  findHeroAsset,
  findHome,
  findPublicKeysForSlide,
  findSlide,
  findSlides,
  findSystemRecoveryActorId,
  findVariantsForAssets,
  hasEnabledSlideAtOrder,
  insertHomeAuditLog,
  insertSlide,
  isHeroAssetAssigned,
  isWorkPublished,
  replaceEnabledOrder,
  setSlideEnabled,
  setSlidePreviewKeys,
  updateDisabledSlide,
  updateHomeSettingsRow,
} from '../repository/hero-repository'
import type {
  HeroVariantRow,
  SlideRow,
} from '../repository/hero-repository'
// T34-F4：公开变体行删除只有一处定义，在 publication-repository。
import {
  completeOperation,
  deletePublicVariant,
  findPublicationOperation,
  hasActivePublicationOperation,
  insertPublicationOperation,
  markOperationFailed,
  markVariantsCleanupPending,
  resetFailedPublicationOperation,
  setOperationCleanupKeys,
  setOperationEdgePurgeManifest,
  updateOperationStatus,
} from '../repository/publication-repository'
import type { OperationRow } from '../repository/publication-repository'
import {
  assetSupportsSiteDisplay,
  generateSiteDisplayVariants,
  HOME_ENTRY_USAGES,
  missingSiteDisplayVariantCount,
  SITE_HERO_USAGES,
} from '../recipe/site-display-recipe'
import {
  homeEntrySource,
  projectHomeEntry,
} from '../service/site-entry'
import { toPublicHeroSlideDto } from '../recipe/media-mapper'
import type { HeroSlideRecord } from '../recipe/media-mapper'
import type { MediaStorage } from '../media-storage'
import type { RuntimeConfig } from '../runtime-config'
import { getPublicMediaCache } from '../public-media-cache'
import {
  ensureHeroUpscaleSource,
  generatePrivateWatermarkPreview,
} from '../recipe/media-recipe'
import { HERO_UPSCALE_RECIPE_VERSION } from '../recipe/media-source'
import {
  assertOperationLease,
  claimOperationLease,
  heartbeatOperationLease,
  holdsOperationLease,
  releaseOperationLease,
} from '../repository/operation-lease'
import type { OperationLease } from '../repository/operation-lease'
import { registerOperationResumer } from './operation-recovery'
import {
  edgePurgeUrlsForObjectKeys,
  runOperationEdgePurge,
} from './public-media-purge'
import { ServiceError } from '../service-error'
import { activeWatermarkProfileId } from './watermark-branding'
import {
  getLatestPublicationOperations,
  getPublicationOperation,
} from './work-publication'

export interface HeroSlideInput {
  alt: string
  landscapeAssetId: string
  linkedWorkId: string | null
  portraitAssetId: string
  sortOrder: number
}

/** T34-F3：首屏设置不再包含官方邮箱与 QQ，它们属于 contact 分区。 */
export interface HomeSettingsInput {
  autoRotate: boolean
  autoRotateIntervalMs: number
  tagline: string
}

/**
 * T34-F4：SQL、行映射与条件更新已移入 hero-repository。
 * 本文件保留 service（业务规则、DTO 组合、事务入口）与 runner（operation、
 * OSS 副作用、阶段推进、心跳、失败与清理）。
 */

function requireHome(sqlite: Database.Database) {
  const row = findHome(sqlite)
  if (!row || !row.tagline || !row.contactEmail || !row.contactQq) {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Home settings are unavailable.')
  }
  return row
}

function requireHomeVersion(sqlite: Database.Database, expectedVersion: number) {
  const home = requireHome(sqlite)
  if (home.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  return home
}

function slides(
  sqlite: Database.Database,
  placement: HeroPlacement = 'home',
) {
  return findSlides(sqlite, placement)
}

function requireSlide(
  sqlite: Database.Database,
  id: string,
  placement?: HeroPlacement,
) {
  const slide = findSlide(sqlite, id, placement)
  if (!slide) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero slide was not found.')
  }
  return slide
}

function variantsForAssets(
  sqlite: Database.Database,
  assetIds: readonly string[],
) {
  return findVariantsForAssets(sqlite, assetIds)
}

function variantsForAsset(sqlite: Database.Database, assetId: string) {
  return variantsForAssets(sqlite, [assetId]).get(assetId) ?? []
}

function hasUpscaleVariant(
  variants: readonly HeroVariantRow[],
  inputSha256: string,
  width: number,
  height: number,
) {
  return variants.some(variant => (
    variant.storageScope === 'PRIVATE'
    && variant.status === 'READY'
    && variant.usage === 'preprocess'
    && variant.recipeVersion === HERO_UPSCALE_RECIPE_VERSION
    && variant.inputSha256 === inputSha256
    && variant.byteSize !== null
    && variant.byteSize <= 20_000_000
    && variant.width === width
    && variant.height === height
  ))
}

function assetUpscaleReadyFromVariants(
  asset: Pick<SlideRow,
    | 'landscapeAssetId' | 'landscapeHeight' | 'landscapeSha256' | 'landscapeWidth'
    | 'portraitAssetId' | 'portraitHeight' | 'portraitSha256' | 'portraitWidth'>,
  variants: ReadonlyMap<string, readonly HeroVariantRow[]>,
) {
  const landscapeReady = (
    asset.landscapeWidth >= 1920 && asset.landscapeHeight >= 1080
  ) || hasUpscaleVariant(
    variants.get(asset.landscapeAssetId) ?? [],
    asset.landscapeSha256,
    1920,
    1080,
  )
  const portraitReady = (
    asset.portraitWidth >= 1080 && asset.portraitHeight >= 1920
  ) || hasUpscaleVariant(
    variants.get(asset.portraitAssetId) ?? [],
    asset.portraitSha256,
    1080,
    1920,
  )
  return landscapeReady && portraitReady
}

function assetUpscaleReady(
  sqlite: Database.Database,
  asset: SlideRow,
) {
  return assetUpscaleReadyFromVariants(asset, variantsForAssets(sqlite, [
    asset.landscapeAssetId,
    asset.portraitAssetId,
  ]))
}

function missingSiteHeroVariants(
  row: SlideRow,
  variants: ReadonlyMap<string, readonly HeroVariantRow[]>,
) {
  const usages = SITE_HERO_USAGES[row.placement]
  return missingSiteDisplayVariantCount(
    usages.landscape,
    variants.get(row.landscapeAssetId) ?? [],
  ) + missingSiteDisplayVariantCount(
    usages.portrait,
    variants.get(row.portraitAssetId) ?? [],
  )
}

function adminSlide(
  row: SlideRow,
  variants: ReadonlyMap<string, readonly HeroVariantRow[]>,
  operations: ReadonlyMap<string, PublicationOperationDto>,
): AdminHeroSlideDto {
  const missingVariantCount = missingSiteHeroVariants(row, variants)
  const publicationOperation = [
    operations.get(`${row.id}:PUBLISH`),
    operations.get(`${row.id}:UNPUBLISH`),
  ]
    .filter((operation): operation is PublicationOperationDto => (
      operation !== undefined && operation.status !== 'DONE'
    ))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]
    ?? null
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
    upscaleReady: assetUpscaleReadyFromVariants(row, variants),
    upscaleOperation: operations.get(`${row.id}:UPSCALE`) ?? null,
    missingVariantCount,
    publicationOperation,
  })
}

export function getAdminHome(
  sqlite: Database.Database,
  placement: HeroPlacement = 'home',
): AdminHomeDto {
  const home = requireHome(sqlite)
  const currentSlides = slides(sqlite, placement)
  const variants = variantsForAssets(
    sqlite,
    currentSlides.flatMap(slide => [
      slide.landscapeAssetId,
      slide.portraitAssetId,
    ]),
  )
  const operations = new Map(getLatestPublicationOperations(
    sqlite,
    'HOME',
    currentSlides.map(slide => slide.id),
  ).map(operation => [
    `${operation.entityId}:${operation.operationType}`,
    operation,
  ]))
  return adminHomeDtoSchema.parse({
    version: home.version,
    tagline: home.tagline,
    contactEmail: home.contactEmail,
    contactQq: home.contactQq,
    autoRotate: home.autoRotate === 1,
    autoRotateIntervalMs: home.autoRotateIntervalMs,
    slides: currentSlides.map(slide => adminSlide(
      slide,
      variants,
      operations,
    )),
  })
}

const HERO_PREVIEW_TTL_MS = 5 * 60 * 1_000

function heroPreviewKey(
  privateObjectKey: string,
  slideId: string,
  placement: HeroPlacement,
  orientation: 'landscape' | 'portrait',
) {
  const marker = privateObjectKey.indexOf('/original/')
  if (marker < 1) {
    throw new Error('Hero asset has no environment prefix.')
  }
  return `${privateObjectKey.slice(0, marker)}/preview/${placement}/${slideId}/${orientation}.webp`
}

export async function createHeroSlidePreview(
  sqlite: Database.Database,
  storage: MediaStorage,
  slideId: string,
  expectedVersion: number,
  now = Date.now(),
  placement: HeroPlacement = 'home',
): Promise<AdminHeroPreviewDto> {
  requireHomeVersion(sqlite, expectedVersion)
  const slide = requireSlide(sqlite, slideId, placement)
  if (slide.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Disable the hero slide before previewing it.', 'HERO_SLIDE_ENABLED')
  }
  assertAssetPair(sqlite, {
    landscapeAssetId: slide.landscapeAssetId,
    portraitAssetId: slide.portraitAssetId,
  }, slide.id)
  const profileId = activeWatermarkProfileId(sqlite)
  if (!profileId) {
    throw new ServiceError(409, 'CONFLICT', 'Active watermark profile is unavailable.', 'WATERMARK_PROFILE_UNAVAILABLE')
  }
  const expiresAt = now + HERO_PREVIEW_TTL_MS
  const landscapeObjectKey = heroPreviewKey(
    slide.landscapePrivateObjectKey,
    slide.id,
    placement,
    'landscape',
  )
  const portraitObjectKey = heroPreviewKey(
    slide.portraitPrivateObjectKey,
    slide.id,
    placement,
    'portrait',
  )
  setSlidePreviewKeys(sqlite, slide.id, {
    expiresAt,
    landscapeObjectKey,
    portraitObjectKey,
  })
  const preview = async (input: {
    assetId: string
    orientation: 'landscape' | 'portrait'
    usage: 'home-hero-landscape' | 'home-hero-portrait'
    width: 480 | 768
  }) => {
    const objectKey = input.orientation === 'landscape'
      ? landscapeObjectKey
      : portraitObjectKey
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
      url: `/api/admin/v1/site/home/slides/${slide.id}/preview/${input.orientation}${placement === 'commission' ? '?placement=commission' : ''}`,
      expiresAt: new Date(expiresAt).toISOString(),
      width: dimensions.width,
      height: dimensions.height,
    }
  }
  const [landscape, portrait] = await Promise.all([
    preview({
      assetId: slide.landscapeAssetId,
      orientation: 'landscape',
      usage: 'home-hero-landscape',
      width: 768,
    }),
    preview({
      assetId: slide.portraitAssetId,
      orientation: 'portrait',
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

export function startHeroSlideUpscale(
  sqlite: Database.Database,
  slideId: string,
  expectedVersion: number,
  now = Date.now(),
  placement: HeroPlacement = 'home',
): PublicationOperationDto {
  requireHomeVersion(sqlite, expectedVersion)
  const slide = requireSlide(sqlite, slideId, placement)
  if (slide.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Enabled hero slides cannot be upscaled.', 'HERO_SLIDE_ENABLED')
  }
  assertAssetPair(sqlite, {
    landscapeAssetId: slide.landscapeAssetId,
    portraitAssetId: slide.portraitAssetId,
  }, slide.id)
  if (assetUpscaleReady(sqlite, slide)) {
    throw new ServiceError(409, 'CONFLICT', 'Hero assets are already ready.')
  }
  const active = sqlite.prepare(`
    SELECT 1 FROM publication_operations
    WHERE entity_type = 'HOME' AND entity_id = ?
      AND status NOT IN ('FAILED', 'DONE')
    LIMIT 1
  `).pluck().get(slideId)
  if (active) {
    throw new ServiceError(409, 'CONFLICT', 'A home operation is already active.', 'ACTIVE_OPERATION_EXISTS')
  }
  const id = randomUUID()
  sqlite.prepare(`
    INSERT INTO publication_operations (
      id, operation_type, entity_type, entity_id, requested_version,
      status, started_at, updated_at
    ) VALUES (?, 'UPSCALE', 'HOME', ?, ?, 'PREPARING_SOURCE', ?, ?)
  `).run(id, slideId, expectedVersion, now, now)
  return getPublicationOperation(sqlite, id)
}

function upscaleOperation(sqlite: Database.Database, id: string) {
  const operationType = sqlite.prepare(`
    SELECT operation_type FROM publication_operations
    WHERE id = ? AND entity_type = 'HOME'
  `).pluck().get(id)
  if (operationType !== 'UPSCALE') {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero upscale operation was not found.')
  }
  return getPublicationOperation(sqlite, id)
}

function failUpscaleOperation(
  sqlite: Database.Database,
  id: string,
  code: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE publication_operations
    SET status = 'FAILED', failure_stage = 'PREPARING_SOURCE',
        internal_error_code = ?, internal_error_message = 'Hero upscale failed.',
        cleanup_object_keys_json = '[]', version = version + 1,
        updated_at = ?, completed_at = ?
    WHERE id = ? AND operation_type = 'UPSCALE'
  `).run(code, now, now, id)
}

export async function runHeroSlideUpscale(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now = Date.now(),
) {
  const operation = upscaleOperation(sqlite, operationId)
  if (operation.status === 'DONE' || operation.status === 'FAILED') {
    return operation
  }
  const lease = claimOperationLease(sqlite, 'publication_operations', operationId, now)
  if (!lease) {
    return getPublicationOperation(sqlite, operationId)
  }
  const slide = requireSlide(sqlite, operation.entityId)
  try {
    requireHomeVersion(sqlite, operation.requestedVersion)
    if (slide.enabled === 1) {
      throw new ServiceError(409, 'CONFLICT', 'Enabled hero slides cannot be upscaled.', 'HERO_SLIDE_ENABLED')
    }
    assertAssetPair(sqlite, {
      landscapeAssetId: slide.landscapeAssetId,
      portraitAssetId: slide.portraitAssetId,
    }, slide.id)
    requireHeroLease(sqlite, lease)
    await ensureHeroUpscaleSource(sqlite, storage, slide.landscapeAssetId, now)
    setOperationStatus(sqlite, operationId, 'PREPARING_SOURCE', Date.now())
    requireHeroLease(sqlite, lease)
    await ensureHeroUpscaleSource(sqlite, storage, slide.portraitAssetId, now)
    requireHeroLease(sqlite, lease)
    requireHomeVersion(sqlite, operation.requestedVersion)
    sqlite.transaction(() => {
      assertOperationLease(sqlite, lease)
      const committed = sqlite.prepare(`
        UPDATE publication_operations
        SET status = 'DONE', failure_stage = NULL,
            internal_error_code = NULL, internal_error_message = NULL,
            lease_owner = NULL, lease_expires_at = NULL,
            version = version + 1, updated_at = ?, completed_at = ?
        WHERE id = ? AND status = 'PREPARING_SOURCE'
          AND lease_owner = ? AND attempt = ?
      `).run(Date.now(), Date.now(), operationId, lease.owner, lease.attempt)
      if (committed.changes !== 1) {
        throw new Error('Hero upscale commit lost its lease.')
      }
      insertHomeAuditLog(sqlite, {
        action: slide.placement === 'home'
          ? 'HOME_HERO_UPSCALE'
          : 'COMMISSION_HERO_UPSCALE',
        actorUserId,
        entityId: slide.id,
        id: randomUUID(),
        result: 'SUCCESS',
      }, Date.now())
    })()
  }
  catch {
    if (!holdsOperationLease(sqlite, lease)) {
      return getPublicationOperation(sqlite, operationId)
    }
    failUpscaleOperation(sqlite, operationId, 'HERO_UPSCALE_FAILED', Date.now())
    releaseOperationLease(sqlite, lease, Date.now())
    insertHomeAuditLog(sqlite, {
      action: slide.placement === 'home'
        ? 'HOME_HERO_UPSCALE'
        : 'COMMISSION_HERO_UPSCALE',
      actorUserId,
      entityId: slide.id,
      id: randomUUID(),
      result: 'FAILURE',
    }, Date.now())
  }
  return getPublicationOperation(sqlite, operationId)
}

/**
 * 启动恢复身份：Hero 发布与放大操作在系统恢复时没有交互式管理员，
 * 因此审计使用数据库里的唯一管理员作为可审计身份；没有管理员时留空。
 */
export function systemRecoveryActorId(sqlite: Database.Database) {
  return findSystemRecoveryActorId(sqlite)
}

function homeOperationTypeOf(sqlite: Database.Database, operationId: string) {
  const operation = findPublicationOperation(sqlite, operationId)
  return operation?.entityType === 'HOME'
    ? operation.operationType
    : undefined
}

registerOperationResumer({
  table: 'publication_operations',
  matches: (sqlite, operationId) =>
    homeOperationTypeOf(sqlite, operationId) === 'PUBLISH',
  failure: () => ({
    stage: 'GENERATING_PUBLIC',
    code: 'HOME_PUBLICATION_INTERRUPTED',
  }),
  resume: async (sqlite, storage, operationId, now) => {
    const actorUserId = systemRecoveryActorId(sqlite)
    if (!actorUserId) {
      throw new Error('No auditable recovery identity is available.')
    }
    const result = await runHeroSlidePublication(
      sqlite,
      storage,
      operationId,
      actorUserId,
      now,
    )
    if (result.status !== 'DONE' && result.status !== 'FAILED') {
      throw new Error('Home publication did not reach a terminal state.')
    }
  },
})

registerOperationResumer({
  table: 'publication_operations',
  matches: (sqlite, operationId) =>
    homeOperationTypeOf(sqlite, operationId) === 'UNPUBLISH',
  failure: () => ({
    stage: 'CLEANING_PUBLIC',
    code: 'HOME_UNPUBLICATION_INTERRUPTED',
  }),
  resume: async (sqlite, storage, operationId, now) => {
    const actorUserId = systemRecoveryActorId(sqlite)
    if (!actorUserId) {
      throw new Error('No auditable recovery identity is available.')
    }
    const result = await runHeroSlideUnpublication(
      sqlite,
      storage,
      operationId,
      actorUserId,
      now,
    )
    if (result.status !== 'DONE' && result.status !== 'FAILED') {
      throw new Error('Home unpublication did not reach a terminal state.')
    }
  },
})

registerOperationResumer({
  table: 'publication_operations',
  matches: (sqlite, operationId) =>
    homeOperationTypeOf(sqlite, operationId) === 'UPSCALE',
  failure: () => ({
    stage: 'PREPARING_SOURCE',
    code: 'HERO_UPSCALE_INTERRUPTED',
  }),
  resume: async (sqlite, storage, operationId, now) => {
    const actorUserId = systemRecoveryActorId(sqlite)
    if (!actorUserId) {
      throw new Error('No auditable recovery identity is available.')
    }
    const result = await runHeroSlideUpscale(
      sqlite,
      storage,
      operationId,
      actorUserId,
      now,
    )
    if (result.status !== 'DONE' && result.status !== 'FAILED') {
      throw new Error('Hero upscale did not reach a terminal state.')
    }
  },
})

export function retryHeroSlideUpscale(
  sqlite: Database.Database,
  operationId: string,
  expectedVersion: number,
  now = Date.now(),
) {
  const operation = upscaleOperation(sqlite, operationId)
  if (operation.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  if (operation.status !== 'FAILED') {
    throw new ServiceError(409, 'CONFLICT', 'Hero upscale is not retryable.', 'OPERATION_NOT_RETRYABLE')
  }
  requireHomeVersion(sqlite, operation.requestedVersion)
  sqlite.prepare(`
    UPDATE publication_operations
    SET status = 'PREPARING_SOURCE', failure_stage = NULL,
        internal_error_code = NULL, internal_error_message = NULL,
        completed_at = NULL, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ? AND status = 'FAILED'
  `).run(now, operationId, expectedVersion)
  return getPublicationOperation(sqlite, operationId)
}

export async function getHeroSlidePreviewContent(
  sqlite: Database.Database,
  storage: MediaStorage,
  slideId: string,
  orientation: 'landscape' | 'portrait',
  now = Date.now(),
  placement: HeroPlacement = 'home',
) {
  const slide = requireSlide(sqlite, slideId, placement)
  const objectKey = orientation === 'landscape'
    ? slide.landscapePreviewObjectKey
    : slide.portraitPreviewObjectKey
  if (!objectKey || !slide.previewExpiresAt || slide.previewExpiresAt <= now) {
    throw new ServiceError(404, 'NOT_FOUND', 'Hero preview was not found.')
  }
  return await storage.getPrivate(objectKey)
}

async function clearHeroSlidePreviews(
  sqlite: Database.Database,
  storage: MediaStorage,
  slide: SlideRow,
) {
  const keys = [
    slide.landscapePreviewObjectKey,
    slide.portraitPreviewObjectKey,
  ].filter((key): key is string => key !== null)
  for (const key of new Set(keys)) {
    await storage.deletePrivate(key)
  }
  if (keys.length > 0 || slide.previewExpiresAt !== null) {
    clearSlidePreviewKeys(sqlite, slide.id)
  }
}

export function getPublicHomeEntries(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
) {
  const entry = (kind: HomeEntryKind) => {
    const source = homeEntrySource(sqlite, kind)
    return projectHomeEntry(
      kind,
      source,
      source ? variantsForAsset(sqlite, source.assetId) : [],
      mediaBaseUrl,
      appEnv,
    )
  }
  return {
    commission: entry('commission'),
    adoption: entry('adoption'),
  }
}

export function getPublicHome(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicHomeDto {
  const home = requireHome(sqlite)
  const projected = publicHeroSlides(sqlite, mediaBaseUrl, 'home', appEnv)
  return publicHomeDtoSchema.parse({
    tagline: home.tagline,
    contactEmail: home.contactEmail,
    contactQq: home.contactQq,
    autoRotate: home.autoRotate === 1,
    autoRotateIntervalMs: home.autoRotateIntervalMs,
    slides: projected,
    entries: getPublicHomeEntries(sqlite, mediaBaseUrl, appEnv),
  })
}

function publicHeroSlides(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  placement: HeroPlacement,
  appEnv: RuntimeConfig['appEnv'],
) {
  const enabled = slides(sqlite, placement).filter(slide => slide.enabled === 1)
  // 迁移期仍可能只有旧水印 Hero 变体，此时 mapper 回退需要 profile 身份。
  const profileId = activeWatermarkProfileId(sqlite)
  const variants = variantsForAssets(
    sqlite,
    enabled.flatMap(slide => [
      slide.landscapeAssetId,
      slide.portraitAssetId,
    ]),
  )
  const projected = enabled.map((slide) => {
    const record: HeroSlideRecord = {
      activeWatermarkProfileId: profileId,
      id: slide.id,
      version: slide.version,
      enabled: true,
      altText: slide.alt,
      placement,
      sortOrder: slide.sortOrder,
      landscapeVariants: variants.get(slide.landscapeAssetId) ?? [],
      portraitVariants: variants.get(slide.portraitAssetId) ?? [],
      linkedWork: slide.linkedWorkId
        ? {
            publicationStatus: slide.linkedWorkStatus!,
            slug: slide.linkedWorkSlug!,
          }
        : null,
    }
    const dto = toPublicHeroSlideDto(record, mediaBaseUrl, appEnv)
    if (!dto) {
      throw new Error('Enabled hero slide could not be projected.')
    }
    return dto
  })
  return projected
}

export function getPublicCommissionHero(
  sqlite: Database.Database,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicCommissionHeroDto {
  const slides = publicHeroSlides(sqlite, mediaBaseUrl, 'commission', appEnv)
  return publicCommissionHeroDtoSchema.parse({ slide: slides[0] ?? null })
}

function assertAssetPair(
  sqlite: Database.Database,
  input: Pick<HeroSlideInput, 'landscapeAssetId' | 'portraitAssetId'>,
  exceptSlideId?: string,
) {
  if (input.landscapeAssetId === input.portraitAssetId) {
    throw new ServiceError(409, 'CONFLICT', 'Hero assets must be distinct.')
  }
  const landscape = findHeroAsset(sqlite, input.landscapeAssetId)
  const portrait = findHeroAsset(sqlite, input.portraitAssetId)
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
    throw new ServiceError(409, 'CONFLICT', 'Hero assets are not publication-ready.', 'HERO_ASSETS_NOT_READY')
  }
  const used = isHeroAssetAssigned(
    sqlite,
    input.landscapeAssetId,
    input.portraitAssetId,
    exceptSlideId,
  )
  if (used) {
    throw new ServiceError(409, 'CONFLICT', 'Hero asset is already assigned.', 'HERO_ASSET_ALREADY_ASSIGNED')
  }
}

function assertLinkedWork(sqlite: Database.Database, linkedWorkId: string | null) {
  if (!linkedWorkId) {
    return
  }
  if (!isWorkPublished(sqlite, linkedWorkId)) {
    throw new ServiceError(409, 'CONFLICT', 'Linked work must be published.', 'LINKED_WORK_NOT_PUBLISHED')
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
  placement: HeroPlacement = 'home',
) {
  requireHomeVersion(sqlite, expectedVersion)
  assertAssetPair(sqlite, input)
  assertLinkedWork(sqlite, input.linkedWorkId)
  try {
    sqlite.transaction(() => {
      claimHomeVersion(sqlite, expectedVersion, now)
      insertSlide(sqlite, {
        ...input,
        id: randomUUID(),
        placement,
      }, now)
    })()
  }
  catch (error) {
    translateHomeConstraint(error)
  }
  return getAdminHome(sqlite, placement)
}

export async function updateHeroSlide(
  sqlite: Database.Database,
  storage: MediaStorage,
  id: string,
  expectedVersion: number,
  input: HeroSlideInput,
  now = Date.now(),
  placement: HeroPlacement = 'home',
) {
  requireHomeVersion(sqlite, expectedVersion)
  const current = requireSlide(sqlite, id, placement)
  if (current.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Disable the hero slide before editing it.', 'HERO_SLIDE_ENABLED')
  }
  assertAssetPair(sqlite, input, id)
  assertLinkedWork(sqlite, input.linkedWorkId)
  await clearHeroSlidePreviews(sqlite, storage, current)
  try {
    sqlite.transaction(() => {
      claimHomeVersion(sqlite, expectedVersion, now)
      updateDisabledSlide(sqlite, id, placement, input, now)
    })()
  }
  catch (error) {
    translateHomeConstraint(error)
  }
  return getAdminHome(sqlite, placement)
}

export async function deleteHeroSlide(
  sqlite: Database.Database,
  storage: MediaStorage,
  id: string,
  expectedVersion: number,
  now = Date.now(),
  placement: HeroPlacement = 'home',
) {
  requireHomeVersion(sqlite, expectedVersion)
  const slide = requireSlide(sqlite, id, placement)
  if (slide.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Disable the hero slide before deleting it.', 'HERO_SLIDE_ENABLED')
  }
  await clearHeroSlidePreviews(sqlite, storage, slide)
  sqlite.transaction(() => {
    claimHomeVersion(sqlite, expectedVersion, now)
    deleteDisabledSlide(sqlite, id, placement)
  })()
  return getAdminHome(sqlite, placement)
}

export function updateHomeSettings(
  sqlite: Database.Database,
  expectedVersion: number,
  input: HomeSettingsInput,
  now = Date.now(),
) {
  const changes = updateHomeSettingsRow(sqlite, input, expectedVersion, now)
  if (changes !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  return getAdminHome(sqlite)
}

export function reorderEnabledHeroSlides(
  sqlite: Database.Database,
  expectedVersion: number,
  slideIds: readonly string[],
  now = Date.now(),
  placement: HeroPlacement = 'home',
) {
  requireHomeVersion(sqlite, expectedVersion)
  const enabledIds = slides(sqlite, placement)
    .filter(slide => slide.enabled === 1)
    .map(slide => slide.id)
  if (
    slideIds.length < 1
    || slideIds.length > 5
    || new Set(slideIds).size !== slideIds.length
    || slideIds.length !== enabledIds.length
    || slideIds.some(id => !enabledIds.includes(id))
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Enabled hero slide order is stale.', 'HERO_ORDER_STALE')
  }
  sqlite.transaction(() => {
    claimHomeVersion(sqlite, expectedVersion, now)
    replaceEnabledOrder(sqlite, placement, slideIds, now)
    validateHeroSlidesForPublication(sqlite, placement)
  })()
  return getAdminHome(sqlite, placement)
}

function assertSlideCanDisable(
  sqlite: Database.Database,
  slide: SlideRow,
  placement: HeroPlacement = 'home',
) {
  if (slide.enabled !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Hero slide is already disabled.')
  }
  const enabledCount = countEnabledSlides(sqlite, placement)
  if (placement === 'home' && enabledCount <= 1) {
    throw new ServiceError(409, 'CONFLICT', 'At least one hero slide must remain enabled.', 'HERO_LAST_ENABLED_SLIDE')
  }
}

export function startHeroSlideUnpublication(
  sqlite: Database.Database,
  slideId: string,
  expectedVersion: number,
  now = Date.now(),
  placement: HeroPlacement = 'home',
): PublicationOperationDto {
  requireHomeVersion(sqlite, expectedVersion)
  assertSlideCanDisable(
    sqlite,
    requireSlide(sqlite, slideId, placement),
    placement,
  )
  if (hasActivePublicationOperation(sqlite, 'HOME', slideId)) {
    throw new ServiceError(409, 'CONFLICT', 'A home publication operation is already active.', 'ACTIVE_OPERATION_EXISTS')
  }
  const id = randomUUID()
  insertPublicationOperation(sqlite, {
    entityId: slideId,
    entityType: 'HOME',
    id,
    operationType: 'UNPUBLISH',
    requestedVersion: expectedVersion,
    status: 'COMMITTING',
  }, now)
  return getPublicationOperation(sqlite, id)
}

function assertSlideCanEnable(
  sqlite: Database.Database,
  slide: SlideRow,
  placement: HeroPlacement,
) {
  if (slide.enabled === 1) {
    throw new ServiceError(409, 'CONFLICT', 'Hero slide is already enabled.')
  }
  if (slide.sortOrder < 0 || slide.sortOrder > 4) {
    throw new ServiceError(409, 'CONFLICT', 'Enabled hero slide order must be between 0 and 4.', 'HERO_ORDER_STALE')
  }
  const enabledCount = countEnabledSlides(sqlite, placement)
  const orderConflict = hasEnabledSlideAtOrder(
    sqlite,
    placement,
    slide.sortOrder,
  )
  if (enabledCount >= 5 || orderConflict) {
    throw new ServiceError(409, 'CONFLICT', 'Enabled hero slides must have 1 to 5 unique positions.', 'HERO_SLOT_LIMIT')
  }
  assertAssetPair(sqlite, {
    landscapeAssetId: slide.landscapeAssetId,
    portraitAssetId: slide.portraitAssetId,
  }, slide.id)
  const usages = SITE_HERO_USAGES[placement]
  if (
    !assetSupportsSiteDisplay(sqlite, slide.landscapeAssetId, [usages.landscape])
    || !assetSupportsSiteDisplay(sqlite, slide.portraitAssetId, [usages.portrait])
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Hero assets require confirmed upscale.', 'HERO_ASSETS_REQUIRE_UPSCALE')
  }
  assertLinkedWork(sqlite, slide.linkedWorkId)
}

function homeOperation(sqlite: Database.Database, id: string) {
  const row = findPublicationOperation(sqlite, id)
  if (
    !row
    || row.entityType !== 'HOME'
    || (row.operationType !== 'PUBLISH' && row.operationType !== 'UNPUBLISH')
  ) {
    throw new ServiceError(404, 'NOT_FOUND', 'Home publication operation was not found.')
  }
  return row as OperationRow & { operationType: 'PUBLISH' | 'UNPUBLISH' }
}

export function startHeroSlidePublication(
  sqlite: Database.Database,
  slideId: string,
  expectedVersion: number,
  now = Date.now(),
  placement: HeroPlacement = 'home',
): PublicationOperationDto {
  requireHomeVersion(sqlite, expectedVersion)
  assertSlideCanEnable(sqlite, requireSlide(sqlite, slideId, placement), placement)
  if (hasActivePublicationOperation(sqlite, 'HOME', slideId)) {
    throw new ServiceError(409, 'CONFLICT', 'A home publication operation is already active.', 'ACTIVE_OPERATION_EXISTS')
  }
  const id = randomUUID()
  insertPublicationOperation(sqlite, {
    entityId: slideId,
    entityType: 'HOME',
    id,
    operationType: 'PUBLISH',
    requestedVersion: expectedVersion,
    status: 'GENERATING_PUBLIC',
  }, now)
  return getPublicationOperation(sqlite, id)
}

function setOperationStatus(
  sqlite: Database.Database,
  id: string,
  status: PublicationOperationDto['status'],
  now: number,
) {
  updateOperationStatus(
    sqlite,
    id,
    status,
    [],
    now,
  )
}

function publicKeysForSlide(sqlite: Database.Database, slide: SlideRow) {
  return findPublicKeysForSlide(sqlite, slide)
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
      deletePublicVariant(sqlite, key)
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
  markOperationFailed(sqlite, id, {
    cleanupKeys,
    code,
    stage,
  }, now)
}

function assertCompleteHeroPair(
  sqlite: Database.Database,
  slide: SlideRow,
) {
  const missing = missingSiteHeroVariants(slide, variantsForAssets(sqlite, [
    slide.landscapeAssetId,
    slide.portraitAssetId,
  ]))
  if (missing !== 0) {
    throw new Error('Hero slide requires complete site display variants.')
  }
}

/**
 * T34-F5：Hero 发布已经是“完整生成后再原子切换”的形状，因此重启后的安全续做
 * 就是在新 attempt 下重跑同一序列。site-display 生成按对象 Key 幂等，
 * 已存在且校验通过的变体会被复用，不会重复产生半套 SourceSet。
 *
 * 已提交（slide 已 enabled 且变体完整）的情况直接收尾为 DONE，不重复审计。
 */
export async function runHeroSlidePublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now = Date.now(),
) {
  const operation = homeOperation(sqlite, operationId)
  if (operation.operationType !== 'PUBLISH') {
    throw new ServiceError(404, 'NOT_FOUND', 'Home publication operation was not found.')
  }
  if (operation.status === 'DONE' || operation.status === 'FAILED') {
    return getPublicationOperation(sqlite, operationId)
  }
  const lease = claimOperationLease(sqlite, 'publication_operations', operationId, now)
  if (!lease) {
    // 另一个 runner 正持有 lease，或任务已终结：不并行推进同一 operation。
    return getPublicationOperation(sqlite, operationId)
  }
  const slide = requireSlide(sqlite, operation.entityId)
  const before = new Set(publicKeysForSlide(sqlite, slide))
  let stage: PublicationFailureStage = 'VALIDATING'
  let code = 'HOME_PUBLICATION_VALIDATION_FAILED'
  try {
    // 启用与 operation 置 DONE 在同一事务内提交，因此不存在
    // "已启用但 operation 仍非终态" 的窗口：进程被杀只会回滚到提交前，
    // 恢复路径是在新 attempt 下重跑同一序列（变体生成按 Key 幂等）。
    requireHomeVersion(sqlite, operation.requestedVersion)
    assertSlideCanEnable(sqlite, slide, slide.placement)
    // T34-F1：站点展示位生成无水印变体，不再套用活动水印 profile。
    stage = 'GENERATING_PUBLIC'
    code = 'PUBLIC_MEDIA_GENERATION_FAILED'
    setOperationStatus(sqlite, operationId, 'GENERATING_PUBLIC', now)
    const usages = SITE_HERO_USAGES[slide.placement]
    requireHeroLease(sqlite, lease)
    await generateSiteDisplayVariants(
      sqlite,
      storage,
      slide.landscapeAssetId,
      [usages.landscape],
      now,
    )
    requireHeroLease(sqlite, lease)
    await generateSiteDisplayVariants(
      sqlite,
      storage,
      slide.portraitAssetId,
      [usages.portrait],
      now,
    )
    if (slide.placement === 'commission') {
      requireHeroLease(sqlite, lease)
      await generateSiteDisplayVariants(
        sqlite,
        storage,
        slide.landscapeAssetId,
        [HOME_ENTRY_USAGES.commission],
        now,
      )
    }
    requireHeroLease(sqlite, lease)
    stage = 'VERIFYING_PUBLIC'
    code = 'PUBLIC_MEDIA_VERIFICATION_FAILED'
    setOperationStatus(sqlite, operationId, 'VERIFYING_PUBLIC', now)
    assertCompleteHeroPair(sqlite, slide)
    await clearHeroSlidePreviews(sqlite, storage, slide)
    requireHeroLease(sqlite, lease)
    stage = 'COMMITTING'
    code = 'HOME_PUBLICATION_COMMIT_FAILED'
    setOperationStatus(sqlite, operationId, 'COMMITTING', now)
    sqlite.transaction(() => {
      // lease CAS 与业务版本 CAS 同事务：失去 lease 的 runner 无法覆盖接管者。
      assertOperationLease(sqlite, lease)
      requireHomeVersion(sqlite, operation.requestedVersion)
      assertSlideCanEnable(
        sqlite,
        requireSlide(sqlite, slide.id, slide.placement),
        slide.placement,
      )
      claimHomeVersion(sqlite, operation.requestedVersion, now)
      setSlideEnabled(sqlite, slide.id, slide.placement, true, now)
      validateHeroSlidesForPublication(sqlite, slide.placement)
      const committed = sqlite.prepare(`
        UPDATE publication_operations
        SET status = 'DONE', failure_stage = NULL,
            internal_error_code = NULL, internal_error_message = NULL,
            cleanup_object_keys_json = '[]', lease_owner = NULL,
            lease_expires_at = NULL, version = version + 1,
            updated_at = ?, completed_at = ?
        WHERE id = ? AND status = 'COMMITTING'
          AND lease_owner = ? AND attempt = ?
      `).run(now, now, operationId, lease.owner, lease.attempt)
      if (committed.changes !== 1) {
        throw new Error('Home publication commit lost its lease.')
      }
      insertHomeAuditLog(sqlite, {
        action: slide.placement === 'home'
          ? 'HOME_HERO_ENABLE'
          : 'COMMISSION_HERO_ENABLE',
        actorUserId,
        entityId: slide.id,
        id: randomUUID(),
        result: 'SUCCESS',
      }, now)
    })()
  }
  catch {
    if (!holdsOperationLease(sqlite, lease)) {
      // lease 已被接管：不清理对象，也不改状态，交给接管者。
      return getPublicationOperation(sqlite, operationId)
    }
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
    releaseOperationLease(sqlite, lease, now)
  }
  return getPublicationOperation(sqlite, operationId)
}

function parseHomeCleanupKeys(value: string) {
  const parsed = JSON.parse(value) as unknown
  if (
    !Array.isArray(parsed)
    || parsed.some(key => typeof key !== 'string' || key.length === 0)
  ) {
    throw new Error('Home cleanup manifest is invalid.')
  }
  return parsed as string[]
}

async function cleanHeroSlideUnpublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  expectedVersion: number,
  now: number,
  heartbeat?: () => void,
) {
  const operation = homeOperation(sqlite, operationId)
  if (operation.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  let remaining = parseHomeCleanupKeys(operation.cleanupObjectKeysJson)
  if (
    remaining.length === 0
    && (
      operation.operationType !== 'UNPUBLISH'
      || operation.edgePurgeStatus === 'NOT_REQUIRED'
      || operation.edgePurgeStatus === 'COMPLETE'
    )
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Publication cleanup is not pending.', 'OPERATION_NOT_RETRYABLE')
  }
  setOperationStatus(sqlite, operationId, 'CLEANING_PUBLIC', now)
  setOperationCleanupKeys(sqlite, operationId, remaining, now)
  for (const key of [...remaining]) {
    try {
      heartbeat?.()
      await storage.deletePublic(key)
      heartbeat?.()
      sqlite.transaction(() => {
        deletePublicVariant(sqlite, key)
        remaining = remaining.filter(candidate => candidate !== key)
        setOperationCleanupKeys(sqlite, operationId, remaining, now)
      })()
    }
    catch {
      failHomeOperation(
        sqlite,
        operationId,
        'CLEANING_PUBLIC',
        'PUBLIC_CLEANUP_FAILED',
        remaining,
        now,
      )
      return
    }
  }

  const edgeFailure = await runOperationEdgePurge(
    sqlite,
    getPublicMediaCache(),
    operationId,
    now,
    heartbeat ? { heartbeat } : {},
  )
  if (edgeFailure) {
    failHomeOperation(
      sqlite,
      operationId,
      'CLEANING_PUBLIC',
      edgeFailure,
      [],
      now,
    )
    return
  }
  completeOperation(sqlite, operationId, now)
}

export async function runHeroSlideUnpublication(
  sqlite: Database.Database,
  storage: MediaStorage,
  operationId: string,
  actorUserId: string,
  now = Date.now(),
) {
  const operation = homeOperation(sqlite, operationId)
  if (operation.operationType !== 'UNPUBLISH') {
    throw new ServiceError(404, 'NOT_FOUND', 'Home unpublication operation was not found.')
  }
  if (operation.status === 'DONE' || operation.status === 'FAILED') {
    return getPublicationOperation(sqlite, operationId)
  }
  const lease = claimOperationLease(sqlite, 'publication_operations', operationId, now)
  if (!lease) {
    return getPublicationOperation(sqlite, operationId)
  }
  let slide = requireSlide(sqlite, operation.entityId)

  if (slide.enabled !== 1 && operation.status === 'CLEANING_PUBLIC') {
    const cleaning = homeOperation(sqlite, operationId)
    await cleanHeroSlideUnpublication(
      sqlite,
      storage,
      operationId,
      cleaning.version,
      now,
      () => requireHeroLease(sqlite, lease),
    )
    releaseOperationLease(sqlite, lease, now)
    return getPublicationOperation(sqlite, operationId)
  }

  try {
    requireHomeVersion(sqlite, operation.requestedVersion)
    assertSlideCanDisable(sqlite, slide, slide.placement)
    await clearHeroSlidePreviews(sqlite, storage, slide)
    requireHeroLease(sqlite, lease)
    const keys = publicKeysForSlide(sqlite, slide)
    const edgeUrls = edgePurgeUrlsForObjectKeys(getPublicMediaCache(), keys)
    sqlite.transaction(() => {
      assertOperationLease(sqlite, lease)
      requireHomeVersion(sqlite, operation.requestedVersion)
      slide = requireSlide(sqlite, slide.id, slide.placement)
      assertSlideCanDisable(sqlite, slide, slide.placement)
      claimHomeVersion(sqlite, operation.requestedVersion, now)
      setSlideEnabled(sqlite, slide.id, slide.placement, false, now)
      markVariantsCleanupPending(sqlite, keys, now)
      updateOperationStatus(
        sqlite,
        operationId,
        'CLEANING_PUBLIC',
        keys,
        now,
      )
      setOperationEdgePurgeManifest(sqlite, operationId, edgeUrls, now)
      insertHomeAuditLog(sqlite, {
        action: slide.placement === 'home'
          ? 'HOME_HERO_DISABLE'
          : 'COMMISSION_HERO_DISABLE',
        actorUserId,
        entityId: slide.id,
        id: randomUUID(),
        result: 'SUCCESS',
      }, now)
    })()

    const cleaning = homeOperation(sqlite, operationId)
    if (
      parseHomeCleanupKeys(cleaning.cleanupObjectKeysJson).length === 0
      && cleaning.edgePurgeStatus === 'NOT_REQUIRED'
    ) {
      completeOperation(sqlite, operationId, now)
    }
    else {
      await cleanHeroSlideUnpublication(
        sqlite,
        storage,
        operationId,
        cleaning.version,
        now,
        () => requireHeroLease(sqlite, lease),
      )
    }
  }
  catch {
    if (holdsOperationLease(sqlite, lease)) {
      failHomeOperation(
        sqlite,
        operationId,
        'COMMITTING',
        'HOME_UNPUBLICATION_COMMIT_FAILED',
        [],
        now,
      )
    }
  }
  releaseOperationLease(sqlite, lease, now)
  return getPublicationOperation(sqlite, operationId)
}

/**
 * 兼容 service/集成调用：HTTP 入口使用 start + runner，避免请求等待 ESA；
 * 直接调用仍可等待持久 operation 到达当前终态并取得最新首页快照。
 */
export async function disableHeroSlide(
  sqlite: Database.Database,
  storage: MediaStorage,
  id: string,
  expectedVersion: number,
  actorUserId: string,
  now = Date.now(),
  placement: HeroPlacement = 'home',
) {
  const operation = startHeroSlideUnpublication(
    sqlite,
    id,
    expectedVersion,
    now,
    placement,
  )
  await runHeroSlideUnpublication(
    sqlite,
    storage,
    operation.operationId,
    actorUserId,
    now,
  )
  return getAdminHome(sqlite, placement)
}

/** 长 OSS 操作前后更新心跳；失去 lease 立即停止，避免双写公开对象。 */
function requireHeroLease(
  sqlite: Database.Database,
  lease: OperationLease,
) {
  if (!heartbeatOperationLease(sqlite, lease)) {
    throw new Error('Home publication lease was lost.')
  }
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
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  if (operation.status !== 'FAILED') {
    throw new ServiceError(409, 'CONFLICT', 'Home publication is not retryable.', 'OPERATION_NOT_RETRYABLE')
  }
  if (operation.operationType === 'UNPUBLISH') {
    await cleanHeroSlideUnpublication(
      sqlite,
      storage,
      operationId,
      expectedVersion,
      now,
    )
    return getPublicationOperation(sqlite, operationId)
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
  resetFailedPublicationOperation(
    sqlite,
    operationId,
    expectedVersion,
    'GENERATING_PUBLIC',
    now,
  )
  return getPublicationOperation(sqlite, operationId)
}

import {
  adminAssetDtoSchema,
  publicAltSchema,
  publicHeroSlideDtoSchema,
  publicPngSourceSetDtoSchema,
  publicSourceSetDtoSchema,
  publicVariantDtoSchema,
} from '../../../shared/schemas/media'
import { publicHeroItemDtoSchema } from '../../../shared/schemas/home'
import type {
  AdminAssetDto,
  AssetStatus,
  HeroPlacement,
  HeroOrientation,
  MediaRole,
  PublicHeroItemDto,
  PublicHeroSlideDto,
  PublicPngSourceSetDto,
  PublicSourceSetDto,
  PublicVariantDto,
} from '../../../shared/types/contracts'
import type { RuntimeConfig } from '../runtime-config'
import {
  completePublicHeroVariants,
  HERO_RECIPE,
} from './hero-publication'
import {
  completeSiteDisplayVariantsForVersion,
  LEGACY_SITE_DISPLAY_RECIPE_VERSION,
  SITE_DISPLAY_RECIPE_VERSION,
  SITE_HERO_USAGES,
  siteDisplayWidthsForVersion,
} from './site-display-recipe'

export interface AssetRecord {
  id: string
  version: number
  role: MediaRole
  status: AssetStatus
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  width: number
  height: number
  /** Service-only fields. */
  privateObjectKey: string
  sha256: string
  internalErrorCode: string | null
}

export interface VariantRecord {
  byteSize: number | null
  id: string
  storageScope: 'PRIVATE' | 'PUBLIC'
  status: AssetStatus
  objectKey: string
  width: number
  height: number
  format: 'webp' | 'jpeg' | 'png'
  /** Service-only fields. */
  inputSha256: string
  internalErrorCode: string | null
  logoDigest: string
  mediaRole: MediaRole
  protectionMode: string
  recipeVersion: string
  sha256: string | null
  usage: string
  watermarkAnchor: string
  watermarkConfigDigest: string
  watermarkOpacityPercent: number | null
  watermarkProfile: string
  watermarkProfileId: string | null
  watermarkScalePercent: number | null
}

export interface HeroSlideRecord {
  /** 迁移期兼容读取旧水印 Hero 变体时使用；新变体不需要 profile 身份。 */
  activeWatermarkProfileId: string | null
  id: string
  version: number
  enabled: boolean
  altText: string
  placement: HeroPlacement
  sortOrder: number
  landscapeVariants: VariantRecord[]
  portraitVariants: VariantRecord[]
  linkedWork: {
    publicationStatus: 'draft' | 'published' | 'unpublished'
    slug: string
  } | null
}

export interface HeroItemRecord {
  activeWatermarkProfileId: string | null
  altText: string
  orientation: HeroOrientation
  placement: HeroPlacement
  sortOrder: number
  variants: VariantRecord[]
}

function assertPublicDerivativeObjectKey(
  objectKey: string,
  appEnv: RuntimeConfig['appEnv'],
) {
  const segments = objectKey.split('/')
  const webIndex = segments.indexOf('web')
  const structurallySafe = segments.length >= 3
    && segments.every(segment => segment.length > 0)
    && !objectKey.includes('\\')
    && !objectKey.includes('://')
    && !segments.includes('.')
    && !segments.includes('..')
    && webIndex >= 1
    && webIndex < segments.length - 1
    && segments.lastIndexOf('web') === webIndex
    && !segments.some(segment => (
      ['original', 'preview', 'processing'].includes(segment)
    ))
  const productionSafe = appEnv !== 'production'
    || (webIndex === 1 && segments[0] === 'prod')

  if (!structurallySafe || !productionSafe) {
    throw new Error('Public variant must use a generated web derivative object key.')
  }
}

export function publicMediaUrlForObjectKey(
  mediaBaseUrl: string,
  objectKey: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
) {
  const base = new URL(mediaBaseUrl)
  assertPublicDerivativeObjectKey(objectKey, appEnv)
  base.pathname = `${base.pathname.replace(/\/$/, '')}/${objectKey
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
  return base.toString()
}

export function toAdminAssetDto(record: AssetRecord): AdminAssetDto {
  return adminAssetDtoSchema.parse({
    assetId: record.id,
    version: record.version,
    role: record.role,
    status: record.status,
    mimeType: record.mimeType,
    width: record.width,
    height: record.height,
  })
}

type PublicVariantRecord = Pick<
  VariantRecord,
  'format' | 'height' | 'objectKey' | 'status' | 'storageScope' | 'width'
>

export function toPublicVariantDto(
  record: PublicVariantRecord,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicVariantDto | null {
  if (record.storageScope !== 'PUBLIC' || record.status !== 'READY') {
    return null
  }

  return publicVariantDtoSchema.parse({
    src: publicMediaUrlForObjectKey(mediaBaseUrl, record.objectKey, appEnv),
    width: record.width,
    height: record.height,
    format: record.format,
  })
}

export function toPublicPngSourceSetDto(
  records: readonly PublicVariantRecord[],
  mediaBaseUrl: string,
  expectedWidths: readonly number[],
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicPngSourceSetDto {
  const fallback = records
    .map(record => toPublicVariantDto(record, mediaBaseUrl, appEnv))
    .filter((variant): variant is PublicVariantDto => (
      variant !== null && variant.format === 'png'
    ))
    .sort((left, right) => left.width - right.width)
  if (
    fallback.length !== expectedWidths.length
    || fallback.some((variant, index) => variant.width !== expectedWidths[index])
  ) {
    throw new Error('Public PNG srcset is incomplete.')
  }
  return publicPngSourceSetDtoSchema.parse({ webp: [], fallback })
}

export function toSafePublicAlt(value: string | null, fallback: string) {
  for (const candidate of [value, fallback, '兽装作品照片']) {
    const parsed = publicAltSchema.safeParse(candidate)
    if (parsed.success) {
      return parsed.data
    }
  }
  return '兽装作品照片'
}

export function toPublicSourceSetDto(
  records: readonly VariantRecord[],
  mediaBaseUrl: string,
  expectedWidths: readonly number[],
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicSourceSetDto {
  const variants = records
    .map(record => toPublicVariantDto(record, mediaBaseUrl, appEnv))
    .filter(variant => variant !== null)
  const webp = variants
    .filter(variant => variant.format === 'webp')
    .sort((left, right) => left.width - right.width)
  const fallback = variants
    .filter(variant => variant.format !== 'webp')
    .sort((left, right) => left.width - right.width)
  const widthsMatch = (values: readonly PublicVariantDto[]) => (
    values.length === expectedWidths.length
    && values.every((value, index) => value.width === expectedWidths[index])
  )
  if (
    !widthsMatch(webp)
    || !widthsMatch(fallback)
    || new Set(fallback.map(variant => variant.format)).size !== 1
  ) {
    throw new Error('Public srcset is incomplete.')
  }
  return publicSourceSetDtoSchema.parse({ webp, fallback })
}

export function toPublicHeroSlideDto(
  record: HeroSlideRecord,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicHeroSlideDto | null {
  if (!record.enabled) {
    return null
  }

  if (
    record.linkedWork
    && record.linkedWork.publicationStatus !== 'published'
  ) {
    throw new Error('Enabled hero slide links to an unpublished work.')
  }

  const usages = SITE_HERO_USAGES[record.placement]
  const completeHeroVersion = (recipeVersion: typeof SITE_DISPLAY_RECIPE_VERSION | typeof LEGACY_SITE_DISPLAY_RECIPE_VERSION) => {
    const landscape = completeSiteDisplayVariantsForVersion(
      usages.landscape,
      record.landscapeVariants,
      recipeVersion,
    )
    const portrait = completeSiteDisplayVariantsForVersion(
      usages.portrait,
      record.portraitVariants,
      recipeVersion,
    )
    return landscape && portrait
      ? {
          landscape: {
            variants: landscape,
            widths: siteDisplayWidthsForVersion(usages.landscape, recipeVersion),
          },
          portrait: {
            variants: portrait,
            widths: siteDisplayWidthsForVersion(usages.portrait, recipeVersion),
          },
        }
      : null
  }
  const unwatermarked = completeHeroVersion(SITE_DISPLAY_RECIPE_VERSION)
    ?? completeHeroVersion(LEGACY_SITE_DISPLAY_RECIPE_VERSION)
  // T51-F7：完整 v2 优先、完整 v1 次之；只在两者都缺失时回退历史水印 Hero。
  const sources = unwatermarked
    ? {
        landscape: toPublicSourceSetDto(
          unwatermarked.landscape.variants,
          mediaBaseUrl,
          unwatermarked.landscape.widths,
          appEnv,
        ),
        portrait: toPublicSourceSetDto(
          unwatermarked.portrait.variants,
          mediaBaseUrl,
          unwatermarked.portrait.widths,
          appEnv,
        ),
      }
    : legacyWatermarkedHeroSources(record, mediaBaseUrl, appEnv)

  return publicHeroSlideDtoSchema.parse({
    alt: toSafePublicAlt(record.altText, '首页代表作品'),
    sortOrder: record.sortOrder,
    landscape: sources.landscape,
    portrait: sources.portrait,
    linkedWorkHref: record.linkedWork
      ? `/works/${record.linkedWork.slug}`
      : null,
  })
}

/** R3-C: one independently ordered Hero item for exactly one orientation. */
export function toPublicHeroItemDto(
  record: HeroItemRecord,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'] = 'development',
): PublicHeroItemDto {
  const usage = SITE_HERO_USAGES[record.placement][record.orientation]
  const completeVersion = (
    recipeVersion: typeof SITE_DISPLAY_RECIPE_VERSION | typeof LEGACY_SITE_DISPLAY_RECIPE_VERSION,
  ) => {
    const variants = completeSiteDisplayVariantsForVersion(
      usage,
      record.variants,
      recipeVersion,
    )
    return variants
      ? {
          variants,
          widths: siteDisplayWidthsForVersion(usage, recipeVersion),
        }
      : null
  }
  const current = completeVersion(SITE_DISPLAY_RECIPE_VERSION)
    ?? completeVersion(LEGACY_SITE_DISPLAY_RECIPE_VERSION)
  const role = record.orientation === 'landscape'
    ? 'home_hero_landscape'
    : 'home_hero_portrait'
  const sources = current
    ? toPublicSourceSetDto(
        current.variants,
        mediaBaseUrl,
        current.widths,
        appEnv,
      )
    : record.activeWatermarkProfileId
      ? toPublicSourceSetDto(
          completePublicHeroVariants(
            role,
            record.variants,
            record.activeWatermarkProfileId,
          ),
          mediaBaseUrl,
          HERO_RECIPE[role].widths,
          appEnv,
        )
      : (() => {
          throw new Error('Enabled hero item has no complete public variants.')
        })()

  return publicHeroItemDtoSchema.parse({
    alt: toSafePublicAlt(record.altText, '首页代表作品'),
    sortOrder: record.sortOrder,
    sources,
  })
}

function legacyWatermarkedHeroSources(
  record: HeroSlideRecord,
  mediaBaseUrl: string,
  appEnv: RuntimeConfig['appEnv'],
) {
  if (!record.activeWatermarkProfileId) {
    throw new Error('Enabled hero slide has no complete site display variants.')
  }
  return {
    landscape: toPublicSourceSetDto(
      completePublicHeroVariants(
        'home_hero_landscape',
        record.landscapeVariants,
        record.activeWatermarkProfileId,
      ),
      mediaBaseUrl,
      HERO_RECIPE.home_hero_landscape.widths,
      appEnv,
    ),
    portrait: toPublicSourceSetDto(
      completePublicHeroVariants(
        'home_hero_portrait',
        record.portraitVariants,
        record.activeWatermarkProfileId,
      ),
      mediaBaseUrl,
      HERO_RECIPE.home_hero_portrait.widths,
      appEnv,
    ),
  }
}

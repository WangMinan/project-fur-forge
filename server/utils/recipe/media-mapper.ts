import {
  adminAssetDtoSchema,
  publicAltSchema,
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
  PublicPngSourceSetDto,
  PublicSourceSetDto,
  PublicVariantDto,
} from '../../../shared/types/contracts'
import type { RuntimeConfig } from '../runtime-config'
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
  mediaRole: MediaRole
  recipeVersion: string
  sha256: string | null
  usage: string
}

export interface HeroItemRecord {
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
  if (!current) {
    throw new Error(`Enabled ${role} item has no complete site display variants.`)
  }
  const sources = toPublicSourceSetDto(
    current.variants,
    mediaBaseUrl,
    current.widths,
    appEnv,
  )

  return publicHeroItemDtoSchema.parse({
    alt: toSafePublicAlt(record.altText, '首页代表作品'),
    sortOrder: record.sortOrder,
    sources,
  })
}

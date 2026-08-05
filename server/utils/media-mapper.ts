import {
  adminAssetDtoSchema,
  publicAltSchema,
  publicHeroSlideDtoSchema,
  publicSourceSetDtoSchema,
  publicVariantDtoSchema,
} from '../../shared/schemas/media'
import type {
  AdminAssetDto,
  AssetStatus,
  MediaRole,
  PublicHeroSlideDto,
  PublicSourceSetDto,
  PublicVariantDto,
} from '../../shared/types/contracts'
import {
  completePublicHeroVariants,
  HERO_RECIPE,
} from './hero-publication'

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
  activeWatermarkProfileId: string | null
  id: string
  version: number
  enabled: boolean
  altText: string
  sortOrder: number
  landscapeVariants: VariantRecord[]
  portraitVariants: VariantRecord[]
  linkedWork: {
    publicationStatus: 'draft' | 'published' | 'unpublished'
    slug: string
  } | null
}

function publicMediaUrl(mediaBaseUrl: string, objectKey: string) {
  const base = new URL(mediaBaseUrl)
  if (objectKey.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('Public object key must not contain dot segments.')
  }
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

export function toPublicVariantDto(
  record: VariantRecord,
  mediaBaseUrl: string,
): PublicVariantDto | null {
  if (record.storageScope !== 'PUBLIC' || record.status !== 'READY') {
    return null
  }

  return publicVariantDtoSchema.parse({
    src: publicMediaUrl(mediaBaseUrl, record.objectKey),
    width: record.width,
    height: record.height,
    format: record.format,
  })
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
): PublicSourceSetDto {
  const variants = records
    .map(record => toPublicVariantDto(record, mediaBaseUrl))
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

  const landscape = completePublicHeroVariants(
    'home_hero_landscape',
    record.landscapeVariants,
    record.activeWatermarkProfileId,
  )
  const portrait = completePublicHeroVariants(
    'home_hero_portrait',
    record.portraitVariants,
    record.activeWatermarkProfileId,
  )

  return publicHeroSlideDtoSchema.parse({
    alt: toSafePublicAlt(record.altText, '首页代表作品'),
    sortOrder: record.sortOrder,
    landscape: toPublicSourceSetDto(
      landscape,
      mediaBaseUrl,
      HERO_RECIPE.home_hero_landscape.widths,
    ),
    portrait: toPublicSourceSetDto(
      portrait,
      mediaBaseUrl,
      HERO_RECIPE.home_hero_portrait.widths,
    ),
    linkedWorkHref: record.linkedWork
      ? `/works/${record.linkedWork.slug}`
      : null,
  })
}

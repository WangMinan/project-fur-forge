import {
  adminAssetDtoSchema,
  publicHeroSlideDtoSchema,
  publicVariantDtoSchema,
} from '../../shared/schemas/media'
import type {
  AdminAssetDto,
  AssetStatus,
  MediaRole,
  PublicHeroSlideDto,
  PublicVariantDto,
} from '../../shared/types/contracts'
import {
  completeHeroVariants,
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
  activeWatermarkProfileId: string
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
    variantId: record.id,
    src: publicMediaUrl(mediaBaseUrl, record.objectKey),
    width: record.width,
    height: record.height,
    format: record.format,
  })
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

  const landscape = completeHeroVariants(
    'home_hero_landscape',
    record.landscapeVariants,
    record.activeWatermarkProfileId,
  )
    .map(variant => toPublicVariantDto(variant, mediaBaseUrl))
    .filter(variant => variant !== null)
  const portrait = completeHeroVariants(
    'home_hero_portrait',
    record.portraitVariants,
    record.activeWatermarkProfileId,
  )
    .map(variant => toPublicVariantDto(variant, mediaBaseUrl))
    .filter(variant => variant !== null)

  return publicHeroSlideDtoSchema.parse({
    id: record.id,
    version: record.version,
    alt: record.altText,
    sortOrder: record.sortOrder,
    landscape,
    portrait,
    linkedWorkSlug: record.linkedWork?.slug ?? null,
  })
}

import {
  createHash,
  randomUUID,
} from 'node:crypto'
import type Database from 'better-sqlite3'
import { WATERMARK_PROFILE_NAME } from '../../shared/schemas/watermark'
import type {
  MediaRole,
} from '../../shared/types/contracts'
import type { MediaStorage } from './media-storage'
import { safeLog } from './safe-log'
import { ServiceError } from './service-error'
import {
  requireActiveWatermarkProfile,
  requireWatermarkProfile,
  watermarkSource,
} from './watermark-profile'
import type {
  WatermarkProfileRow,
  WatermarkSource,
} from './watermark-profile'

export const PUBLIC_RECIPE_VERSION = 'recipe-v1'
/** Historical identity only. */
export const STANDARD_WATERMARK_PROFILE = 'brand-standard-v1'
export const CENTERED_WATERMARK_PROFILE = WATERMARK_PROFILE_NAME

export type PublicMediaUsage =
  | 'work-card'
  | 'home-hero-landscape'
  | 'home-hero-portrait'
  | 'design-sheet'
  | 'detail'

type PublicFormat = 'webp' | 'jpeg' | 'png'

export interface PublicRecipeSourceGeometry {
  cropHeight?: number
  cropWidth?: number
  height: number
  role?: MediaRole
  width: number
}

interface AssetSource {
  byteSize: number
  cropHeight: number
  cropWidth: number
  cropX: number
  cropY: number
  focalX: number
  focalY: number
  id: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  privateObjectKey: string
  role: MediaRole
  sha256: string
  status: string
  width: number
  height: number
}

interface ProcessingSource {
  inputSha256: string
  objectKey: string
  sourceVariantId: string | null
}

export interface ReadyPublicVariant {
  assetId: string
  byteSize: number
  format: PublicFormat
  height: number
  id: string
  inputSha256: string
  logoDigest: string
  mediaRole: MediaRole
  objectKey: string
  recipeVersion: typeof PUBLIC_RECIPE_VERSION
  sha256: string
  sourceVariantId: string | null
  usage: PublicMediaUsage
  watermarkAnchor: 'center'
  watermarkConfigDigest: string
  watermarkOpacityPercent: number
  watermarkProfile: typeof CENTERED_WATERMARK_PROFILE
  watermarkProfileId: string
  watermarkScalePercent: number
  width: number
}

const recipes = {
  'work-card': {
    roles: ['design_sheet', 'studio_photo'],
    widths: [480, 768, 1200],
    aspect: [3, 4],
  },
  'home-hero-landscape': {
    roles: ['home_hero_landscape'],
    widths: [768, 1280, 1920],
    aspect: [16, 9],
  },
  'home-hero-portrait': {
    roles: ['home_hero_portrait'],
    widths: [480, 768, 1080],
    aspect: [9, 16],
  },
  'design-sheet': {
    roles: ['design_sheet'],
    widths: [960, 1600, 2400],
    aspect: null,
  },
  'detail': {
    roles: ['design_sheet', 'studio_photo'],
    widths: [960, 1600, 2400],
    aspect: null,
  },
} as const satisfies Record<PublicMediaUsage, {
  roles: readonly MediaRole[]
  widths: readonly number[]
  aspect: readonly [number, number] | null
}>

export function publicRecipeWidths(usage: PublicMediaUsage) {
  return recipes[usage].widths
}

const selectReadyVariant = `
  SELECT
    id, asset_id AS assetId, source_variant_id AS sourceVariantId,
    object_key AS objectKey, input_sha256 AS inputSha256,
    media_role AS mediaRole, usage, width, height, format,
    recipe_version AS recipeVersion, watermark_profile AS watermarkProfile,
    watermark_profile_id AS watermarkProfileId,
    watermark_config_digest AS watermarkConfigDigest,
    logo_digest AS logoDigest, watermark_anchor AS watermarkAnchor,
    watermark_opacity_percent AS watermarkOpacityPercent,
    watermark_scale_percent AS watermarkScalePercent,
    sha256, byte_size AS byteSize
  FROM asset_variants
  WHERE storage_scope = 'PUBLIC' AND status = 'READY'
`

function digest(algorithm: 'md5' | 'sha256', content: Buffer) {
  return createHash(algorithm).update(content).digest('hex')
}

function asset(sqlite: Database.Database, assetId: string) {
  const row = sqlite.prepare(`
    SELECT
      asset.id, asset.role, asset.status,
      asset.private_object_key AS privateObjectKey,
      asset.sha256, asset.byte_size AS byteSize, asset.mime_type AS mimeType,
      asset.width, asset.height,
      COALESCE(relation.focal_x, asset.focal_x) AS focalX,
      COALESCE(relation.focal_y, asset.focal_y) AS focalY,
      COALESCE(relation.crop_x, 0) AS cropX,
      COALESCE(relation.crop_y, 0) AS cropY,
      COALESCE(relation.crop_width, 1) AS cropWidth,
      COALESCE(relation.crop_height, 1) AS cropHeight
    FROM assets AS asset
    LEFT JOIN work_assets AS relation ON relation.asset_id = asset.id
    WHERE asset.id = ?
  `).get(assetId) as AssetSource | undefined
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Asset was not found.')
  }
  if (row.status !== 'READY') {
    throw new ServiceError(409, 'CONFLICT', 'Asset is not ready for public media.')
  }
  return row
}

function processingSource(
  sqlite: Database.Database,
  sourceAsset: AssetSource,
): ProcessingSource {
  if (sourceAsset.byteSize <= 20_000_000) {
    return {
      inputSha256: sourceAsset.sha256,
      objectKey: sourceAsset.privateObjectKey,
      sourceVariantId: null,
    }
  }
  const row = sqlite.prepare(`
    SELECT id, object_key AS objectKey, sha256
    FROM asset_variants
    WHERE asset_id = ? AND storage_scope = 'PRIVATE'
      AND status = 'READY' AND usage = 'preprocess'
      AND input_sha256 = ? AND byte_size <= 20000000
      AND width <= 4096 AND height <= 4096
    ORDER BY created_at DESC LIMIT 1
  `).get(sourceAsset.id, sourceAsset.sha256) as {
    id: string
    objectKey: string
    sha256: string
  } | undefined
  if (!row) {
    throw new ServiceError(409, 'CONFLICT', 'Asset has no ready private processing source.')
  }
  return {
    inputSha256: row.sha256,
    objectKey: row.objectKey,
    sourceVariantId: row.id,
  }
}

function environmentPrefix(privateObjectKey: string) {
  const marker = privateObjectKey.indexOf('/original/')
  if (marker < 1) {
    throw new Error('Original object key has no environment prefix.')
  }
  return privateObjectKey.slice(0, marker)
}

function defaultUsages(role: MediaRole): PublicMediaUsage[] {
  if (role === 'studio_photo') {
    return ['work-card', 'detail']
  }
  if (role === 'design_sheet') {
    return ['design-sheet']
  }
  if (role === 'watermark_logo') {
    return []
  }
  return role === 'home_hero_landscape'
    ? ['home-hero-landscape']
    : ['home-hero-portrait']
}

export function workAssetPublicUsages(
  role: 'design_sheet' | 'studio_photo',
  primary: boolean,
  hasPrimaryStudioPhoto: boolean,
): PublicMediaUsage[] {
  if (role === 'studio_photo') {
    return primary ? ['work-card', 'detail'] : ['detail']
  }
  return hasPrimaryStudioPhoto
    ? ['design-sheet']
    : ['design-sheet', 'work-card']
}

function gravity(focalX: number, focalY: number) {
  const horizontal = focalX < 1 / 3 ? 'w' : focalX > 2 / 3 ? 'e' : ''
  const vertical = focalY < 1 / 3 ? 'n' : focalY > 2 / 3 ? 's' : ''
  return `${vertical}${horizontal}` || 'center'
}

export function urlSafeBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function outputHeight(usage: PublicMediaUsage, width: number) {
  const aspect = recipes[usage].aspect
  return aspect ? Math.round(width * aspect[1] / aspect[0]) : null
}

export function sourceSupportsPublicUsages(
  source: PublicRecipeSourceGeometry,
  usages: readonly PublicMediaUsage[],
) {
  return usages.every((usage) => {
    const width = recipes[usage].widths.at(-1)!
    const height = outputHeight(usage, width)
    const availableWidth = usage === 'work-card'
      ? Math.round(source.width * (source.cropWidth ?? 1))
      : source.width
    const availableHeight = usage === 'work-card'
      ? Math.round(source.height * (source.cropHeight ?? 1))
      : source.height
    if (height === null) {
      return availableWidth >= width
    }
    if (source.role === 'design_sheet') {
      return availableWidth >= width || availableHeight >= height
    }
    return availableWidth >= width && availableHeight >= height
  })
}

function formatOperation(format: PublicFormat) {
  if (format === 'png') {
    return 'format,png'
  }
  return `quality,q_${format === 'webp' ? 82 : 86}/format,${
    format === 'jpeg' ? 'jpg' : 'webp'
  }`
}

function resizeOperation(
  sourceAsset: AssetSource,
  usage: PublicMediaUsage,
  width: number,
) {
  const height = outputHeight(usage, width)
  if (height === null) {
    return `resize,m_lfit,w_${width}`
  }
  const cropped = usage === 'work-card'
    && (
      sourceAsset.cropX !== 0
      || sourceAsset.cropY !== 0
      || sourceAsset.cropWidth !== 1
      || sourceAsset.cropHeight !== 1
    )
  const crop = cropped
    ? `crop,w_${Math.round(sourceAsset.width * sourceAsset.cropWidth)},h_${Math.round(sourceAsset.height * sourceAsset.cropHeight)},x_${Math.round(sourceAsset.width * sourceAsset.cropX)},y_${Math.round(sourceAsset.height * sourceAsset.cropY)}/`
    : ''
  if (sourceAsset.role === 'design_sheet') {
    return `${crop}resize,m_pad,w_${width},h_${height},color_F7F7F7`
  }
  return `${crop}resize,m_fill,w_${width},h_${height},g_${gravity(
    sourceAsset.focalX,
    sourceAsset.focalY,
  )}`
}

function recipeIdentity(
  sourceAsset: AssetSource,
  source: ProcessingSource,
  profile: WatermarkProfileRow,
  usage: PublicMediaUsage,
  width: number,
  format: PublicFormat,
) {
  const height = outputHeight(usage, width)
  const identity = JSON.stringify({
    recipeVersion: PUBLIC_RECIPE_VERSION,
    sourceSha256: source.inputSha256,
    sourceVariantId: source.sourceVariantId,
    mediaRole: sourceAsset.role,
    usage,
    width,
    height,
    fit: height === null
      ? 'contain'
      : sourceAsset.role === 'design_sheet' ? 'pad' : 'cover',
    focalX: sourceAsset.focalX,
    focalY: sourceAsset.focalY,
    crop: usage === 'work-card'
      ? {
          x: sourceAsset.cropX,
          y: sourceAsset.cropY,
          width: sourceAsset.cropWidth,
          height: sourceAsset.cropHeight,
        }
      : null,
    background: sourceAsset.role === 'design_sheet' && height !== null
      ? 'F7F7F7'
      : null,
    format,
    quality: format === 'webp' ? 82 : format === 'jpeg' ? 86 : 100,
    watermarkProfile: profile.profileName,
    watermarkProfileId: profile.id,
    watermarkConfigDigest: profile.configDigest,
    logoDigest: profile.logoDigest,
    watermarkPosition: profile.position,
    watermarkOpacityPercent: profile.opacityPercent,
    watermarkScalePercent: profile.scalePercent,
  })
  return {
    hash: digest('sha256', Buffer.from(identity)),
    identity,
  }
}

function deterministicUuid(hash: string) {
  const bytes = Buffer.from(hash.slice(0, 32), 'hex')
  bytes[6] = (bytes[6]! & 0x0f) | 0x50
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const value = bytes.toString('hex')
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join('-')
}

function publicObjectKey(
  sourceAsset: AssetSource,
  usage: PublicMediaUsage,
  width: number,
  identityHash: string,
  format: PublicFormat,
) {
  const extension = format === 'jpeg' ? 'jpg' : format
  return `${environmentPrefix(sourceAsset.privateObjectKey)}/web/${sourceAsset.id}/${PUBLIC_RECIPE_VERSION}/${usage}/${width}/${identityHash}.${extension}`
}

export function buildCenteredWatermarkProcess(
  sourceAsset: AssetSource,
  logo: WatermarkSource,
  profile: WatermarkProfileRow,
  usage: PublicMediaUsage,
  width: number,
  format: PublicFormat,
) {
  const resizedLogo = `${logo.objectKey}?x-oss-process=image/resize,P_${profile.scalePercent}`
  return [
    `image/${resizeOperation(sourceAsset, usage, width)}`,
    [
      `watermark,image_${urlSafeBase64(resizedLogo)}`,
      `t_${profile.opacityPercent}`,
      'g_center',
    ].join(','),
    formatOperation(format),
  ].join('/')
}

function normalizedFormat(format: string): PublicFormat | null {
  const value = format.toLowerCase()
  if (value === 'jpg' || value === 'jpeg') {
    return 'jpeg'
  }
  return value === 'webp' || value === 'png' ? value : null
}

function contentType(format: PublicFormat) {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`
}

function existingVariant(
  sqlite: Database.Database,
  objectKey: string,
) {
  return sqlite.prepare(`${selectReadyVariant} AND object_key = ?`)
    .get(objectKey) as ReadyPublicVariant | undefined
}

async function verifyPublicVariant(
  storage: MediaStorage,
  variant: ReadyPublicVariant,
) {
  const [head, info, anonymous] = await Promise.all([
    storage.headPublic(variant.objectKey),
    storage.imageInfoPublic(variant.objectKey),
    storage.getPublicAnonymous(variant.objectKey),
  ])
  return head.byteSize === variant.byteSize
    && head.byteSize === anonymous.content.length
    && head.etagMd5Hex === digest('md5', anonymous.content)
    && head.contentType === contentType(variant.format)
    && anonymous.contentType === contentType(variant.format)
    && info.fileSize === head.byteSize
    && normalizedFormat(info.format) === variant.format
    && info.width === variant.width
    && info.height === variant.height
    && digest('sha256', anonymous.content) === variant.sha256
}

async function generateOne(
  sqlite: Database.Database,
  storage: MediaStorage,
  sourceAsset: AssetSource,
  source: ProcessingSource,
  profile: WatermarkProfileRow,
  logo: WatermarkSource,
  usage: PublicMediaUsage,
  width: number,
  format: PublicFormat,
  now: number,
) {
  const identity = recipeIdentity(
    sourceAsset,
    source,
    profile,
    usage,
    width,
    format,
  )
  const objectKey = publicObjectKey(
    sourceAsset,
    usage,
    width,
    identity.hash,
    format,
  )
  const existing = existingVariant(sqlite, objectKey)
  if (existing && await verifyPublicVariant(storage, existing)) {
    return existing
  }

  try {
    await storage.processPrivateToPublic({
      sourceObjectKey: source.objectKey,
      objectKey,
      process: buildCenteredWatermarkProcess(
        sourceAsset,
        logo,
        profile,
        usage,
        width,
        format,
      ),
    })
    const [head, info, anonymous] = await Promise.all([
      storage.headPublic(objectKey),
      storage.imageInfoPublic(objectKey),
      storage.getPublicAnonymous(objectKey),
    ])
    const expectedHeight = outputHeight(usage, width)
    const sha256 = digest('sha256', anonymous.content)
    if (
      head.byteSize < 1
      || head.byteSize !== anonymous.content.length
      || head.etagMd5Hex !== digest('md5', anonymous.content)
      || head.contentType !== contentType(format)
      || anonymous.contentType !== contentType(format)
      || info.fileSize !== head.byteSize
      || normalizedFormat(info.format) !== format
      || info.width !== width
      || (expectedHeight !== null && info.height !== expectedHeight)
    ) {
      throw new Error('Public variant verification failed.')
    }

    const id = deterministicUuid(digest(
      'sha256',
      Buffer.from(`${sourceAsset.id}:${identity.hash}`),
    ))
    try {
      const stale = sqlite.prepare(`
        SELECT id FROM asset_variants WHERE object_key = ?
      `).get(objectKey) as { id: string } | undefined
      if (stale) {
        sqlite.prepare(`
          UPDATE asset_variants
          SET status = 'READY', sha256 = ?, byte_size = ?,
              internal_error_code = NULL, version = version + 1,
              updated_at = ?
          WHERE id = ?
        `).run(sha256, head.byteSize, now, stale.id)
      }
      else {
        sqlite.prepare(`
          INSERT INTO asset_variants (
          id, asset_id, source_variant_id, storage_scope, status,
          object_key, input_sha256, media_role, usage, width, height,
          format, quality, crop_identity, recipe_version,
          watermark_profile, watermark_profile_id,
          watermark_config_digest, logo_digest, watermark_anchor,
          watermark_opacity_percent, watermark_scale_percent,
          sha256, byte_size, created_at, updated_at
          ) VALUES (?, ?, ?, 'PUBLIC', 'READY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          sourceAsset.id,
          source.sourceVariantId,
          objectKey,
          source.inputSha256,
          sourceAsset.role,
          usage,
          info.width,
          info.height,
          format,
          format === 'webp' ? 82 : format === 'jpeg' ? 86 : 100,
          identity.hash,
          PUBLIC_RECIPE_VERSION,
          profile.profileName,
          profile.id,
          profile.configDigest,
          profile.logoDigest,
          profile.position,
          profile.opacityPercent,
          profile.scalePercent,
          sha256,
          head.byteSize,
          now,
          now,
        )
      }
    }
    catch (error) {
      const raced = existingVariant(sqlite, objectKey)
      if (raced) {
        return raced
      }
      throw error
    }
    return existingVariant(sqlite, objectKey)!
  }
  catch (error) {
    const candidate = error as {
      code?: unknown
      data?: { Code?: unknown }
      name?: unknown
      requestId?: unknown
      status?: unknown
    }
    safeLog('error', 'Public media variant generation failed.', {
      assetId: sourceAsset.id,
      errorCode: candidate.code,
      errorName: candidate.name,
      format,
      requestId: candidate.requestId,
      serviceCode: candidate.data?.Code,
      status: candidate.status,
      usage,
      width,
    })
    try {
      await storage.deletePublic(objectKey)
    }
    catch {
      throw new ServiceError(500, 'INTERNAL_ERROR', 'Public media cleanup failed.')
    }
    if (error instanceof ServiceError) {
      throw error
    }
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Public media generation failed.')
  }
}

export function publicVariantCountForUsages(
  usages: readonly PublicMediaUsage[],
) {
  return usages.reduce(
    (count, usage) => count + (recipes[usage].widths.length * 2),
    0,
  )
}

export async function generatePublicVariantsForProfile(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
  profileId: string,
  usages?: readonly PublicMediaUsage[],
  now = Date.now(),
) {
  const sourceAsset = asset(sqlite, assetId)
  const selectedUsages = usages ?? defaultUsages(sourceAsset.role)
  if (
    selectedUsages.length === 0
    || new Set(selectedUsages).size !== selectedUsages.length
    || selectedUsages.some(
      usage => !recipes[usage].roles.includes(sourceAsset.role as never),
    )
  ) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Media usage does not match asset role.')
  }
  if (!sourceSupportsPublicUsages(sourceAsset, selectedUsages)) {
    throw new ServiceError(409, 'CONFLICT', 'Media source does not meet public recipe dimensions.')
  }
  const source = processingSource(sqlite, sourceAsset)
  const profile = requireWatermarkProfile(sqlite, profileId)
  if (!['APPLYING', 'ACTIVE'].includes(profile.status)) {
    throw new ServiceError(409, 'CONFLICT', 'Watermark profile is not usable.')
  }
  const logo = watermarkSource(sqlite, profile)
  const fallback: PublicFormat = sourceAsset.mimeType === 'image/png'
    ? 'png'
    : 'jpeg'
  const variants: ReadyPublicVariant[] = []
  for (const usage of selectedUsages) {
    for (const width of recipes[usage].widths) {
      for (const format of ['webp', fallback] as const) {
        variants.push(await generateOne(
          sqlite,
          storage,
          sourceAsset,
          source,
          profile,
          logo,
          usage,
          width,
          format,
          now,
        ))
      }
    }
  }
  return variants
}

export async function generatePublicVariants(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
  usages?: readonly PublicMediaUsage[],
  now = Date.now(),
) {
  return generatePublicVariantsForProfile(
    sqlite,
    storage,
    assetId,
    requireActiveWatermarkProfile(sqlite).id,
    usages,
    now,
  )
}

export async function generatePrivateWatermarkPreview(
  sqlite: Database.Database,
  storage: MediaStorage,
  input: {
    assetId: string
    objectKey: string
    profileId: string
    usage: PublicMediaUsage
    width: number
  },
) {
  const sourceAsset = asset(sqlite, input.assetId)
  if (!recipes[input.usage].widths.includes(input.width as never)) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Preview width is invalid.')
  }
  const source = processingSource(sqlite, sourceAsset)
  const profile = requireWatermarkProfile(sqlite, input.profileId)
  if (!['DRAFT', 'FAILED', 'ACTIVE'].includes(profile.status)) {
    throw new ServiceError(409, 'CONFLICT', 'Watermark profile cannot be previewed.')
  }
  const logo = watermarkSource(sqlite, profile)
  const process = buildCenteredWatermarkProcess(
    sourceAsset,
    logo,
    profile,
    input.usage,
    input.width,
    'webp',
  )
  await storage.processPrivateToPrivate({
    sourceObjectKey: source.objectKey,
    objectKey: input.objectKey,
    process,
  })
  const [head, info, signed] = await Promise.all([
    storage.headPrivate(input.objectKey),
    storage.imageInfoPrivate(input.objectKey),
    storage.getPrivateSigned(input.objectKey, Date.now() + 60_000),
  ])
  const height = outputHeight(input.usage, input.width)
  if (
    head.byteSize < 1
    || head.byteSize !== signed.content.length
    || head.contentType !== 'image/webp'
    || signed.contentType !== 'image/webp'
    || info.fileSize !== head.byteSize
    || normalizedFormat(info.format) !== 'webp'
    || info.width !== input.width
    || (height !== null && info.height !== height)
  ) {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Watermark preview verification failed.')
  }
  return {
    format: 'webp' as const,
    height: info.height,
    width: info.width,
  }
}

export async function renderActiveWatermarkPreview(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
  usage: 'design-sheet' | 'detail' | 'work-card',
) {
  const sourceAsset = asset(sqlite, assetId)
  const marker = sourceAsset.privateObjectKey.indexOf('/original/')
  if (marker < 1) {
    throw new ServiceError(409, 'CONFLICT', 'Media asset cannot be previewed.')
  }
  const width = usage === 'work-card' ? 480 : 960
  const objectKey = `${sourceAsset.privateObjectKey.slice(0, marker)}/preview/work/${assetId}/${randomUUID()}.webp`
  try {
    await generatePrivateWatermarkPreview(sqlite, storage, {
      assetId,
      objectKey,
      profileId: requireActiveWatermarkProfile(sqlite).id,
      usage,
      width,
    })
    return await storage.getPrivate(objectKey)
  }
  finally {
    await storage.deletePrivate(objectKey)
  }
}

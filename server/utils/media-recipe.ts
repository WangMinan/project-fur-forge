import {
  createHash,
} from 'node:crypto'
import {
  existsSync,
  readFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import type {
  MediaRole,
  WatermarkAnchor,
} from '../../shared/types/contracts'
import type { MediaStorage } from './media-storage'
import { ServiceError } from './service-error'

export const PUBLIC_RECIPE_VERSION = 'recipe-v1'
export const STANDARD_WATERMARK_PROFILE = 'brand-standard-v1'

const WATERMARK = {
  marginPx: 24,
  scalePercent: 15,
  transparency: 70,
} as const

export type PublicMediaUsage =
  | 'work-card'
  | 'home-hero-landscape'
  | 'home-hero-portrait'
  | 'design-sheet'
  | 'detail'

type PublicFormat = 'webp' | 'jpeg' | 'png'

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
  watermarkAnchor: WatermarkAnchor
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
  watermarkAnchor: WatermarkAnchor
  watermarkProfile: typeof STANDARD_WATERMARK_PROFILE
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

const selectReadyVariant = `
  SELECT
    id, asset_id AS assetId, source_variant_id AS sourceVariantId,
    object_key AS objectKey, input_sha256 AS inputSha256,
    media_role AS mediaRole, usage, width, height, format,
    recipe_version AS recipeVersion, watermark_profile AS watermarkProfile,
    logo_digest AS logoDigest, watermark_anchor AS watermarkAnchor,
    sha256, byte_size AS byteSize
  FROM asset_variants
  WHERE storage_scope = 'PUBLIC' AND status = 'READY'
`

function digest(algorithm: 'md5' | 'sha256', content: Buffer) {
  return createHash(algorithm).update(content).digest('hex')
}

function contentMd5(content: Buffer) {
  return createHash('md5').update(content).digest('base64')
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
      COALESCE(relation.crop_height, 1) AS cropHeight,
      COALESCE(relation.watermark_anchor, asset.watermark_anchor) AS watermarkAnchor
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

function watermarkLogo() {
  const candidates = [
    resolve(process.cwd(), '.output/public/brand/logo-full-light.png'),
    resolve(process.cwd(), 'public/brand/logo-full-light.png'),
  ]
  const path = candidates.find(existsSync)
  if (!path) {
    throw new Error('Watermark logo is unavailable.')
  }
  const content = readFileSync(path)
  return {
    content,
    sha256: digest('sha256', content),
  }
}

function environmentPrefix(privateObjectKey: string) {
  const marker = privateObjectKey.indexOf('/original/')
  if (marker < 1) {
    throw new Error('Original object key has no environment prefix.')
  }
  return privateObjectKey.slice(0, marker)
}

async function ensureWatermarkLogo(
  storage: MediaStorage,
  privateObjectKey: string,
) {
  const logo = watermarkLogo()
  const objectKey = `${environmentPrefix(privateObjectKey)}/brand/watermark/${logo.sha256}.png`
  await storage.putPrivateConditional({
    content: logo.content,
    contentMd5: contentMd5(logo.content),
    contentType: 'image/png',
    objectKey,
    sha256: logo.sha256,
  })
  const head = await storage.headPrivate(objectKey)
  if (
    head.byteSize !== logo.content.length
    || head.contentType !== 'image/png'
    || head.etagMd5Hex !== digest('md5', logo.content)
    || head.sha256Metadata !== logo.sha256
  ) {
    throw new Error('Private watermark source verification failed.')
  }
  return { ...logo, objectKey }
}

function defaultUsages(role: MediaRole): PublicMediaUsage[] {
  if (role === 'studio_photo') {
    return ['work-card', 'detail']
  }
  if (role === 'design_sheet') {
    return ['design-sheet', 'work-card', 'detail']
  }
  return role === 'home_hero_landscape'
    ? ['home-hero-landscape']
    : ['home-hero-portrait']
}

function gravity(focalX: number, focalY: number) {
  const horizontal = focalX < 1 / 3 ? 'w' : focalX > 2 / 3 ? 'e' : ''
  const vertical = focalY < 1 / 3 ? 'n' : focalY > 2 / 3 ? 's' : ''
  return `${vertical}${horizontal}` || 'center'
}

function ossAnchor(anchor: WatermarkAnchor) {
  return {
    'top-left': 'nw',
    'top-right': 'ne',
    'bottom-left': 'sw',
    'bottom-right': 'se',
  }[anchor]
}

function urlSafeBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function outputHeight(usage: PublicMediaUsage, width: number) {
  const aspect = recipes[usage].aspect
  return aspect ? Math.round(width * aspect[1] / aspect[0]) : null
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
  logoDigest: string,
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
    background: sourceAsset.role === 'design_sheet' ? 'F7F7F7' : null,
    format,
    quality: format === 'webp' ? 82 : format === 'jpeg' ? 86 : 100,
    watermarkProfile: STANDARD_WATERMARK_PROFILE,
    logoDigest,
    watermarkScalePercent: WATERMARK.scalePercent,
    watermarkTransparency: WATERMARK.transparency,
    watermarkMarginPx: WATERMARK.marginPx,
    watermarkAnchor: sourceAsset.watermarkAnchor,
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

function processString(
  sourceAsset: AssetSource,
  logoKey: string,
  usage: PublicMediaUsage,
  width: number,
  format: PublicFormat,
) {
  return [
    `image/${resizeOperation(sourceAsset, usage, width)}`,
    [
      `watermark,image_${urlSafeBase64(logoKey)}`,
      `t_${WATERMARK.transparency}`,
      `P_${WATERMARK.scalePercent}`,
      `g_${ossAnchor(sourceAsset.watermarkAnchor)}`,
      `x_${WATERMARK.marginPx}`,
      `y_${WATERMARK.marginPx}`,
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

async function generateOne(
  sqlite: Database.Database,
  storage: MediaStorage,
  sourceAsset: AssetSource,
  source: ProcessingSource,
  logo: { objectKey: string, sha256: string },
  usage: PublicMediaUsage,
  width: number,
  format: PublicFormat,
  now: number,
) {
  const identity = recipeIdentity(
    sourceAsset,
    source,
    logo.sha256,
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
  if (existing) {
    return existing
  }

  try {
    await storage.processPrivateToPublic({
      sourceObjectKey: source.objectKey,
      objectKey,
      process: processString(
        sourceAsset,
        logo.objectKey,
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

    const id = deterministicUuid(identity.hash)
    try {
      sqlite.prepare(`
        INSERT INTO asset_variants (
          id, asset_id, source_variant_id, storage_scope, status,
          object_key, input_sha256, media_role, usage, width, height,
          format, quality, crop_identity, recipe_version,
          watermark_profile, logo_digest, watermark_anchor,
          sha256, byte_size, created_at, updated_at
        ) VALUES (?, ?, ?, 'PUBLIC', 'READY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        STANDARD_WATERMARK_PROFILE,
        logo.sha256,
        sourceAsset.watermarkAnchor,
        sha256,
        head.byteSize,
        now,
        now,
      )
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

export async function generatePublicVariants(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
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
  const source = processingSource(sqlite, sourceAsset)
  let logo
  try {
    logo = await ensureWatermarkLogo(storage, sourceAsset.privateObjectKey)
  }
  catch {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Watermark source is unavailable.')
  }
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

import type Database from 'better-sqlite3'
import type { MediaRole } from '../../shared/types/contracts'
import {
  contentTypeForFormat,
  deterministicUuid,
  digest,
  environmentPrefix,
  gravity,
  normalizedFormat,
  processingSource,
  readyAssetSource,
} from './media-source'
import type {
  AssetSource,
  ProcessingSource,
  PublicFormat,
} from './media-source'
import type { MediaStorage } from './media-storage'
import { safeLog } from './safe-log'
import { ServiceError } from './service-error'

/** 站点展示配方：首页与委托页大图、首页业务入口，全部不打水印。 */
export const SITE_DISPLAY_RECIPE_VERSION = 'site-display-v1'

export type SiteDisplayUsage =
  | 'home-hero-landscape'
  | 'home-hero-portrait'
  | 'commission-hero-landscape'
  | 'commission-hero-portrait'
  | 'home-entry-commission'
  | 'home-entry-adoption'

interface SiteDisplayRecipe {
  aspect: readonly [number, number]
  roles: readonly MediaRole[]
  widths: readonly number[]
}

const recipes = {
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
  'commission-hero-landscape': {
    roles: ['home_hero_landscape'],
    widths: [768, 1280, 1920],
    aspect: [16, 9],
  },
  'commission-hero-portrait': {
    roles: ['home_hero_portrait'],
    widths: [480, 768, 1080],
    aspect: [9, 16],
  },
  'home-entry-commission': {
    roles: ['home_hero_landscape'],
    widths: [480, 768, 1080],
    aspect: [3, 2],
  },
  'home-entry-adoption': {
    roles: ['design_sheet'],
    widths: [480, 768, 1080],
    aspect: [3, 2],
  },
} as const satisfies Record<SiteDisplayUsage, SiteDisplayRecipe>

export const SITE_DISPLAY_USAGES = Object.keys(recipes) as SiteDisplayUsage[]

export const HOME_ENTRY_USAGES = {
  commission: 'home-entry-commission',
  adoption: 'home-entry-adoption',
} as const satisfies Record<'adoption' | 'commission', SiteDisplayUsage>

export const SITE_HERO_USAGES = {
  home: {
    landscape: 'home-hero-landscape',
    portrait: 'home-hero-portrait',
  },
  commission: {
    landscape: 'commission-hero-landscape',
    portrait: 'commission-hero-portrait',
  },
} as const satisfies Record<'commission' | 'home', {
  landscape: SiteDisplayUsage
  portrait: SiteDisplayUsage
}>

export function siteDisplayWidths(usage: SiteDisplayUsage) {
  return recipes[usage].widths
}

export function siteDisplayHeight(usage: SiteDisplayUsage, width: number) {
  const [horizontal, vertical] = recipes[usage].aspect
  return Math.round(width * vertical / horizontal)
}

export function siteDisplayVariantCount(
  usages: readonly SiteDisplayUsage[],
) {
  return usages.reduce(
    (count, usage) => count + recipes[usage].widths.length * 2,
    0,
  )
}

/** 站点展示位不裁掉主体：只要求最大宽高在输入范围内。 */
export function sourceSupportsSiteDisplay(
  source: { height: number, width: number },
  usages: readonly SiteDisplayUsage[],
) {
  return usages.every((usage) => {
    const width = recipes[usage].widths.at(-1)!
    return source.width >= width && source.height >= siteDisplayHeight(usage, width)
  })
}

export function assetSupportsSiteDisplay(
  sqlite: Database.Database,
  assetId: string,
  usages: readonly SiteDisplayUsage[],
) {
  const sourceAsset = readyAssetSource(sqlite, assetId)
  if (usages.some(
    usage => !recipes[usage].roles.includes(sourceAsset.role as never),
  )) {
    return false
  }
  const source = processingSource(sqlite, sourceAsset)
  return sourceSupportsSiteDisplay(source, usages)
}

export interface ReadySiteDisplayVariant {
  assetId: string
  byteSize: number
  format: PublicFormat
  height: number
  id: string
  inputSha256: string
  mediaRole: MediaRole
  objectKey: string
  protectionMode: 'none'
  recipeVersion: typeof SITE_DISPLAY_RECIPE_VERSION
  sha256: string
  sourceVariantId: string | null
  usage: SiteDisplayUsage
  width: number
}

const selectReadySiteDisplayVariant = `
  SELECT
    id, asset_id AS assetId, source_variant_id AS sourceVariantId,
    object_key AS objectKey, input_sha256 AS inputSha256,
    media_role AS mediaRole, usage, width, height, format,
    recipe_version AS recipeVersion, protection_mode AS protectionMode,
    sha256, byte_size AS byteSize
  FROM asset_variants
  WHERE storage_scope = 'PUBLIC' AND status = 'READY'
    AND protection_mode = 'none'
    AND recipe_version = '${SITE_DISPLAY_RECIPE_VERSION}'
`

function existingVariant(sqlite: Database.Database, objectKey: string) {
  return sqlite.prepare(`${selectReadySiteDisplayVariant} AND object_key = ?`)
    .get(objectKey) as ReadySiteDisplayVariant | undefined
}

function resizeOperation(usage: SiteDisplayUsage, source: AssetSource, width: number) {
  const height = siteDisplayHeight(usage, width)
  return `resize,m_fill,w_${width},h_${height},g_${gravity(
    source.focalX,
    source.focalY,
  )}`
}

function formatOperation(format: PublicFormat) {
  if (format === 'png') {
    return 'format,png'
  }
  return `quality,q_${format === 'webp' ? 82 : 86}/format,${
    format === 'jpeg' ? 'jpg' : 'webp'
  }`
}

/** 无水印处理串：只有缩放、格式与质量，不携带任何水印算子。 */
export function buildSiteDisplayProcess(
  source: AssetSource,
  usage: SiteDisplayUsage,
  width: number,
  format: PublicFormat,
) {
  return [
    `image/${resizeOperation(usage, source, width)}`,
    formatOperation(format),
  ].join('/')
}

function qualityFor(format: PublicFormat) {
  return format === 'webp' ? 82 : format === 'jpeg' ? 86 : 100
}

function recipeIdentity(
  sourceAsset: AssetSource,
  source: ProcessingSource,
  usage: SiteDisplayUsage,
  width: number,
  format: PublicFormat,
) {
  const identity = JSON.stringify({
    recipeVersion: SITE_DISPLAY_RECIPE_VERSION,
    protectionMode: 'none',
    sourceSha256: source.inputSha256,
    sourceVariantId: source.sourceVariantId,
    mediaRole: sourceAsset.role,
    usage,
    width,
    height: siteDisplayHeight(usage, width),
    fit: 'cover',
    focalX: sourceAsset.focalX,
    focalY: sourceAsset.focalY,
    format,
    quality: qualityFor(format),
  })
  return digest('sha256', Buffer.from(identity))
}

function publicObjectKey(
  sourceAsset: AssetSource,
  usage: SiteDisplayUsage,
  width: number,
  identityHash: string,
  format: PublicFormat,
) {
  const extension = format === 'jpeg' ? 'jpg' : format
  return `${environmentPrefix(sourceAsset.privateObjectKey)}/web/${sourceAsset.id}/${SITE_DISPLAY_RECIPE_VERSION}/${usage}/${width}/${identityHash}.${extension}`
}

async function verifyVariant(
  storage: MediaStorage,
  variant: ReadySiteDisplayVariant,
) {
  const [head, info, anonymous] = await Promise.all([
    storage.headPublic(variant.objectKey),
    storage.imageInfoPublic(variant.objectKey),
    storage.getPublicAnonymous(variant.objectKey),
  ])
  return head.byteSize === variant.byteSize
    && head.byteSize === anonymous.content.length
    && head.etagMd5Hex === digest('md5', anonymous.content)
    && head.contentType === contentTypeForFormat(variant.format)
    && anonymous.contentType === contentTypeForFormat(variant.format)
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
  usage: SiteDisplayUsage,
  width: number,
  format: PublicFormat,
  now: number,
) {
  const identityHash = recipeIdentity(sourceAsset, source, usage, width, format)
  const objectKey = publicObjectKey(
    sourceAsset,
    usage,
    width,
    identityHash,
    format,
  )
  const existing = existingVariant(sqlite, objectKey)
  if (existing && await verifyVariant(storage, existing)) {
    return existing
  }

  try {
    await storage.processPrivateToPublic({
      sourceObjectKey: source.objectKey,
      objectKey,
      process: buildSiteDisplayProcess(sourceAsset, usage, width, format),
    })
    const [head, info, anonymous] = await Promise.all([
      storage.headPublic(objectKey),
      storage.imageInfoPublic(objectKey),
      storage.getPublicAnonymous(objectKey),
    ])
    const expectedHeight = siteDisplayHeight(usage, width)
    const sha256 = digest('sha256', anonymous.content)
    if (
      head.byteSize < 1
      || head.byteSize !== anonymous.content.length
      || head.etagMd5Hex !== digest('md5', anonymous.content)
      || head.contentType !== contentTypeForFormat(format)
      || anonymous.contentType !== contentTypeForFormat(format)
      || info.fileSize !== head.byteSize
      || normalizedFormat(info.format) !== format
      || info.width !== width
      || info.height !== expectedHeight
    ) {
      throw new Error('Site display variant verification failed.')
    }
    const id = deterministicUuid(digest(
      'sha256',
      Buffer.from(`${sourceAsset.id}:${identityHash}`),
    ))
    try {
      sqlite.prepare(`
        INSERT INTO asset_variants (
          id, asset_id, source_variant_id, storage_scope, status,
          object_key, input_sha256, media_role, usage, width, height,
          format, quality, crop_identity, recipe_version, protection_mode,
          watermark_profile, watermark_profile_id, watermark_config_digest,
          logo_digest, watermark_anchor, watermark_opacity_percent,
          watermark_scale_percent, sha256, byte_size, created_at, updated_at
        ) VALUES (?, ?, ?, 'PUBLIC', 'READY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  'none', 'none', NULL, 'none', 'none', 'none', NULL, NULL,
                  ?, ?, ?, ?)
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
        qualityFor(format),
        identityHash,
        SITE_DISPLAY_RECIPE_VERSION,
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
    const candidate = error as {
      code?: unknown
      data?: { Code?: unknown }
      name?: unknown
      requestId?: unknown
      status?: unknown
    }
    safeLog('error', 'Site display variant generation failed.', {
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
      throw new ServiceError(500, 'INTERNAL_ERROR', 'Site display media cleanup failed.')
    }
    if (error instanceof ServiceError) {
      throw error
    }
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Site display media generation failed.')
  }
}

/**
 * 预生成站点无水印展示变体。失败只清理本次新建对象；已启用的旧公开引用
 * 不受影响，因此迁移失败时公开页面保持可用。
 */
export async function generateSiteDisplayVariants(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
  usages: readonly SiteDisplayUsage[],
  now = Date.now(),
) {
  const sourceAsset = readyAssetSource(sqlite, assetId)
  if (
    usages.length === 0
    || new Set(usages).size !== usages.length
    || usages.some(usage => !recipes[usage].roles.includes(sourceAsset.role as never))
  ) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Site display usage does not match asset role.')
  }
  const source = processingSource(sqlite, sourceAsset)
  if (!sourceSupportsSiteDisplay(source, usages)) {
    throw new ServiceError(409, 'CONFLICT', 'Media source does not meet site display dimensions.', 'MEDIA_SOURCE_TOO_SMALL')
  }
  const fallback: PublicFormat = sourceAsset.mimeType === 'image/png'
    ? 'png'
    : 'jpeg'
  const variants: ReadySiteDisplayVariant[] = []
  for (const usage of usages) {
    for (const width of recipes[usage].widths) {
      for (const format of ['webp', fallback] as const) {
        variants.push(await generateOne(
          sqlite,
          storage,
          sourceAsset,
          source,
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

export interface SiteDisplayVariantCandidate {
  byteSize: number | null
  format: 'webp' | 'jpeg' | 'png'
  height: number
  protectionMode: string
  recipeVersion: string
  sha256: string | null
  status: string
  storageScope: string
  usage: string
  width: number
}

const digestPattern = /^[0-9a-f]{64}$/u

function eligible<T extends SiteDisplayVariantCandidate>(
  usage: SiteDisplayUsage,
  variants: readonly T[],
) {
  const widths = recipes[usage].widths as readonly number[]
  return variants.filter(variant => (
    variant.storageScope === 'PUBLIC'
    && variant.status === 'READY'
    && variant.usage === usage
    && variant.recipeVersion === SITE_DISPLAY_RECIPE_VERSION
    && variant.protectionMode === 'none'
    && variant.sha256 !== null
    && digestPattern.test(variant.sha256)
    && variant.byteSize !== null
    && variant.byteSize > 0
    && widths.includes(variant.width)
    && variant.height === siteDisplayHeight(usage, variant.width)
  ))
}

export function missingSiteDisplayVariantCount(
  usage: SiteDisplayUsage,
  variants: readonly SiteDisplayVariantCandidate[],
) {
  const matched = eligible(usage, variants)
  let missing = 0
  for (const width of recipes[usage].widths) {
    const formats = new Set(
      matched.filter(variant => variant.width === width)
        .map(variant => variant.format),
    )
    if (!formats.has('webp')) {
      missing += 1
    }
    if (!formats.has('jpeg') && !formats.has('png')) {
      missing += 1
    }
  }
  return missing
}

/** 完整命中才返回；缺任何宽度或 fallback 都视为不可投影。 */
export function completeSiteDisplayVariants<T extends SiteDisplayVariantCandidate>(
  usage: SiteDisplayUsage,
  variants: readonly T[],
) {
  return missingSiteDisplayVariantCount(usage, variants) === 0
    ? eligible(usage, variants)
    : null
}

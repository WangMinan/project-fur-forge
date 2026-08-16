import type Database from 'better-sqlite3'
import type { MediaRole } from '../../../shared/types/contracts'
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
import type { MediaStorage } from '../media-storage'
import { safeLog } from '../safe-log'
import { ServiceError } from '../service-error'
import {
  findReadySiteDisplayVariant,
  insertSiteDisplayVariant,
} from '../repository/variant-repository'

/** 站点展示配方：首页与委托页大图、首页业务入口，全部不打水印。 */
export const SITE_DISPLAY_RECIPE_VERSION = 'site-display-v2'
export const LEGACY_SITE_DISPLAY_RECIPE_VERSION = 'site-display-v1'

export type SiteDisplayRecipeVersion =
  | typeof SITE_DISPLAY_RECIPE_VERSION
  | typeof LEGACY_SITE_DISPLAY_RECIPE_VERSION

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

const legacyRecipes = {
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
    roles: ['adoption_cover'],
    widths: [480, 768, 1080],
    aspect: [3, 2],
  },
} as const satisfies Record<SiteDisplayUsage, SiteDisplayRecipe>

const recipes = {
  ...legacyRecipes,
  'home-hero-landscape': {
    ...legacyRecipes['home-hero-landscape'],
    widths: [768, 1280, 1920, 2880, 3840],
  },
} as const satisfies Record<SiteDisplayUsage, SiteDisplayRecipe>

function recipesForVersion(version: SiteDisplayRecipeVersion) {
  return version === SITE_DISPLAY_RECIPE_VERSION ? recipes : legacyRecipes
}

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

export function siteDisplayWidthsForVersion(
  usage: SiteDisplayUsage,
  recipeVersion: SiteDisplayRecipeVersion,
) {
  return recipesForVersion(recipeVersion)[usage].widths
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

function existingVariant(sqlite: Database.Database, objectKey: string) {
  return findReadySiteDisplayVariant<ReadySiteDisplayVariant>(
    sqlite,
    objectKey,
    SITE_DISPLAY_RECIPE_VERSION,
  )
}

function resizeOperation(usage: SiteDisplayUsage, source: AssetSource, width: number) {
  const height = siteDisplayHeight(usage, width)
  return `resize,m_fill,w_${width},h_${height},g_${gravity(
    source.focalX,
    source.focalY,
  )}`
}

function formatOperation(usage: SiteDisplayUsage, format: PublicFormat) {
  if (format === 'png') {
    return 'format,png'
  }
  return `quality,q_${qualityFor(usage, format)}/format,${
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
    formatOperation(usage, format),
  ].join('/')
}

function qualityFor(
  usage: SiteDisplayUsage,
  format: PublicFormat,
  recipeVersion: SiteDisplayRecipeVersion = SITE_DISPLAY_RECIPE_VERSION,
) {
  if (format === 'webp') {
    return recipeVersion === SITE_DISPLAY_RECIPE_VERSION
      && usage.includes('-hero-')
      ? 90
      : 82
  }
  return format === 'jpeg' ? 86 : 100
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
    quality: qualityFor(usage, format),
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

/**
 * 复用判定：数据库行说 READY 不代表公开对象还在。进程在生成与提交之间被杀、
 * 或对象被外部删除时，探测本身会抛错；那种情况必须当作"不可复用"重新生成，
 * 而不是让整条 operation 失败。
 */
async function variantStillUsable(
  storage: MediaStorage,
  variant: ReadySiteDisplayVariant,
) {
  try {
    return await verifyVariant(storage, variant)
  }
  catch {
    return false
  }
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
  if (existing && await variantStillUsable(storage, existing)) {
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
      insertSiteDisplayVariant(sqlite, {
        byteSize: head.byteSize,
        cropIdentity: identityHash,
        format,
        height: info.height,
        id,
        inputSha256: source.inputSha256,
        mediaRole: sourceAsset.role,
        objectKey,
        quality: qualityFor(usage, format),
        recipeVersion: SITE_DISPLAY_RECIPE_VERSION,
        sha256,
        sourceAssetId: sourceAsset.id,
        sourceVariantId: source.sourceVariantId,
        usage,
        width: info.width,
      }, now)
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
  recipeVersion: SiteDisplayRecipeVersion = SITE_DISPLAY_RECIPE_VERSION,
) {
  const selectedRecipes = recipesForVersion(recipeVersion)
  const widths = selectedRecipes[usage].widths as readonly number[]
  return variants.filter(variant => (
    variant.storageScope === 'PUBLIC'
    && variant.status === 'READY'
    && variant.usage === usage
    && variant.recipeVersion === recipeVersion
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
  const matched = eligible(usage, variants, SITE_DISPLAY_RECIPE_VERSION)
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
    ? eligible(usage, variants, SITE_DISPLAY_RECIPE_VERSION)
    : null
}

function completeLegacySiteDisplayVariants<T extends SiteDisplayVariantCandidate>(
  usage: SiteDisplayUsage,
  variants: readonly T[],
) {
  const matched = eligible(
    usage,
    variants,
    LEGACY_SITE_DISPLAY_RECIPE_VERSION,
  )
  let missing = 0
  for (const width of legacyRecipes[usage].widths) {
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
  return missing === 0 ? matched : null
}

export function completeSiteDisplayVariantsForVersion<
  T extends SiteDisplayVariantCandidate,
>(
  usage: SiteDisplayUsage,
  variants: readonly T[],
  recipeVersion: SiteDisplayRecipeVersion,
) {
  return recipeVersion === SITE_DISPLAY_RECIPE_VERSION
    ? completeSiteDisplayVariants(usage, variants)
    : completeLegacySiteDisplayVariants(usage, variants)
}

/** v2 完整后原子优先；升级期间只整体回退完整 v1，不跨版本拼接。 */
export function resolveCompleteSiteDisplayVariants<
  T extends SiteDisplayVariantCandidate,
>(usage: SiteDisplayUsage, variants: readonly T[]) {
  const current = completeSiteDisplayVariants(usage, variants)
  if (current) {
    return {
      recipeVersion: SITE_DISPLAY_RECIPE_VERSION,
      variants: current,
      widths: recipes[usage].widths,
    } as const
  }
  const legacy = completeLegacySiteDisplayVariants(usage, variants)
  return legacy
    ? {
        recipeVersion: LEGACY_SITE_DISPLAY_RECIPE_VERSION,
        variants: legacy,
        widths: legacyRecipes[usage].widths,
      } as const
    : null
}

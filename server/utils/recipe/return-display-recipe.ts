import type Database from 'better-sqlite3'
import {
  contentTypeForFormat,
  deterministicUuid,
  digest,
  environmentPrefix,
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

/**
 * T36 返图公开配方：`return-wall` / `return-display-v1` / `protection_mode=none`。
 *
 * 与作品保护配方（recipe-v2）的区别是本质性的，不只是参数不同：
 * - 不关联活动 watermark profile，也不接受任何 Logo/位置/不透明度/缩放身份；
 * - 不做统一裁切，保持原始宽高比；
 * - 处理串里没有 watermark 算子，因此活动 profile 切换不可能改变返图结果。
 *
 * 因此本文件不 import 任何 watermark 相关模块。
 */
export const RETURN_DISPLAY_RECIPE_VERSION = 'return-display-v1'
export const RETURN_WALL_USAGE = 'return-wall'
export const RETURN_PHOTO_MEDIA_ROLE = 'return_photo'

/**
 * 响应式宽度阶梯。瀑布流单列在 1440 视口约 313 CSS px，
 * 2x 设备约 626 px，因此 768 已覆盖主流高清屏；1080 留给 3x 手机。
 * 只生成实际用得到的宽度，不无脑覆盖所有尺寸。
 */
const WIDTH_LADDER = [480, 768, 1080] as const

/** 低于最小宽度的源图不适合作为公开返图；由发布检查明确阻断。 */
export const RETURN_WALL_MIN_SOURCE_WIDTH = WIDTH_LADDER[0]

/**
 * 实际生成的宽度集合：阶梯里不超过源图宽度的部分。
 * OSS `m_lfit` 默认不放大，请求宽度超过源宽会得到更小的输出并让校验失败，
 * 因此这里按源宽收敛，而不是把小图强行拉大。
 */
export function returnWallWidths(sourceWidth: number) {
  return WIDTH_LADDER.filter(width => width <= sourceWidth)
}

export function returnWallSourceTooSmall(sourceWidth: number) {
  return sourceWidth < RETURN_WALL_MIN_SOURCE_WIDTH
}

/** 每个宽度一份 WebP + 一份 fallback。 */
export function returnWallRequiredVariantCount(sourceWidth: number) {
  return returnWallWidths(sourceWidth).length * 2
}

export interface ReadyReturnWallVariant {
  assetId: string
  byteSize: number
  format: PublicFormat
  height: number
  id: string
  inputSha256: string
  mediaRole: 'return_photo'
  objectKey: string
  protectionMode: 'none'
  recipeVersion: typeof RETURN_DISPLAY_RECIPE_VERSION
  sha256: string
  sourceVariantId: string | null
  usage: typeof RETURN_WALL_USAGE
  width: number
}

function existingVariant(sqlite: Database.Database, objectKey: string) {
  return findReadySiteDisplayVariant<ReadyReturnWallVariant>(
    sqlite,
    objectKey,
    RETURN_DISPLAY_RECIPE_VERSION,
  )
}

export function countReadyReturnWallVariants(
  sqlite: Database.Database,
  assetId: string,
) {
  return (sqlite.prepare(`
    SELECT COUNT(*) AS total FROM asset_variants
    WHERE asset_id = ? AND storage_scope = 'PUBLIC' AND status = 'READY'
      AND usage = ? AND recipe_version = ? AND protection_mode = 'none'
      AND sha256 IS NOT NULL AND byte_size > 0
  `).get(
    assetId,
    RETURN_WALL_USAGE,
    RETURN_DISPLAY_RECIPE_VERSION,
  ) as { total: number }).total
}

/**
 * 管理端无水印公开预览：取最小宽度的 READY 变体。
 * 返回的是真实公开对象 Key，由调用方拼成公开媒体 URL；
 * 公开对象本来就匿名可读，因此这不构成私有信息泄漏。
 */
export function findSmallestReturnWallVariant(
  sqlite: Database.Database,
  assetId: string,
) {
  return sqlite.prepare(`
    SELECT object_key AS objectKey, width, height
    FROM asset_variants
    WHERE asset_id = ? AND storage_scope = 'PUBLIC' AND status = 'READY'
      AND usage = ? AND recipe_version = ? AND protection_mode = 'none'
      AND sha256 IS NOT NULL AND byte_size > 0
    ORDER BY width
    LIMIT 1
  `).get(
    assetId,
    RETURN_WALL_USAGE,
    RETURN_DISPLAY_RECIPE_VERSION,
  ) as { height: number, objectKey: string, width: number } | undefined
}

function qualityFor(format: PublicFormat) {
  return format === 'webp' ? 82 : format === 'jpeg' ? 86 : 100
}

function formatOperation(format: PublicFormat) {
  if (format === 'png') {
    return 'format,png'
  }
  return `quality,q_${format === 'webp' ? 82 : 86}/format,${
    format === 'jpeg' ? 'jpg' : 'webp'
  }`
}

/**
 * 无水印、保持原比例的处理串。
 *
 * - `auto-orient,1`：先按 EXIF 方向烘焙旋转，公开图不再依赖阅读器方向标记；
 * - `resize,m_lfit,w_N`：限制宽度、保持宽高比，不裁切、不填充；
 * - 重编码输出：OSS 只输出图像数据，原始 EXIF（GPS、设备、原文件名等）
 *   不会进入公开对象。
 *
 * 串里没有 watermark 算子，也没有 Logo 引用。
 */
export function buildReturnDisplayProcess(
  width: number,
  format: PublicFormat,
) {
  return [
    'image/auto-orient,1',
    `resize,m_lfit,w_${width}`,
    formatOperation(format),
  ].join('/')
}

function recipeIdentity(
  sourceAsset: AssetSource,
  source: ProcessingSource,
  width: number,
  format: PublicFormat,
) {
  const identity = JSON.stringify({
    recipeVersion: RETURN_DISPLAY_RECIPE_VERSION,
    protectionMode: 'none',
    sourceSha256: source.inputSha256,
    sourceVariantId: source.sourceVariantId,
    mediaRole: RETURN_PHOTO_MEDIA_ROLE,
    usage: RETURN_WALL_USAGE,
    width,
    // 高度由源图比例决定，不写入身份；源图内容已由 sourceSha256 固定。
    fit: 'lfit',
    autoOrient: 1,
    exifPolicy: 'strip-all',
    sourceWidth: source.width,
    sourceHeight: source.height,
    format,
    quality: qualityFor(format),
  })
  return digest('sha256', Buffer.from(identity))
}

function publicObjectKey(
  sourceAsset: AssetSource,
  width: number,
  identityHash: string,
  format: PublicFormat,
) {
  const extension = format === 'jpeg' ? 'jpg' : format
  return `${environmentPrefix(sourceAsset.privateObjectKey)}/web/${sourceAsset.id}/${RETURN_DISPLAY_RECIPE_VERSION}/${RETURN_WALL_USAGE}/${width}/${identityHash}.${extension}`
}

async function verifyVariant(
  storage: MediaStorage,
  variant: ReadyReturnWallVariant,
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

/** 数据库说 READY 不代表对象还在；探测失败一律当作需要重新生成。 */
async function variantStillUsable(
  storage: MediaStorage,
  variant: ReadyReturnWallVariant,
) {
  try {
    return await verifyVariant(storage, variant)
  }
  catch {
    return false
  }
}

/** 原比例输出高度：由源图比例推导，用于写库与校验。 */
function expectedHeight(source: ProcessingSource, width: number) {
  return Math.round(width * source.height / source.width)
}

async function generateOne(
  sqlite: Database.Database,
  storage: MediaStorage,
  sourceAsset: AssetSource,
  source: ProcessingSource,
  width: number,
  format: PublicFormat,
  now: number,
) {
  const identityHash = recipeIdentity(sourceAsset, source, width, format)
  const objectKey = publicObjectKey(sourceAsset, width, identityHash, format)
  const existing = existingVariant(sqlite, objectKey)
  if (existing && await variantStillUsable(storage, existing)) {
    return existing
  }

  try {
    await storage.processPrivateToPublic({
      sourceObjectKey: source.objectKey,
      objectKey,
      process: buildReturnDisplayProcess(width, format),
    })
    const [head, info, anonymous] = await Promise.all([
      storage.headPublic(objectKey),
      storage.imageInfoPublic(objectKey),
      storage.getPublicAnonymous(objectKey),
    ])
    const sha256 = digest('sha256', anonymous.content)
    // 高度允许 ±1 的取整差异：OSS 自己完成等比缩放，
    // 但宽度、格式、字节数与摘要必须精确一致。
    const heightDelta = Math.abs(info.height - expectedHeight(source, width))
    if (
      head.byteSize < 1
      || head.byteSize !== anonymous.content.length
      || head.etagMd5Hex !== digest('md5', anonymous.content)
      || head.contentType !== contentTypeForFormat(format)
      || anonymous.contentType !== contentTypeForFormat(format)
      || info.fileSize !== head.byteSize
      || normalizedFormat(info.format) !== format
      || info.width !== width
      || heightDelta > 1
      || info.height < 1
    ) {
      throw new Error('Return wall variant verification failed.')
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
        mediaRole: RETURN_PHOTO_MEDIA_ROLE,
        objectKey,
        quality: qualityFor(format),
        recipeVersion: RETURN_DISPLAY_RECIPE_VERSION,
        sha256,
        sourceAssetId: sourceAsset.id,
        sourceVariantId: source.sourceVariantId,
        usage: RETURN_WALL_USAGE,
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
    safeLog('error', 'Return wall variant generation failed.', {
      assetId: sourceAsset.id,
      errorCode: candidate.code,
      errorName: candidate.name,
      format,
      requestId: candidate.requestId,
      serviceCode: candidate.data?.Code,
      status: candidate.status,
      width,
    })
    try {
      await storage.deletePublic(objectKey)
    }
    catch {
      throw new ServiceError(500, 'INTERNAL_ERROR', 'Return wall media cleanup failed.')
    }
    if (error instanceof ServiceError) {
      throw error
    }
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Return wall media generation failed.')
  }
}

/**
 * 生成缺失的返图公开变体。失败只清理本次新建对象，
 * 已发布的旧公开版本保持可读。
 */
export async function generateReturnWallVariants(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
  now = Date.now(),
) {
  const sourceAsset = readyAssetSource(sqlite, assetId)
  if (sourceAsset.role !== RETURN_PHOTO_MEDIA_ROLE) {
    throw new ServiceError(
      400,
      'VALIDATION_ERROR',
      'Return wall media requires a return photo asset.',
    )
  }
  const source = processingSource(sqlite, sourceAsset)
  if (returnWallSourceTooSmall(source.width)) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Return photo source is too small for the public wall.',
      'MEDIA_SOURCE_TOO_SMALL',
    )
  }
  const fallback: PublicFormat = sourceAsset.mimeType === 'image/png'
    ? 'png'
    : 'jpeg'
  const variants: ReadyReturnWallVariant[] = []
  for (const width of returnWallWidths(source.width)) {
    for (const format of ['webp', fallback] as const) {
      variants.push(await generateOne(
        sqlite,
        storage,
        sourceAsset,
        source,
        width,
        format,
        now,
      ))
    }
  }
  return variants
}

export interface ReturnWallVariantCandidate {
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

function eligible<T extends ReturnWallVariantCandidate>(
  sourceWidth: number,
  variants: readonly T[],
) {
  const widths = returnWallWidths(sourceWidth)
  return variants.filter(variant => (
    variant.storageScope === 'PUBLIC'
    && variant.status === 'READY'
    && variant.usage === RETURN_WALL_USAGE
    && variant.recipeVersion === RETURN_DISPLAY_RECIPE_VERSION
    && variant.protectionMode === 'none'
    && variant.sha256 !== null
    && digestPattern.test(variant.sha256)
    && variant.byteSize !== null
    && variant.byteSize > 0
    && variant.height > 0
    && widths.includes(variant.width as never)
  ))
}

export function missingReturnWallVariantCount(
  sourceWidth: number,
  variants: readonly ReturnWallVariantCandidate[],
) {
  const matched = eligible(sourceWidth, variants)
  let missing = 0
  for (const width of returnWallWidths(sourceWidth)) {
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

/** 完整命中才允许公开投影；缺任何宽度或 fallback 都视为不可用。 */
export function completeReturnWallVariants<T extends ReturnWallVariantCandidate>(
  sourceWidth: number,
  variants: readonly T[],
) {
  return missingReturnWallVariantCount(sourceWidth, variants) === 0
    ? eligible(sourceWidth, variants)
    : null
}

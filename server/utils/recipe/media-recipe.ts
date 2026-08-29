import {
  createHash,
  randomUUID,
} from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  upscaleHeroImage,
  upscaleImageToMinimum,
} from '../../../scripts/embedded-ffmpeg.mjs'
import type {
  MediaRole,
} from '../../../shared/types/contracts'
import {
  contentTypeForFormat,
  deterministicUuid,
  digest,
  environmentPrefix,
  gravity,
  HERO_UPSCALE_RECIPE_VERSION,
  heroUpscaleTarget,
  normalizedFormat,
  OSS_PROCESS_INPUT_BYTE_LIMIT,
  processingSource,
  readyAssetSource,
  workMediaUpscaleRecipeVersion,
} from './media-source'
import type {
  AssetSource,
  ProcessingSource,
  PublicFormat,
} from './media-source'
import type { MediaStorage } from '../media-storage'
import { safeLog } from '../safe-log'
import {
  findReadySiteDisplayVariant,
  findVariantIdByObjectKey,
  insertSiteDisplayVariant,
  insertUpscaleVariant,
  refreshVariantContent,
} from '../repository/variant-repository'
import { ServiceError } from '../service-error'

export const PUBLIC_RECIPE_VERSION = 'recipe-v4'
export const PUBLIC_RECIPE_VERSIONS = [
  PUBLIC_RECIPE_VERSION,
  'recipe-v3',
  'recipe-v2',
  'recipe-v1',
] as const

export type PublicMediaUsage =
  | 'work-card'
  | 'adoption-card'
  | 'home-hero-landscape'
  | 'home-hero-portrait'
  | 'design-sheet'
  | 'detail'

export interface PublicRecipeSourceGeometry {
  cropHeight?: number
  cropWidth?: number
  height: number
  role?: MediaRole
  width: number
}

export interface ReadyPublicVariant {
  assetId: string
  byteSize: number
  format: PublicFormat
  height: number
  id: string
  inputSha256: string
  mediaRole: MediaRole
  objectKey: string
  recipeVersion: typeof PUBLIC_RECIPE_VERSION
  sha256: string
  sourceVariantId: string | null
  usage: PublicMediaUsage
  width: number
}

const recipes = {
  'work-card': {
    roles: ['design_sheet', 'studio_photo'],
    widths: [480, 768, 1200],
    aspect: [3, 4],
  },
  'adoption-card': {
    roles: ['adoption_cover'],
    widths: [768, 1200, 1600],
    aspect: [16, 9],
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

const asset = readyAssetSource

export async function ensureHeroUpscaleSource(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
  now = Date.now(),
) {
  const sourceAsset = asset(sqlite, assetId)
  const target = heroUpscaleTarget(sourceAsset.role)
  if (!target) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Asset is not a hero image.')
  }
  if (sourceAsset.width >= target.width && sourceAsset.height >= target.height) {
    return processingSource(sqlite, sourceAsset)
  }
  const existing = processingSource(sqlite, sourceAsset)
  if (existing.sourceVariantId !== null
    && existing.width === target.width
    && existing.height === target.height) {
    return existing
  }

  let objectKey: string | null = null
  try {
    const output = await upscaleHeroImage(
      await storage.getPrivate(sourceAsset.privateObjectKey),
      target.orientation,
    )
    const identity = JSON.stringify({
      recipeVersion: HERO_UPSCALE_RECIPE_VERSION,
      sourceSha256: sourceAsset.sha256,
      target: output.dimensions,
      filter: output.filter,
      binary: output.binary,
      format: 'png',
    })
    const identityHash = digest('sha256', Buffer.from(identity))
    const outputSha256 = digest('sha256', output.content)
    objectKey = `${environmentPrefix(sourceAsset.privateObjectKey)}/processing/${sourceAsset.id}/${HERO_UPSCALE_RECIPE_VERSION}/${identityHash}.png`
    await storage.putPrivateConditional({
      content: output.content,
      contentMd5: createHash('md5').update(output.content).digest('base64'),
      contentType: 'image/png',
      objectKey,
      sha256: outputSha256,
    })
    const [head, info, saved] = await Promise.all([
      storage.headPrivate(objectKey),
      storage.imageInfoPrivate(objectKey),
      storage.getPrivate(objectKey),
    ])
    if (
      head.byteSize !== output.content.length
      || head.byteSize !== saved.length
      || head.byteSize > OSS_PROCESS_INPUT_BYTE_LIMIT
      || head.contentType !== 'image/png'
      || head.etagMd5Hex !== digest('md5', saved)
      || head.sha256Metadata !== outputSha256
      || info.fileSize !== head.byteSize
      || normalizedFormat(info.format) !== 'png'
      || info.width !== target.width
      || info.height !== target.height
      || digest('sha256', saved) !== outputSha256
    ) {
      throw new Error('Hero upscale verification failed.')
    }
    insertUpscaleVariant(sqlite, {
      byteSize: output.content.length,
      cropIdentity: identityHash,
      height: target.height,
      id: randomUUID(),
      inputSha256: sourceAsset.sha256,
      mediaRole: sourceAsset.role,
      objectKey,
      recipeVersion: HERO_UPSCALE_RECIPE_VERSION,
      sha256: outputSha256,
      sourceAssetId: sourceAsset.id,
      width: target.width,
    }, now)
    return processingSource(sqlite, sourceAsset)
  }
  catch (error) {
    if (objectKey) {
      await storage.deletePrivate(objectKey).catch(() => {})
    }
    safeLog('error', 'Hero image upscale failed.', {
      assetId: sourceAsset.id,
      errorCode: (error as { code?: unknown }).code,
    })
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Hero image upscale failed.')
  }
}

function minimumDimensionsForUsages(
  sourceAsset: AssetSource,
  usages: readonly PublicMediaUsage[],
) {
  const width = Math.max(...usages.map(usage => recipes[usage].widths.at(-1)!))
  if (sourceAsset.role === 'design_sheet') {
    return { height: 0, width }
  }
  const cardUsage = usages.find(usage => (
    usage === 'work-card' || usage === 'adoption-card'
  ))
  const workCardHeight = cardUsage
    ? outputHeight(cardUsage, recipes[cardUsage].widths.at(-1)!)!
    : 0
  return {
    height: Math.ceil(workCardHeight / sourceAsset.cropHeight),
    width: Math.max(
      width,
      cardUsage
        ? Math.ceil(recipes[cardUsage].widths.at(-1)! / sourceAsset.cropWidth)
        : 0,
    ),
  }
}

export async function ensureWorkMediaUpscaleSource(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
  usages: readonly PublicMediaUsage[],
  now = Date.now(),
) {
  const sourceAsset = asset(sqlite, assetId)
  const recipeVersion = workMediaUpscaleRecipeVersion(sourceAsset.role)
  if (
    !recipeVersion
    || usages.length === 0
    || new Set(usages).size !== usages.length
    || usages.some(usage => !recipes[usage].roles.includes(sourceAsset.role as never))
  ) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Work media usages are invalid.')
  }
  const current = processingSource(sqlite, sourceAsset)
  if (sourceSupportsPublicUsages({
    ...sourceAsset,
    height: current.height,
    width: current.width,
  }, usages)) {
    return current
  }

  const minimum = minimumDimensionsForUsages(sourceAsset, usages)
  let objectKey: string | null = null
  try {
    const output = await upscaleImageToMinimum(
      await storage.getPrivate(sourceAsset.privateObjectKey),
      minimum,
    )
    const identity = JSON.stringify({
      recipeVersion,
      sourceSha256: sourceAsset.sha256,
      minimum,
      target: output.dimensions,
      filter: output.filter,
      binary: output.binary,
      format: 'png',
    })
    const identityHash = digest('sha256', Buffer.from(identity))
    const outputSha256 = digest('sha256', output.content)
    objectKey = `${environmentPrefix(sourceAsset.privateObjectKey)}/processing/${sourceAsset.id}/${recipeVersion}/${identityHash}.png`
    await storage.putPrivateConditional({
      content: output.content,
      contentMd5: createHash('md5').update(output.content).digest('base64'),
      contentType: 'image/png',
      objectKey,
      sha256: outputSha256,
    })
    const [head, info, saved] = await Promise.all([
      storage.headPrivate(objectKey),
      storage.imageInfoPrivate(objectKey),
      storage.getPrivate(objectKey),
    ])
    if (
      head.byteSize !== output.content.length
      || head.byteSize !== saved.length
      || head.byteSize > OSS_PROCESS_INPUT_BYTE_LIMIT
      || head.contentType !== 'image/png'
      || head.etagMd5Hex !== digest('md5', saved)
      || head.sha256Metadata !== outputSha256
      || info.fileSize !== head.byteSize
      || normalizedFormat(info.format) !== 'png'
      || info.width !== output.dimensions.width
      || info.height !== output.dimensions.height
      || info.width < minimum.width
      || info.height < minimum.height
      || !sourceSupportsPublicUsages({
        ...sourceAsset,
        height: info.height,
        width: info.width,
      }, usages)
      || digest('sha256', saved) !== outputSha256
    ) {
      throw new Error('Work media upscale verification failed.')
    }
    insertUpscaleVariant(sqlite, {
      byteSize: output.content.length,
      cropIdentity: identityHash,
      height: output.dimensions.height,
      id: randomUUID(),
      inputSha256: sourceAsset.sha256,
      mediaRole: sourceAsset.role,
      objectKey,
      recipeVersion,
      sha256: outputSha256,
      sourceAssetId: sourceAsset.id,
      width: output.dimensions.width,
    }, now)
    return processingSource(sqlite, sourceAsset)
  }
  catch (error) {
    if (objectKey) {
      await storage.deletePrivate(objectKey).catch(() => {})
    }
    safeLog('error', 'Work media upscale failed.', {
      assetId: sourceAsset.id,
      errorCode: (error as { code?: unknown }).code,
      mediaRole: sourceAsset.role,
    })
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Work media upscale failed.')
  }
}

export function assetSupportsPublicUsages(
  sqlite: Database.Database,
  assetId: string,
  usages: readonly PublicMediaUsage[],
) {
  const sourceAsset = asset(sqlite, assetId)
  const source = processingSource(sqlite, sourceAsset)
  return sourceSupportsPublicUsages({
    ...sourceAsset,
    height: source.height,
    width: source.width,
  }, usages)
}

function defaultUsages(role: MediaRole): PublicMediaUsage[] {
  if (role === 'studio_photo') {
    return ['work-card', 'detail']
  }
  if (role === 'design_sheet') {
    return ['design-sheet']
  }
  if (role === 'adoption_cover') {
    return ['adoption-card']
  }
  if (role === 'commission_design_reference' || role === 'contact_qr') {
    return []
  }
  return role === 'home_hero_landscape'
    ? ['home-hero-landscape']
    : ['home-hero-portrait']
}

export function workAssetPublicUsages(
  role: 'adoption_cover' | 'design_sheet' | 'studio_photo',
  primary: boolean,
  _hasPrimaryStudioPhoto: boolean,
): PublicMediaUsage[] {
  if (role === 'studio_photo') {
    return primary ? ['work-card', 'detail'] : ['detail']
  }
  if (role === 'adoption_cover') {
    return ['adoption-card']
  }
  return ['design-sheet']
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
    const cardUsage = usage === 'work-card' || usage === 'adoption-card'
    const availableWidth = cardUsage
      ? Math.round(source.width * (source.cropWidth ?? 1))
      : source.width
    const availableHeight = cardUsage
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
  processingGeometry: Pick<ProcessingSource, 'height' | 'width'> = sourceAsset,
) {
  const height = outputHeight(usage, width)
  if (height === null) {
    return `resize,m_lfit,w_${width}`
  }
  const cropped = (usage === 'work-card' || usage === 'adoption-card')
    && (
      sourceAsset.cropX !== 0
      || sourceAsset.cropY !== 0
      || sourceAsset.cropWidth !== 1
      || sourceAsset.cropHeight !== 1
    )
  const crop = cropped
    ? `crop,w_${Math.round(processingGeometry.width * sourceAsset.cropWidth)},h_${Math.round(processingGeometry.height * sourceAsset.cropHeight)},x_${Math.round(processingGeometry.width * sourceAsset.cropX)},y_${Math.round(processingGeometry.height * sourceAsset.cropY)}/`
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
    crop: usage === 'work-card' || usage === 'adoption-card'
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
  })
  return digest('sha256', Buffer.from(identity))
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

export function buildPublicMediaProcess(
  sourceAsset: AssetSource,
  usage: PublicMediaUsage,
  width: number,
  format: PublicFormat,
  processingGeometry: Pick<ProcessingSource, 'height' | 'width'> = sourceAsset,
) {
  return [
    `image/${resizeOperation(sourceAsset, usage, width, processingGeometry)}`,
    formatOperation(format),
  ].join('/')
}

const contentType = contentTypeForFormat

function existingVariant(
  sqlite: Database.Database,
  objectKey: string,
) {
  return findReadySiteDisplayVariant<ReadyPublicVariant>(
    sqlite,
    objectKey,
    PUBLIC_RECIPE_VERSION,
  )
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
  usage: PublicMediaUsage,
  width: number,
  format: PublicFormat,
  now: number,
) {
  const identity = recipeIdentity(
    sourceAsset,
    source,
    usage,
    width,
    format,
  )
  const objectKey = publicObjectKey(
    sourceAsset,
    usage,
    width,
    identity,
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
      process: buildPublicMediaProcess(
        sourceAsset,
        usage,
        width,
        format,
        source,
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
      Buffer.from(`${sourceAsset.id}:${identity}`),
    ))
    try {
      const stale = findVariantIdByObjectKey(sqlite, objectKey)
      if (stale) {
        refreshVariantContent(sqlite, stale.id, sha256, head.byteSize, now)
      }
      else {
        insertSiteDisplayVariant(sqlite, {
          byteSize: head.byteSize,
          cropIdentity: identity,
          format,
          height: info.height,
          id,
          inputSha256: source.inputSha256,
          mediaRole: sourceAsset.role,
          objectKey,
          quality: format === 'webp' ? 82 : format === 'jpeg' ? 86 : 100,
          recipeVersion: PUBLIC_RECIPE_VERSION,
          sha256,
          sourceAssetId: sourceAsset.id,
          sourceVariantId: source.sourceVariantId,
          usage,
          width: info.width,
        }, now)
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
  if (!sourceSupportsPublicUsages({
    ...sourceAsset,
    height: source.height,
    width: source.width,
  }, selectedUsages)) {
    throw new ServiceError(409, 'CONFLICT', 'Media source does not meet public recipe dimensions.', 'MEDIA_SOURCE_TOO_SMALL')
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

export async function generatePrivatePublicPreview(
  sqlite: Database.Database,
  storage: MediaStorage,
  input: {
    assetId: string
    objectKey: string
    usage: PublicMediaUsage
    width: number
  },
) {
  const sourceAsset = asset(sqlite, input.assetId)
  if (!recipes[input.usage].widths.includes(input.width as never)) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Preview width is invalid.')
  }
  const source = processingSource(sqlite, sourceAsset)
  const process = buildPublicMediaProcess(
    sourceAsset,
    input.usage,
    input.width,
    'webp',
    source,
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
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Media preview verification failed.')
  }
  return {
    format: 'webp' as const,
    height: info.height,
    width: info.width,
  }
}

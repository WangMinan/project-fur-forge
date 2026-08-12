import { createHash, randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { fitImageToSquare } from '../../../scripts/embedded-ffmpeg.mjs'
import type { MediaStorage } from '../media-storage'
import {
  findReadySiteDisplayVariant,
  insertSiteDisplayVariant,
  insertUpscaleVariant,
} from '../repository/variant-repository'
import { safeLog } from '../safe-log'
import { ServiceError } from '../service-error'
import {
  contentTypeForFormat,
  CONTACT_QR_UPSCALE_RECIPE_VERSION,
  deterministicUuid,
  digest,
  environmentPrefix,
  normalizedFormat,
  processingSource,
} from './media-source'
import type { AssetSource, ProcessingSource } from './media-source'

export const CONTACT_QR_RECIPE_VERSION = 'contact-qr-v1'
export const CONTACT_QR_USAGE = 'contact-qr'
export const CONTACT_QR_MEDIA_ROLE = 'contact_qr'
const WIDTH_LADDER = [320, 640] as const
const CONTACT_QR_UPSCALE_SIZE = 640

export function contactQrWidths(_sourceWidth?: number) {
  return [...WIDTH_LADDER]
}

export function buildContactQrProcess(width: number) {
  return [
    'image/auto-orient,1',
    `resize,m_lfit,w_${width},h_${width}`,
    'format,png',
  ].join('/')
}

export interface ReadyContactQrVariant {
  assetId: string
  byteSize: number
  format: 'png'
  height: number
  id: string
  inputSha256: string
  mediaRole: typeof CONTACT_QR_MEDIA_ROLE
  objectKey: string
  protectionMode: 'none'
  recipeVersion: typeof CONTACT_QR_RECIPE_VERSION
  sha256: string
  sourceVariantId: string | null
  status: 'READY'
  storageScope: 'PUBLIC'
  usage: typeof CONTACT_QR_USAGE
  width: number
}

function contactQrAssetSource(
  sqlite: Database.Database,
  assetId: string,
) {
  const row = sqlite.prepare(`
    SELECT id, role, status, private_object_key AS privateObjectKey,
           sha256, byte_size AS byteSize, mime_type AS mimeType,
           width, height, focal_x AS focalX, focal_y AS focalY,
           0 AS cropX, 0 AS cropY, 1 AS cropWidth, 1 AS cropHeight
    FROM assets WHERE id = ?
  `).get(assetId) as AssetSource | undefined
  if (!row) {
    throw new ServiceError(404, 'NOT_FOUND', 'Asset was not found.')
  }
  if (
    row.role !== CONTACT_QR_MEDIA_ROLE
    || !['image/jpeg', 'image/png', 'image/webp'].includes(row.mimeType)
    || row.width < 64
    || row.height < 64
    || !['PENDING', 'READY', 'FAILED'].includes(row.status)
  ) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Contact QR asset is invalid.')
  }
  return row
}

function identity(
  sourceAsset: AssetSource,
  source: ProcessingSource,
  width: number,
) {
  return digest('sha256', Buffer.from(JSON.stringify({
    recipeVersion: CONTACT_QR_RECIPE_VERSION,
    protectionMode: 'none',
    sourceSha256: source.inputSha256,
    sourceVariantId: source.sourceVariantId,
    mediaRole: CONTACT_QR_MEDIA_ROLE,
    usage: CONTACT_QR_USAGE,
    sourceWidth: source.width,
    sourceHeight: source.height,
    width,
    height: width,
    fit: 'contain',
    crop: 'none',
    watermark: 'none',
    format: 'png',
    quality: 100,
  })))
}

function objectKey(
  sourceAsset: AssetSource,
  width: number,
  identityHash: string,
) {
  return `${environmentPrefix(sourceAsset.privateObjectKey)}/web/${sourceAsset.id}/${CONTACT_QR_RECIPE_VERSION}/${CONTACT_QR_USAGE}/${width}/${identityHash}.png`
}

function existingVariant(sqlite: Database.Database, key: string) {
  return findReadySiteDisplayVariant<ReadyContactQrVariant>(
    sqlite,
    key,
    CONTACT_QR_RECIPE_VERSION,
  )
}

async function ensureContactQrProcessingSource(
  sqlite: Database.Database,
  storage: MediaStorage,
  sourceAsset: AssetSource,
  now: number,
) {
  const current = processingSource(sqlite, sourceAsset)
  if (
    current.sourceVariantId !== null
    && current.width === CONTACT_QR_UPSCALE_SIZE
    && current.height === CONTACT_QR_UPSCALE_SIZE
  ) {
    return current
  }

  let objectKey: string | null = null
  try {
    const output = await fitImageToSquare(
      await storage.getPrivate(sourceAsset.privateObjectKey),
      CONTACT_QR_UPSCALE_SIZE,
    )
    if (
      output.dimensions.width !== CONTACT_QR_UPSCALE_SIZE
      || output.dimensions.height !== CONTACT_QR_UPSCALE_SIZE
    ) {
      throw new Error('Contact QR adaptation must be a 640px square.')
    }
    const identity = JSON.stringify({
      recipeVersion: CONTACT_QR_UPSCALE_RECIPE_VERSION,
      sourceSha256: sourceAsset.sha256,
      target: output.dimensions,
      filter: output.filter,
      binary: output.binary,
      format: 'png',
    })
    const identityHash = digest('sha256', Buffer.from(identity))
    const outputSha256 = digest('sha256', output.content)
    objectKey = `${environmentPrefix(sourceAsset.privateObjectKey)}/processing/${sourceAsset.id}/${CONTACT_QR_UPSCALE_RECIPE_VERSION}/${identityHash}.png`
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
      || head.contentType !== 'image/png'
      || head.etagMd5Hex !== digest('md5', saved)
      || head.sha256Metadata !== outputSha256
      || info.fileSize !== head.byteSize
      || normalizedFormat(info.format) !== 'png'
      || info.width !== CONTACT_QR_UPSCALE_SIZE
      || info.height !== CONTACT_QR_UPSCALE_SIZE
      || digest('sha256', saved) !== outputSha256
    ) {
      throw new Error('Contact QR adaptation verification failed.')
    }
    insertUpscaleVariant(sqlite, {
      byteSize: output.content.length,
      cropIdentity: identityHash,
      height: CONTACT_QR_UPSCALE_SIZE,
      id: randomUUID(),
      inputSha256: sourceAsset.sha256,
      mediaRole: CONTACT_QR_MEDIA_ROLE,
      objectKey,
      recipeVersion: CONTACT_QR_UPSCALE_RECIPE_VERSION,
      sha256: outputSha256,
      sourceAssetId: sourceAsset.id,
      width: CONTACT_QR_UPSCALE_SIZE,
    }, now)
    return processingSource(sqlite, sourceAsset)
  }
  catch (error) {
    if (objectKey) {
      await storage.deletePrivate(objectKey).catch(() => {})
    }
    safeLog('error', 'Contact QR adaptation failed.', {
      assetId: sourceAsset.id,
      errorCode: (error as { code?: unknown }).code,
    })
    throw new ServiceError(
      500,
      'INTERNAL_ERROR',
      'Contact QR adaptation failed.',
      'MEDIA_SOURCE_UNAVAILABLE',
    )
  }
}

async function verifyVariant(
  storage: MediaStorage,
  variant: ReadyContactQrVariant,
) {
  const [head, info, anonymous] = await Promise.all([
    storage.headPublic(variant.objectKey),
    storage.imageInfoPublic(variant.objectKey),
    storage.getPublicAnonymous(variant.objectKey),
  ])
  return head.byteSize === variant.byteSize
    && head.byteSize === anonymous.content.length
    && head.etagMd5Hex === digest('md5', anonymous.content)
    && head.contentType === contentTypeForFormat('png')
    && anonymous.contentType === contentTypeForFormat('png')
    && info.fileSize === head.byteSize
    && normalizedFormat(info.format) === 'png'
    && info.width === variant.width
    && info.height === variant.width
    && digest('sha256', anonymous.content) === variant.sha256
}

async function variantStillUsable(
  storage: MediaStorage,
  variant: ReadyContactQrVariant,
) {
  try {
    return await verifyVariant(storage, variant)
  }
  catch {
    return false
  }
}

async function generateOne(
  sqlite: Database.Database,
  storage: MediaStorage,
  sourceAsset: AssetSource,
  source: ProcessingSource,
  width: number,
  now: number,
) {
  const identityHash = identity(sourceAsset, source, width)
  const publicKey = objectKey(sourceAsset, width, identityHash)
  const existing = existingVariant(sqlite, publicKey)
  if (existing && await variantStillUsable(storage, existing)) {
    return existing
  }

  try {
    await storage.processPrivateToPublic({
      sourceObjectKey: source.objectKey,
      objectKey: publicKey,
      process: buildContactQrProcess(width),
    })
    const [head, info, anonymous] = await Promise.all([
      storage.headPublic(publicKey),
      storage.imageInfoPublic(publicKey),
      storage.getPublicAnonymous(publicKey),
    ])
    if (
      head.byteSize < 1
      || head.byteSize !== anonymous.content.length
      || head.etagMd5Hex !== digest('md5', anonymous.content)
      || head.contentType !== 'image/png'
      || anonymous.contentType !== 'image/png'
      || info.fileSize !== head.byteSize
      || normalizedFormat(info.format) !== 'png'
      || info.width !== width
      || info.height !== width
    ) {
      throw new Error('Contact QR variant verification failed.')
    }
    const id = deterministicUuid(digest(
      'sha256',
      Buffer.from(`${sourceAsset.id}:${identityHash}`),
    ))
    try {
      insertSiteDisplayVariant(sqlite, {
        byteSize: head.byteSize,
        cropIdentity: identityHash,
        format: 'png',
        height: info.height,
        id,
        inputSha256: source.inputSha256,
        mediaRole: CONTACT_QR_MEDIA_ROLE,
        objectKey: publicKey,
        quality: 100,
        recipeVersion: CONTACT_QR_RECIPE_VERSION,
        sha256: digest('sha256', anonymous.content),
        sourceAssetId: sourceAsset.id,
        sourceVariantId: source.sourceVariantId,
        usage: CONTACT_QR_USAGE,
        width: info.width,
      }, now)
    }
    catch (error) {
      const raced = existingVariant(sqlite, publicKey)
      if (raced) {
        return raced
      }
      throw error
    }
    return existingVariant(sqlite, publicKey)!
  }
  catch (error) {
    safeLog('error', 'Contact QR variant generation failed.', {
      assetId: sourceAsset.id,
      errorName: (error as { name?: unknown }).name,
      width,
    })
    try {
      await storage.deletePublic(publicKey)
    }
    catch {
      throw new ServiceError(500, 'INTERNAL_ERROR', 'Contact QR cleanup failed.')
    }
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Contact QR generation failed.')
  }
}

export async function generateContactQrVariants(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
  now = Date.now(),
) {
  const sourceAsset = contactQrAssetSource(sqlite, assetId)
  const source = await ensureContactQrProcessingSource(
    sqlite,
    storage,
    sourceAsset,
    now,
  )
  const variants: ReadyContactQrVariant[] = []
  for (const width of contactQrWidths(source.width)) {
    variants.push(await generateOne(
      sqlite,
      storage,
      sourceAsset,
      source,
      width,
      now,
    ))
  }
  return variants
}

export type ContactQrVariantCandidate = Pick<ReadyContactQrVariant,
  'byteSize' | 'format' | 'height' | 'sha256' | 'status' | 'storageScope'
  | 'objectKey' | 'protectionMode' | 'recipeVersion' | 'usage' | 'width'>

export function completeContactQrVariants<T extends ContactQrVariantCandidate>(
  sourceWidth: number,
  variants: readonly T[],
) {
  const widths = contactQrWidths(sourceWidth)
  const eligible = variants.filter(variant => (
    variant.storageScope === 'PUBLIC'
    && variant.status === 'READY'
    && variant.protectionMode === 'none'
    && variant.recipeVersion === CONTACT_QR_RECIPE_VERSION
    && variant.usage === CONTACT_QR_USAGE
    && variant.format === 'png'
    && variant.width === variant.height
    && widths.includes(variant.width as never)
    && variant.byteSize > 0
    && /^[0-9a-f]{64}$/u.test(variant.sha256)
  ))
  return eligible.length === widths.length
    && widths.every(width => eligible.some(variant => variant.width === width))
    ? eligible
    : null
}

import type Database from 'better-sqlite3'
import type { MediaStorage } from '../media-storage'
import {
  findReadySiteDisplayVariant,
  insertSiteDisplayVariant,
} from '../repository/variant-repository'
import { safeLog } from '../safe-log'
import { ServiceError } from '../service-error'
import {
  contentTypeForFormat,
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

export function contactQrWidths(sourceWidth: number) {
  const widths = WIDTH_LADDER.filter(width => width <= sourceWidth)
  return widths.length > 0 ? widths : [sourceWidth]
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
    || row.mimeType !== 'image/png'
    || row.width !== row.height
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
  const source = processingSource(sqlite, sourceAsset)
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

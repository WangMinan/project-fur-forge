import { createHash } from 'node:crypto'
import type { MediaStorage, PrivateImageInfo } from '../media-storage'
import type {
  UploadFailureCode,
  UploadFailureStage,
} from '../../../shared/types/contracts'

export interface ConditionalImageExpectation {
  byteSize: number
  contentMd5: string
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  height: number
  mediaRole:
    | 'adoption_cover'
    | 'commission_design_reference'
    | 'contact_qr'
    | 'design_sheet'
    | 'home_hero_landscape'
    | 'home_hero_portrait'
    | 'studio_photo'
  objectKey: string
  sha256: string
  width: number
}

export class PrivateImageValidationError extends Error {
  constructor(
    readonly failureCode: UploadFailureCode,
    readonly failureStage: UploadFailureStage,
  ) {
    super('Private image validation failed.')
  }
}

function digest(algorithm: 'md5' | 'sha256', content: Buffer) {
  return createHash(algorithm).update(content).digest('hex')
}

function md5HexFromBase64(value: string) {
  return Buffer.from(value, 'base64').toString('hex')
}

function mimeFromBuffer(content: Buffer) {
  if (content.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'image/png'
  }
  if (content.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) {
    return 'image/jpeg'
  }
  if (
    content.subarray(0, 4).toString('ascii') === 'RIFF'
    && content.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

function mimeFromImageInfo(format: string) {
  const normalized = format.toLowerCase()
  if (normalized === 'jpg' || normalized === 'jpeg') {
    return 'image/jpeg'
  }
  if (normalized === 'png' || normalized === 'webp') {
    return `image/${normalized}`
  }
  return null
}

function correctedDimensions(info: PrivateImageInfo) {
  const swapped = info.orientation >= 5 && info.orientation <= 8
  return swapped
    ? { width: info.height, height: info.width }
    : { width: info.width, height: info.height }
}

function fail(
  code: UploadFailureCode,
  stage: UploadFailureStage,
): never {
  throw new PrivateImageValidationError(code, stage)
}

export async function verifyConditionalImageUpload(
  storage: MediaStorage,
  expected: ConditionalImageExpectation,
) {
  let head
  try {
    head = await storage.headPrivate(expected.objectKey)
  }
  catch (error) {
    const candidate = error as { code?: string, status?: number }
    fail(
      candidate.code === 'NoSuchKey' || candidate.status === 404
        ? 'UPLOAD_OBJECT_MISSING'
        : 'UPLOAD_STORAGE_FAILURE',
      'HEAD',
    )
  }
  if (
    head.byteSize !== expected.byteSize
    || head.contentType !== expected.contentType
    || head.etagMd5Hex !== md5HexFromBase64(expected.contentMd5)
    || head.sha256Metadata !== expected.sha256
  ) {
    fail('UPLOAD_METADATA_MISMATCH', 'HEAD')
  }

  let content: Buffer
  try {
    content = await storage.getPrivate(expected.objectKey)
  }
  catch {
    fail('UPLOAD_STORAGE_FAILURE', 'DIGEST')
  }
  if (
    content.length !== expected.byteSize
    || digest('md5', content) !== head.etagMd5Hex
    || digest('sha256', content) !== expected.sha256
    || mimeFromBuffer(content) !== expected.contentType
  ) {
    fail('UPLOAD_METADATA_MISMATCH', 'DIGEST')
  }

  let info: PrivateImageInfo
  try {
    info = await storage.imageInfoPrivate(expected.objectKey)
  }
  catch {
    fail('UPLOAD_IMAGE_INVALID', 'IMAGE_INFO')
  }
  const dimensions = correctedDimensions(info)
  const landscapeRole = expected.mediaRole === 'home_hero_landscape'
    || expected.mediaRole === 'adoption_cover'
  const portraitRole = expected.mediaRole === 'home_hero_portrait'
  if (
    info.fileSize !== expected.byteSize
    || mimeFromImageInfo(info.format) !== expected.contentType
    || !Number.isInteger(info.orientation)
    || info.orientation < 1
    || info.orientation > 8
    || expected.width !== dimensions.width
    || expected.height !== dimensions.height
    || Math.max(dimensions.width, dimensions.height) > 12_000
    || (
      expected.mediaRole === 'commission_design_reference'
      && Math.min(dimensions.width, dimensions.height) < 64
    )
    || (landscapeRole && dimensions.width <= dimensions.height)
    || (portraitRole && dimensions.height <= dimensions.width)
  ) {
    fail('UPLOAD_DIMENSIONS_INVALID', 'IMAGE_INFO')
  }
  return {
    content,
    height: dimensions.height,
    orientation: info.orientation,
    width: dimensions.width,
  }
}

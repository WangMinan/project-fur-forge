import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { preprocessImageForOss } from '../../scripts/embedded-ffmpeg.mjs'
import { verifiedAssetDtoSchema } from '../../shared/schemas/upload'
import type {
  UploadFailureCode,
  UploadFailureStage,
  UploadOwner,
  VerifiedAssetDto,
  WatermarkAnchor,
} from '../../shared/types/contracts'
import type { MediaStorage, PrivateImageInfo } from './media-storage'
import { ServiceError } from './service-error'
import {
  assertUploadOwner,
  assertUploadSessionVersion,
  requireUploadSession,
  uploadSessionDto,
} from './upload-session'

const PREPROCESS_THRESHOLD_BYTES = 20_000_000
const PREPROCESS_RECIPE = 'preprocess-v1'

interface CompleteUploadInput {
  expectedVersion: number
  focalX: number
  focalY: number
  watermarkAnchor: WatermarkAnchor
}

interface AssetRow {
  id: string
  role: VerifiedAssetDto['role']
  status: VerifiedAssetDto['status']
  byteSize: number
  mimeType: VerifiedAssetDto['mimeType']
  width: number
  height: number
  exifOrientation: number
  focalX: number
  focalY: number
  fitMode: VerifiedAssetDto['fitMode']
  watermarkAnchor: WatermarkAnchor
  version: number
  internalErrorCode: UploadFailureCode | null
  privateObjectKey: string
  sha256: string
}

interface VerifiedOriginal {
  content: Buffer
  height: number
  orientation: number
  width: number
}

const selectAsset = `
  SELECT
    id, role, status, byte_size AS byteSize, mime_type AS mimeType,
    width, height, exif_orientation AS exifOrientation,
    focal_x AS focalX, focal_y AS focalY, fit_mode AS fitMode,
    watermark_anchor AS watermarkAnchor, version,
    internal_error_code AS internalErrorCode,
    private_object_key AS privateObjectKey, sha256
  FROM assets
`

function requireAsset(sqlite: Database.Database, id: string) {
  const asset = sqlite.prepare(`${selectAsset} WHERE id = ?`)
    .get(id) as AssetRow | undefined
  if (!asset) {
    throw new ServiceError(404, 'NOT_FOUND', 'Asset was not found.')
  }
  return asset
}

function previewsFor(role: AssetRow['role']): VerifiedAssetDto['previews'] {
  if (role === 'design_sheet') {
    return [
      { usage: 'design-sheet', aspect: 'original', fitMode: 'contain' },
      { usage: 'work-card', aspect: '3:4', fitMode: 'contain' },
      { usage: 'detail', aspect: 'original', fitMode: 'contain' },
    ]
  }
  if (role === 'studio_photo') {
    return [
      { usage: 'work-card', aspect: '3:4', fitMode: 'cover' },
      { usage: 'detail', aspect: 'original', fitMode: 'contain' },
    ]
  }
  return role === 'home_hero_landscape'
    ? [{ usage: 'home-hero-landscape', aspect: '16:9', fitMode: 'cover' }]
    : [{ usage: 'home-hero-portrait', aspect: '9:16', fitMode: 'cover' }]
}

function assetDto(row: AssetRow): VerifiedAssetDto {
  return verifiedAssetDtoSchema.parse({
    assetId: row.id,
    version: row.version,
    role: row.role,
    status: row.status,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    exifOrientation: row.exifOrientation,
    focalX: row.focalX,
    focalY: row.focalY,
    fitMode: row.fitMode,
    watermarkAnchor: row.watermarkAnchor,
    processingFailureCode: row.internalErrorCode,
    processingFailureStage: row.internalErrorCode === 'UPLOAD_PREPROCESS_FAILURE'
      ? 'PREPROCESS'
      : null,
    previews: previewsFor(row.role),
  })
}

function md5HexFromBase64(value: string) {
  return Buffer.from(value, 'base64').toString('hex')
}

function digest(algorithm: 'md5' | 'sha256', content: Buffer) {
  return createHash(algorithm).update(content).digest('hex')
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

function ownerOf(row: ReturnType<typeof requireUploadSession>): UploadOwner {
  return {
    type: row.ownerType,
    id: row.ownerId,
    expectedVersion: row.ownerVersion,
  } as UploadOwner
}

async function cleanupKeys(storage: MediaStorage, keys: string[]) {
  for (const key of keys) {
    await storage.deletePrivate(key)
  }
}

async function failValidation(
  sqlite: Database.Database,
  storage: MediaStorage,
  sessionId: string,
  code: UploadFailureCode,
  stage: UploadFailureStage,
  now: number,
): Promise<never> {
  const row = requireUploadSession(sqlite, sessionId)
  sqlite.prepare(`
    UPDATE upload_sessions
    SET status = 'FAILED', failure_code = ?, failure_stage = ?,
        version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'VALIDATING' AND asset_id IS NULL
  `).run(code, stage, now, sessionId)
  try {
    await cleanupKeys(storage, [row.privateObjectKey])
  }
  catch {
    sqlite.prepare(`
      UPDATE upload_sessions
      SET failure_code = 'UPLOAD_CLEANUP_FAILED', failure_stage = 'CLEANUP',
          version = version + 1, updated_at = ?
      WHERE id = ? AND status = 'FAILED'
    `).run(now, sessionId)
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Upload cleanup failed.')
  }
  throw new ServiceError(400, 'VALIDATION_ERROR', 'Uploaded media validation failed.')
}

async function verifyOriginal(
  sqlite: Database.Database,
  storage: MediaStorage,
  sessionId: string,
  now: number,
): Promise<VerifiedOriginal> {
  const row = requireUploadSession(sqlite, sessionId)
  let head
  try {
    head = await storage.headPrivate(row.privateObjectKey)
  }
  catch (error) {
    const candidate = error as { code?: string, status?: number }
    return failValidation(
      sqlite,
      storage,
      sessionId,
      candidate.code === 'NoSuchKey' || candidate.status === 404
        ? 'UPLOAD_OBJECT_MISSING'
        : 'UPLOAD_STORAGE_FAILURE',
      'HEAD',
      now,
    )
  }

  if (
    head.byteSize !== row.expectedBytes
    || head.contentType !== row.expectedContentType
    || head.etagMd5Hex !== md5HexFromBase64(row.expectedContentMd5)
    || head.sha256Metadata !== row.expectedSha256
  ) {
    return failValidation(
      sqlite,
      storage,
      sessionId,
      'UPLOAD_METADATA_MISMATCH',
      'HEAD',
      now,
    )
  }

  let content: Buffer
  try {
    content = await storage.getPrivate(row.privateObjectKey)
  }
  catch {
    return failValidation(
      sqlite,
      storage,
      sessionId,
      'UPLOAD_STORAGE_FAILURE',
      'DIGEST',
      now,
    )
  }
  if (
    content.length !== row.expectedBytes
    || digest('md5', content) !== head.etagMd5Hex
    || digest('sha256', content) !== row.expectedSha256
    || mimeFromBuffer(content) !== row.expectedContentType
  ) {
    return failValidation(
      sqlite,
      storage,
      sessionId,
      'UPLOAD_METADATA_MISMATCH',
      'DIGEST',
      now,
    )
  }

  let info: PrivateImageInfo
  try {
    info = await storage.imageInfoPrivate(row.privateObjectKey)
  }
  catch {
    return failValidation(
      sqlite,
      storage,
      sessionId,
      'UPLOAD_IMAGE_INVALID',
      'IMAGE_INFO',
      now,
    )
  }
  const dimensions = correctedDimensions(info)
  const expectedDimensions = row.expectedWidth === dimensions.width
    && row.expectedHeight === dimensions.height
  const directionValid = row.mediaRole !== 'home_hero_landscape'
    || dimensions.width > dimensions.height
  const portraitValid = row.mediaRole !== 'home_hero_portrait'
    || dimensions.height > dimensions.width
  if (
    info.fileSize !== row.expectedBytes
    || mimeFromImageInfo(info.format) !== row.expectedContentType
    || !Number.isInteger(info.orientation)
    || info.orientation < 1
    || info.orientation > 8
    || !expectedDimensions
    || Math.max(dimensions.width, dimensions.height) > 12_000
    || !directionValid
    || !portraitValid
  ) {
    return failValidation(
      sqlite,
      storage,
      sessionId,
      'UPLOAD_DIMENSIONS_INVALID',
      'IMAGE_INFO',
      now,
    )
  }
  return {
    content,
    height: dimensions.height,
    orientation: info.orientation,
    width: dimensions.width,
  }
}

function preprocessKey(sessionKey: string, assetId: string, sha256: string) {
  const prefix = sessionKey.split('/original/', 1)[0]
  return `${prefix}/processing/${assetId}/${PREPROCESS_RECIPE}/${sha256}.png`
}

async function createPreprocess(
  storage: MediaStorage,
  originalKey: string,
  assetId: string,
  content: Buffer,
) {
  const output = preprocessImageForOss(content)
  const sha256 = digest('sha256', output.content)
  const contentMd5 = createHash('md5').update(output.content).digest('base64')
  const objectKey = preprocessKey(originalKey, assetId, sha256)
  await storage.putPrivateConditional({
    content: output.content,
    contentMd5,
    contentType: 'image/png',
    objectKey,
    sha256,
  })
  const head = await storage.headPrivate(objectKey)
  if (
    head.byteSize !== output.content.length
    || head.contentType !== 'image/png'
    || head.etagMd5Hex !== digest('md5', output.content)
    || head.sha256Metadata !== sha256
    || output.dimensions.width > 4_096
    || output.dimensions.height > 4_096
    || output.content.length > PREPROCESS_THRESHOLD_BYTES
  ) {
    throw new Error('Private preprocess verification failed.')
  }
  return {
    ...output,
    objectKey,
    sha256,
  }
}

function insertAsset(
  sqlite: Database.Database,
  row: ReturnType<typeof requireUploadSession>,
  verified: VerifiedOriginal,
  input: CompleteUploadInput,
  status: 'READY' | 'FAILED',
  now: number,
) {
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size, mime_type,
      width, height, exif_orientation, focal_x, focal_y, fit_mode,
      watermark_anchor, internal_error_code, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.id,
    row.mediaRole,
    status,
    row.privateObjectKey,
    row.expectedSha256,
    row.expectedBytes,
    row.expectedContentType,
    verified.width,
    verified.height,
    verified.orientation,
    input.focalX,
    input.focalY,
    row.mediaRole === 'design_sheet' ? 'contain' : 'cover',
    input.watermarkAnchor,
    status === 'FAILED' ? 'UPLOAD_PREPROCESS_FAILURE' : null,
    now,
    now,
  )
}

function completeSession(
  sqlite: Database.Database,
  sessionId: string,
  now: number,
) {
  sqlite.prepare(`
    UPDATE upload_sessions
    SET status = 'COMPLETED', asset_id = id, failure_code = NULL,
        failure_stage = NULL, version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'VALIDATING' AND asset_id IS NULL
  `).run(now, sessionId)
}

export async function completeUploadSession(
  sqlite: Database.Database,
  storage: MediaStorage,
  sessionId: string,
  input: CompleteUploadInput,
  now = Date.now(),
) {
  let row = requireUploadSession(sqlite, sessionId)
  if (row.status === 'COMPLETED' && row.assetId) {
    return {
      session: uploadSessionDto(row),
      asset: assetDto(requireAsset(sqlite, row.assetId)),
    }
  }
  assertUploadSessionVersion(row, input.expectedVersion)
  if (row.status !== 'AWAITING_UPLOAD') {
    throw new ServiceError(409, 'CONFLICT', 'Upload session cannot be completed.')
  }
  if (row.expiresAt <= now) {
    sqlite.prepare(`
      UPDATE upload_sessions
      SET status = 'EXPIRED', version = version + 1, updated_at = ?
      WHERE id = ? AND status = 'AWAITING_UPLOAD' AND version = ?
    `).run(now, sessionId, row.version)
    try {
      await cleanupKeys(storage, [row.privateObjectKey])
    }
    catch {
      sqlite.prepare(`
        UPDATE upload_sessions
        SET status = 'FAILED', failure_code = 'UPLOAD_CLEANUP_FAILED',
            failure_stage = 'CLEANUP', version = version + 1, updated_at = ?
        WHERE id = ? AND status = 'EXPIRED' AND asset_id IS NULL
      `).run(now, sessionId)
      throw new ServiceError(500, 'INTERNAL_ERROR', 'Upload cleanup failed.')
    }
    throw new ServiceError(409, 'CONFLICT', 'Upload session has expired.')
  }

  assertUploadOwner(sqlite, ownerOf(row), row.mediaRole)
  const acquired = sqlite.prepare(`
    UPDATE upload_sessions
    SET status = 'VALIDATING', version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'AWAITING_UPLOAD' AND version = ?
  `).run(now, sessionId, row.version)
  if (acquired.changes !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Upload session is already being validated.')
  }
  const verified = await verifyOriginal(sqlite, storage, sessionId, now)
  row = requireUploadSession(sqlite, sessionId)

  if (verified.content.length <= PREPROCESS_THRESHOLD_BYTES) {
    try {
      sqlite.transaction(() => {
        insertAsset(sqlite, row, verified, input, 'READY', now)
        completeSession(sqlite, sessionId, now)
      })()
    }
    catch {
      return failValidation(
        sqlite,
        storage,
        sessionId,
        'UPLOAD_STORAGE_FAILURE',
        'DATABASE',
        now,
      )
    }
  }
  else {
    let preprocess
    try {
      preprocess = await createPreprocess(
        storage,
        row.privateObjectKey,
        row.id,
        verified.content,
      )
    }
    catch {
      sqlite.transaction(() => {
        insertAsset(sqlite, row, verified, input, 'FAILED', now)
        completeSession(sqlite, sessionId, now)
      })()
      const completed = requireUploadSession(sqlite, sessionId)
      return {
        session: uploadSessionDto(completed),
        asset: assetDto(requireAsset(sqlite, row.id)),
      }
    }

    try {
      sqlite.transaction(() => {
        insertAsset(sqlite, row, verified, input, 'READY', now)
        sqlite.prepare(`
          INSERT INTO asset_variants (
            id, asset_id, storage_scope, status, object_key, input_sha256,
            media_role, usage, width, height, format, quality, crop_identity,
            recipe_version, watermark_profile, logo_digest, watermark_anchor,
            sha256, byte_size, created_at, updated_at
          ) VALUES (?, ?, 'PRIVATE', 'READY', ?, ?, ?, 'preprocess', ?, ?,
                    'png', 100, ?, ?, 'none', 'none', 'none', ?, ?, ?, ?)
        `).run(
          `${row.id}:preprocess-v1`,
          row.id,
          preprocess.objectKey,
          row.expectedSha256,
          row.mediaRole,
          preprocess.dimensions.width,
          preprocess.dimensions.height,
          preprocess.sha256,
          PREPROCESS_RECIPE,
          preprocess.sha256,
          preprocess.content.length,
          now,
          now,
        )
        completeSession(sqlite, sessionId, now)
      })()
    }
    catch {
      try {
        await cleanupKeys(storage, [preprocess.objectKey, row.privateObjectKey])
      }
      catch {
        throw new ServiceError(500, 'INTERNAL_ERROR', 'Upload cleanup failed.')
      }
      throw new ServiceError(500, 'INTERNAL_ERROR', 'Media persistence failed.')
    }
  }

  const completed = requireUploadSession(sqlite, sessionId)
  return {
    session: uploadSessionDto(completed),
    asset: assetDto(requireAsset(sqlite, row.id)),
  }
}

export async function retryAssetProcessing(
  sqlite: Database.Database,
  storage: MediaStorage,
  assetId: string,
  expectedVersion: number,
  now = Date.now(),
) {
  let asset = requireAsset(sqlite, assetId)
  if (asset.version !== expectedVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.')
  }
  if (
    asset.status !== 'FAILED'
    || asset.internalErrorCode !== 'UPLOAD_PREPROCESS_FAILURE'
    || asset.byteSize <= PREPROCESS_THRESHOLD_BYTES
  ) {
    throw new ServiceError(409, 'CONFLICT', 'Asset processing is not retryable.')
  }
  const acquired = sqlite.prepare(`
    UPDATE assets
    SET status = 'PENDING', internal_error_code = NULL,
        version = version + 1, updated_at = ?
    WHERE id = ? AND status = 'FAILED' AND version = ?
  `).run(now, assetId, expectedVersion)
  if (acquired.changes !== 1) {
    throw new ServiceError(409, 'CONFLICT', 'Asset is already being processed.')
  }

  try {
    const content = await storage.getPrivate(asset.privateObjectKey)
    if (digest('sha256', content) !== asset.sha256) {
      throw new Error('Original asset digest changed.')
    }
    const preprocess = await createPreprocess(
      storage,
      asset.privateObjectKey,
      asset.id,
      content,
    )
    sqlite.transaction(() => {
      sqlite.prepare(`
        INSERT OR IGNORE INTO asset_variants (
          id, asset_id, storage_scope, status, object_key, input_sha256,
          media_role, usage, width, height, format, quality, crop_identity,
          recipe_version, watermark_profile, logo_digest, watermark_anchor,
          sha256, byte_size, created_at, updated_at
        ) VALUES (?, ?, 'PRIVATE', 'READY', ?, ?, ?, 'preprocess', ?, ?,
                  'png', 100, ?, ?, 'none', 'none', 'none', ?, ?, ?, ?)
      `).run(
        `${asset.id}:preprocess-v1`,
        asset.id,
        preprocess.objectKey,
        asset.sha256,
        asset.role,
        preprocess.dimensions.width,
        preprocess.dimensions.height,
        preprocess.sha256,
        PREPROCESS_RECIPE,
        preprocess.sha256,
        preprocess.content.length,
        now,
        now,
      )
      sqlite.prepare(`
        UPDATE assets
        SET status = 'READY', internal_error_code = NULL,
            version = version + 1, updated_at = ?
        WHERE id = ? AND status = 'PENDING'
      `).run(now, assetId)
    })()
  }
  catch {
    sqlite.prepare(`
      UPDATE assets
      SET status = 'FAILED', internal_error_code = 'UPLOAD_PREPROCESS_FAILURE',
          version = version + 1, updated_at = ?
      WHERE id = ? AND status = 'PENDING'
    `).run(now, assetId)
  }

  asset = requireAsset(sqlite, assetId)
  return assetDto(asset)
}

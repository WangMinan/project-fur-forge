import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { MediaRole } from '../../shared/types/contracts'
import { ServiceError } from './service-error'

/** Lanczos 私有适配源身份，横竖 Hero 低分辨率原图共用。 */
export const HERO_UPSCALE_RECIPE_VERSION = 'hero-upscale-lanczos-v1'

/** OSS 图片处理的单次输入上限。 */
export const OSS_PROCESS_INPUT_BYTE_LIMIT = 20_000_000

export type PublicFormat = 'webp' | 'jpeg' | 'png'

export interface AssetSource {
  byteSize: number
  cropHeight: number
  cropWidth: number
  cropX: number
  cropY: number
  focalX: number
  focalY: number
  height: number
  id: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  privateObjectKey: string
  role: MediaRole
  sha256: string
  status: string
  width: number
}

export interface ProcessingSource {
  height: number
  inputSha256: string
  objectKey: string
  sourceVariantId: string | null
  width: number
}

export function digest(algorithm: 'md5' | 'sha256', content: Buffer) {
  return createHash(algorithm).update(content).digest('hex')
}

export function normalizedFormat(format: string): PublicFormat | null {
  const value = format.toLowerCase()
  if (value === 'jpg' || value === 'jpeg') {
    return 'jpeg'
  }
  return value === 'webp' || value === 'png' ? value : null
}

export function contentTypeForFormat(format: PublicFormat) {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`
}

export function urlSafeBase64(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

export function gravity(focalX: number, focalY: number) {
  const horizontal = focalX < 1 / 3 ? 'w' : focalX > 2 / 3 ? 'e' : ''
  const vertical = focalY < 1 / 3 ? 'n' : focalY > 2 / 3 ? 's' : ''
  return `${vertical}${horizontal}` || 'center'
}

export function deterministicUuid(hash: string) {
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

export function environmentPrefix(privateObjectKey: string) {
  const marker = privateObjectKey.indexOf('/original/')
  if (marker < 1) {
    throw new Error('Original object key has no environment prefix.')
  }
  return privateObjectKey.slice(0, marker)
}

export function heroUpscaleTarget(role: MediaRole) {
  if (role === 'home_hero_landscape') {
    return { height: 1080, orientation: 'landscape' as const, width: 1920 }
  }
  if (role === 'home_hero_portrait') {
    return { height: 1920, orientation: 'portrait' as const, width: 1080 }
  }
  return null
}

interface ProcessingSourceRow {
  height: number
  id: string
  objectKey: string
  sha256: string
  width: number
}

/**
 * 公开与私有派生的唯一输入解析：Hero 优先使用已确认的 Lanczos 适配源，
 * 超过 OSS 处理上限的原图必须落到 READY 的私有 preprocess 变体。
 */
export function processingSource(
  sqlite: Database.Database,
  sourceAsset: AssetSource,
): ProcessingSource {
  const target = heroUpscaleTarget(sourceAsset.role)
  if (target) {
    const upscaled = sqlite.prepare(`
      SELECT id, object_key AS objectKey, sha256, width, height
      FROM asset_variants
      WHERE asset_id = ? AND storage_scope = 'PRIVATE'
        AND status = 'READY' AND usage = 'preprocess'
        AND recipe_version = ? AND input_sha256 = ?
        AND byte_size <= ? AND width = ? AND height = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(
      sourceAsset.id,
      HERO_UPSCALE_RECIPE_VERSION,
      sourceAsset.sha256,
      OSS_PROCESS_INPUT_BYTE_LIMIT,
      target.width,
      target.height,
    ) as ProcessingSourceRow | undefined
    if (upscaled) {
      return {
        height: upscaled.height,
        inputSha256: upscaled.sha256,
        objectKey: upscaled.objectKey,
        sourceVariantId: upscaled.id,
        width: upscaled.width,
      }
    }
  }
  if (sourceAsset.byteSize <= OSS_PROCESS_INPUT_BYTE_LIMIT) {
    return {
      height: sourceAsset.height,
      inputSha256: sourceAsset.sha256,
      objectKey: sourceAsset.privateObjectKey,
      sourceVariantId: null,
      width: sourceAsset.width,
    }
  }
  const row = sqlite.prepare(`
    SELECT id, object_key AS objectKey, sha256, width, height
    FROM asset_variants
    WHERE asset_id = ? AND storage_scope = 'PRIVATE'
      AND status = 'READY' AND usage = 'preprocess'
      AND input_sha256 = ? AND byte_size <= ?
      AND width <= 4096 AND height <= 4096
    ORDER BY created_at DESC LIMIT 1
  `).get(
    sourceAsset.id,
    sourceAsset.sha256,
    OSS_PROCESS_INPUT_BYTE_LIMIT,
  ) as ProcessingSourceRow | undefined
  if (!row) {
    throw new ServiceError(409, 'CONFLICT', 'Asset has no ready private processing source.')
  }
  return {
    height: row.height,
    inputSha256: row.sha256,
    objectKey: row.objectKey,
    sourceVariantId: row.id,
    width: row.width,
  }
}

export function readyAssetSource(
  sqlite: Database.Database,
  assetId: string,
): AssetSource {
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

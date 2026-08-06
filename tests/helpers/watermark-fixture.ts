import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { WATERMARK_PROFILE_NAME } from '../../shared/schemas/watermark'
import { watermarkConfigDigest } from '../../server/utils/service/watermark-profile'

export const TEST_WATERMARK_ASSET_ID = '99999999-9999-4999-8999-999999999999'
export const TEST_WATERMARK_PROFILE_ID = '88888888-8888-4888-8888-888888888888'

export function insertActiveWatermarkProfile(
  sqlite: Database.Database,
  now: number,
  options: {
    assetId?: string
    environmentPrefix?: string
    opacityPercent?: number
    profileId?: string
    scalePercent?: number
  } = {},
) {
  const assetId = options.assetId ?? TEST_WATERMARK_ASSET_ID
  const profileId = options.profileId ?? TEST_WATERMARK_PROFILE_ID
  const existingAsset = sqlite.prepare(`
    SELECT sha256 FROM assets WHERE id = ?
  `).get(assetId) as { sha256: string } | undefined
  const logoDigest = existingAsset?.sha256
    ?? createHash('sha256').update(`logo:${assetId}`).digest('hex')
  const opacityPercent = options.opacityPercent ?? 50
  const scalePercent = options.scalePercent ?? 60
  const configDigest = watermarkConfigDigest({
    logoDigest,
    opacityPercent,
    scalePercent,
    sourceAssetId: assetId,
  })
  if (!existingAsset) {
    sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size,
        mime_type, width, height, created_at, updated_at
      ) VALUES (?, 'watermark_logo', 'READY', ?, ?, 1024,
                'image/png', 512, 512, ?, ?)
    `).run(
      assetId,
      `${options.environmentPrefix ?? 'test/watermark-fixture'}/original/${assetId}/logo.png`,
      logoDigest,
      now,
      now,
    )
  }
  const previous = sqlite.prepare(`
    SELECT active_watermark_profile_id AS id FROM site_branding WHERE id = 'site'
  `).get() as { id: string | null }
  sqlite.prepare(`
    INSERT INTO watermark_profiles (
      id, profile_name, source_asset_id, logo_digest, position,
      opacity_percent, scale_percent, config_digest, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'center', ?, ?, ?, 'ACTIVE', ?, ?)
  `).run(
    profileId,
    WATERMARK_PROFILE_NAME,
    assetId,
    logoDigest,
    opacityPercent,
    scalePercent,
    configDigest,
    now,
    now,
  )
  sqlite.prepare(`
    UPDATE site_branding
    SET active_watermark_profile_id = ?, version = version + 1, updated_at = ?
    WHERE id = 'site'
  `).run(profileId, now)
  if (previous.id) {
    sqlite.prepare(`
      UPDATE watermark_profiles
      SET status = 'RETIRED', version = version + 1, updated_at = ?
      WHERE id = ?
    `).run(now, previous.id)
  }
  return {
    assetId,
    configDigest,
    logoDigest,
    opacityPercent,
    profileId,
    scalePercent,
  }
}

import {
  createHash,
  randomUUID,
} from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  WATERMARK_PROFILE_NAME,
  watermarkProfileDtoSchema,
} from '../../../shared/schemas/watermark'
import type {
  WatermarkProfileDto,
  WatermarkProfileStatus,
} from '../../../shared/types/contracts'
import { ServiceError } from '../service-error'

const WATERMARK_RENDER_REVISION = 'responsive-design-sheet-v2'

export interface WatermarkProfileRow {
  configDigest: string
  createdAt: number
  id: string
  logoDigest: string
  opacityPercent: number
  position: 'center'
  profileName: typeof WATERMARK_PROFILE_NAME
  scalePercent: number
  sourceAssetId: string
  status: WatermarkProfileStatus
  updatedAt: number
  version: number
}

export interface SiteBrandingRow {
  activeWatermarkProfileId: string | null
  draftWatermarkProfileId: string | null
  id: 'site'
  lastWatermarkOperationId: string | null
  updatedAt: number
  version: number
}

export interface WatermarkSource {
  assetId: string
  height: number
  logoDigest: string
  objectKey: string
  width: number
}

const selectProfile = `
  SELECT
    id, profile_name AS profileName, source_asset_id AS sourceAssetId,
    logo_digest AS logoDigest, position,
    opacity_percent AS opacityPercent, scale_percent AS scalePercent,
    config_digest AS configDigest, status, version,
    created_at AS createdAt, updated_at AS updatedAt
  FROM watermark_profiles
`

export function requireSiteBranding(sqlite: Database.Database) {
  const row = sqlite.prepare(`
    SELECT
      id,
      active_watermark_profile_id AS activeWatermarkProfileId,
      draft_watermark_profile_id AS draftWatermarkProfileId,
      last_watermark_operation_id AS lastWatermarkOperationId,
      version, updated_at AS updatedAt
    FROM site_branding WHERE id = 'site'
  `).get() as SiteBrandingRow | undefined
  if (!row) {
    throw new ServiceError(500, 'INTERNAL_ERROR', 'Site branding is unavailable.')
  }
  return row
}

export function findWatermarkProfile(
  sqlite: Database.Database,
  id: string,
) {
  return sqlite.prepare(`${selectProfile} WHERE id = ?`)
    .get(id) as WatermarkProfileRow | undefined
}

export function requireWatermarkProfile(
  sqlite: Database.Database,
  id: string,
) {
  const profile = findWatermarkProfile(sqlite, id)
  if (!profile) {
    throw new ServiceError(404, 'NOT_FOUND', 'Watermark profile was not found.')
  }
  return profile
}

export function watermarkProfileDto(
  profile: WatermarkProfileRow,
): WatermarkProfileDto {
  return watermarkProfileDtoSchema.parse({
    id: profile.id,
    profileName: profile.profileName,
    sourceAssetId: profile.sourceAssetId,
    position: profile.position,
    opacityPercent: profile.opacityPercent,
    scalePercent: profile.scalePercent,
    configDigestSuffix: profile.configDigest.slice(-12),
    status: profile.status,
    version: profile.version,
    createdAt: new Date(profile.createdAt).toISOString(),
    updatedAt: new Date(profile.updatedAt).toISOString(),
  })
}

export function watermarkConfigDigest(input: {
  logoDigest: string
  opacityPercent: number
  scalePercent: number
  sourceAssetId: string
}) {
  return createHash('sha256').update(JSON.stringify({
    profileName: WATERMARK_PROFILE_NAME,
    sourceAssetId: input.sourceAssetId,
    logoDigest: input.logoDigest,
    position: 'center',
    opacityPercent: input.opacityPercent,
    scalePercent: input.scalePercent,
    renderRevision: WATERMARK_RENDER_REVISION,
  })).digest('hex')
}

export function watermarkSource(
  sqlite: Database.Database,
  profile: WatermarkProfileRow,
): WatermarkSource {
  const source = sqlite.prepare(`
    SELECT
      id AS assetId, private_object_key AS objectKey,
      sha256 AS logoDigest, width, height
    FROM assets
    WHERE id = ? AND role = 'watermark_logo'
      AND status = 'READY' AND mime_type = 'image/png'
      AND byte_size <= 20000000 AND sha256 = ?
  `).get(profile.sourceAssetId, profile.logoDigest) as WatermarkSource | undefined
  if (!source) {
    throw new ServiceError(409, 'CONFLICT', 'Watermark source is not ready.')
  }
  return source
}

export function requireActiveWatermarkProfile(sqlite: Database.Database) {
  const branding = requireSiteBranding(sqlite)
  if (!branding.activeWatermarkProfileId) {
    throw new ServiceError(409, 'CONFLICT', 'No active watermark profile is configured.')
  }
  const profile = requireWatermarkProfile(
    sqlite,
    branding.activeWatermarkProfileId,
  )
  if (profile.status !== 'ACTIVE') {
    throw new ServiceError(409, 'CONFLICT', 'The active watermark profile is invalid.')
  }
  watermarkSource(sqlite, profile)
  return profile
}

export function createWatermarkProfile(
  sqlite: Database.Database,
  expectedBrandingVersion: number,
  input: {
    opacityPercent: number
    scalePercent: number
    sourceAssetId: string
  },
  now = Date.now(),
) {
  const branding = requireSiteBranding(sqlite)
  if (branding.version !== expectedBrandingVersion) {
    throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
  }
  const source = sqlite.prepare(`
    SELECT sha256 AS logoDigest
    FROM assets
    WHERE id = ? AND role = 'watermark_logo' AND status = 'READY'
      AND mime_type = 'image/png' AND byte_size <= 20000000
  `).get(input.sourceAssetId) as { logoDigest: string } | undefined
  if (!source) {
    throw new ServiceError(409, 'CONFLICT', 'Watermark source is not ready.')
  }
  const configDigest = watermarkConfigDigest({
    ...input,
    logoDigest: source.logoDigest,
  })
  let profile = sqlite.prepare(`
    ${selectProfile}
    WHERE config_digest = ? AND status IN ('ACTIVE', 'DRAFT', 'APPLYING', 'FAILED')
    ORDER BY CASE status
      WHEN 'ACTIVE' THEN 0 WHEN 'DRAFT' THEN 1
      WHEN 'APPLYING' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT 1
  `).get(configDigest) as WatermarkProfileRow | undefined
  if (profile?.status === 'ACTIVE') {
    return profile
  }
  if (profile && branding.draftWatermarkProfileId === profile.id) {
    return profile
  }

  sqlite.transaction(() => {
    if (!profile) {
      const id = randomUUID()
      sqlite.prepare(`
        INSERT INTO watermark_profiles (
          id, profile_name, source_asset_id, logo_digest, position,
          opacity_percent, scale_percent, config_digest, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'center', ?, ?, ?, 'DRAFT', ?, ?)
      `).run(
        id,
        WATERMARK_PROFILE_NAME,
        input.sourceAssetId,
        source.logoDigest,
        input.opacityPercent,
        input.scalePercent,
        configDigest,
        now,
        now,
      )
      profile = requireWatermarkProfile(sqlite, id)
    }
    const updated = sqlite.prepare(`
      UPDATE site_branding
      SET draft_watermark_profile_id = ?, version = version + 1,
          updated_at = ?
      WHERE id = 'site' AND version = ?
    `).run(profile!.id, now, expectedBrandingVersion)
    if (updated.changes !== 1) {
      throw new ServiceError(409, 'CONFLICT', 'Resource version is stale.', 'VERSION_CONFLICT')
    }
  })()
  return requireWatermarkProfile(sqlite, profile!.id)
}

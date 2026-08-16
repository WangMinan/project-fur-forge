import {
  createHash,
} from 'node:crypto'
import {
  existsSync,
  readFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { WATERMARK_PROFILE_NAME } from '../../../shared/schemas/watermark'
import type { MediaStorage } from '../media-storage'
import { pngHasTransparency } from '../service/private-image-validation'
import type { RuntimeConfig } from '../runtime-config'
import {
  createWatermarkProfile,
  requireSiteBranding,
  requireWatermarkProfile,
} from '../service/watermark-profile'

const BUNDLED_LOGO = 'public/brand/logo-full-light.png'

function digest(algorithm: 'md5' | 'sha256', content: Buffer) {
  return createHash(algorithm).update(content).digest('hex')
}

function deterministicUuid(hash: string) {
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

function environmentPrefix(environment: RuntimeConfig['appEnv']) {
  if (environment === 'test') {
    return 'test/watermark-seed'
  }
  return environment === 'production' ? 'prod' : 'dev'
}

export async function seedBundledWatermark(
  sqlite: Database.Database,
  storage: MediaStorage,
  config: Pick<RuntimeConfig, 'appEnv'>,
  options: {
    bundledLogoPath?: string
    keyPrefix?: string
    now?: number
  } = {},
) {
  const path = options.bundledLogoPath ?? resolve(process.cwd(), BUNDLED_LOGO)
  if (!existsSync(path)) {
    throw new Error('Bundled watermark seed input is missing.')
  }
  const content = readFileSync(path)
  if (!pngHasTransparency(content)) {
    throw new Error('Bundled watermark seed input must be a transparent PNG.')
  }
  const sha256 = digest('sha256', content)
  const id = deterministicUuid(sha256)
  const prefix = options.keyPrefix ?? environmentPrefix(config.appEnv)
  const objectKey = `${prefix}/original/${id}/watermark-logo.png`
  const width = content.readUInt32BE(16)
  const height = content.readUInt32BE(20)
  const now = options.now ?? Date.now()

  await storage.putPrivateConditional({
    content,
    contentMd5: createHash('md5').update(content).digest('base64'),
    contentType: 'image/png',
    objectKey,
    sha256,
  })
  const [head, info] = await Promise.all([
    storage.headPrivate(objectKey),
    storage.imageInfoPrivate(objectKey),
  ])
  if (
    head.byteSize !== content.length
    || head.contentType !== 'image/png'
    || head.etagMd5Hex !== digest('md5', content)
    || head.sha256Metadata !== sha256
    || info.fileSize !== content.length
    || info.format.toLowerCase() !== 'png'
    || info.width !== width
    || info.height !== height
  ) {
    throw new Error('Bundled watermark seed verification failed.')
  }

  const existingCandidate = sqlite.prepare(`
    SELECT 1 FROM assets WHERE id = ?
  `).pluck().get(id) === 1
  sqlite.prepare(`
    INSERT OR IGNORE INTO assets (
      id, role, status, private_object_key, sha256, byte_size, mime_type,
      width, height, fit_mode, created_at, updated_at
    ) VALUES (?, 'watermark_logo', 'READY', ?, ?, ?, 'image/png',
              ?, ?, 'contain', ?, ?)
  `).run(id, objectKey, sha256, content.length, width, height, now, now)
  const candidate = sqlite.prepare(`
    SELECT id, status, private_object_key AS objectKey, sha256
    FROM assets WHERE id = ? AND role = 'watermark_logo'
  `).get(id) as {
    id: string
    objectKey: string
    sha256: string
    status: string
  } | undefined
  if (
    !candidate
    || candidate.status !== 'READY'
    || candidate.objectKey !== objectKey
    || candidate.sha256 !== sha256
  ) {
    throw new Error('Bundled watermark candidate conflicts with existing data.')
  }

  let branding = requireSiteBranding(sqlite)
  const configuredProfileId = branding.activeWatermarkProfileId
    ?? branding.draftWatermarkProfileId
  let profile = configuredProfileId
    ? requireWatermarkProfile(sqlite, configuredProfileId)
    : createWatermarkProfile(sqlite, branding.version, {
        sourceAssetId: id,
        opacityPercent: 50,
        scalePercent: 60,
      }, now)
  if (!configuredProfileId) {
    branding = requireSiteBranding(sqlite)
    const publicContentCount = Number(sqlite.prepare(`
      SELECT
        (SELECT count(*) FROM works WHERE publication_status = 'published')
        + (SELECT count(*) FROM site_hero_slides WHERE enabled = 1)
    `).pluck().get())
    if (publicContentCount === 0) {
      sqlite.transaction(() => {
        sqlite.prepare(`
          UPDATE watermark_profiles
          SET status = 'ACTIVE', version = version + 1, updated_at = ?
          WHERE id = ? AND status = 'DRAFT'
        `).run(now, profile.id)
        const updated = sqlite.prepare(`
          UPDATE site_branding
          SET active_watermark_profile_id = ?, draft_watermark_profile_id = NULL,
              version = version + 1, updated_at = ?
          WHERE id = 'site' AND version = ?
        `).run(profile.id, now, branding.version)
        if (updated.changes !== 1) {
          throw new Error('Site branding changed during watermark seed.')
        }
      })()
      profile = requireWatermarkProfile(sqlite, profile.id)
    }
  }

  return {
    assetId: id,
    profileId: profile.id,
    profileName: WATERMARK_PROFILE_NAME,
    profileStatus: profile.status,
    reusedCandidate: existingCandidate,
  }
}

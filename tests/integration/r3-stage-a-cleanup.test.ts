import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateDatabase, openDatabase } from '../../server/utils/database'
import {
  R3_STAGE_A_AUDIT_ACTION,
  R3_STAGE_A_CONFIRMATION,
  runR3StageACleanup,
} from '../../server/utils/runner/r3-stage-a-retirement'
import type {
  R3StageACachePurger,
  R3StageAObjectInspection,
  R3StageAObjectScope,
  R3StageAObjectStore,
} from '../../server/utils/runner/r3-stage-a-retirement'

const NOW = Date.UTC(2026, 7, 15)
const PREFIX = 'test/r3-a-drill/integration-001/'
const MEDIA_ORIGIN = 'https://media.r3-a.test'
const RETURN_ASSET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const QR_ASSET_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

class FakeRetirementStore implements R3StageAObjectStore {
  readonly deleted: string[] = []
  readonly entries = new Map<string, R3StageAObjectInspection>()
  failAfter = Number.POSITIVE_INFINITY

  seed(scope: R3StageAObjectScope, objectKey: string) {
    this.entries.set(`${scope}:${objectKey}`, {
      current: true,
      deleteMarkers: 1,
      versionBytes: 200,
      versions: 2,
    })
  }

  async inspect(scope: R3StageAObjectScope, objectKey: string) {
    return this.entries.get(`${scope}:${objectKey}`) ?? {
      current: false,
      deleteMarkers: 0,
      versionBytes: 0,
      versions: 0,
    }
  }

  async deleteAll(scope: R3StageAObjectScope, objectKey: string) {
    if (this.deleted.length >= this.failAfter) {
      throw new Error('injected delete failure')
    }
    this.deleted.push(`${scope}:${objectKey}`)
    this.entries.delete(`${scope}:${objectKey}`)
  }
}

class FakeCache implements R3StageACachePurger {
  readonly purges: string[][] = []
  fail = false

  async purgeExactAndWait(urls: readonly string[]) {
    if (this.fail) throw new Error('injected purge failure')
    this.purges.push([...urls])
  }
}

let directory: string
let sqlite: Database.Database
let store: FakeRetirementStore
let cache: FakeCache

function insertAsset(id: string, role: 'return_photo' | 'contact_qr') {
  const suffix = role === 'return_photo' ? 'return' : 'qr'
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, fit_mode, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, 100, 'image/png', 640, 640, ?, ?, ?)
  `).run(
    id,
    role,
    `${PREFIX}original/${suffix}/source.png`,
    (role === 'return_photo' ? 'a' : 'b').repeat(64),
    role === 'contact_qr' ? 'contain' : 'cover',
    NOW,
    NOW,
  )
}

function insertVariant(
  id: string,
  assetId: string,
  role: 'return_photo' | 'contact_qr',
  scope: 'PRIVATE' | 'PUBLIC',
) {
  const isReturn = role === 'return_photo'
  const isPrivate = scope === 'PRIVATE'
  const usage = isPrivate ? 'preprocess' : (isReturn ? 'return-wall' : 'contact-qr')
  const recipe = isPrivate ? 'preprocess-v1' : (isReturn ? 'return-display-v1' : 'contact-qr-v1')
  const key = `${PREFIX}${isPrivate ? 'processing' : 'web'}/${id}.png`
  sqlite.prepare(`
    INSERT INTO asset_variants (
      id, asset_id, storage_scope, status, object_key, input_sha256,
      media_role, usage, width, height, format, quality, crop_identity,
      recipe_version, protection_mode, watermark_profile,
      watermark_config_digest, logo_digest, watermark_anchor,
      sha256, byte_size, created_at, updated_at
    ) VALUES (
      ?, ?, ?, 'READY', ?, ?, ?, ?, 320, 320, 'png', 82, ?, ?,
      'none', 'none', 'none', 'none', 'none', ?, 100, ?, ?
    )
  `).run(
    id,
    assetId,
    scope,
    key,
    (role === 'return_photo' ? 'a' : 'b').repeat(64),
    role,
    usage,
    `crop:${id}`,
    recipe,
    'b'.repeat(64),
    NOW,
    NOW,
  )
  store.seed(isPrivate ? 'private' : 'public', key)
}

function seedComplexLegacyState() {
  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at, created_at, updated_at
    ) VALUES (?, 'admin', 'hash', ?, ?, ?)
  `).run(USER_ID, NOW, NOW, NOW)
  insertAsset(RETURN_ASSET_ID, 'return_photo')
  insertAsset(QR_ASSET_ID, 'contact_qr')
  store.seed('private', `${PREFIX}original/return/source.png`)
  store.seed('private', `${PREFIX}original/qr/source.png`)
  insertVariant(
    '11111111-1111-4111-8111-111111111111',
    RETURN_ASSET_ID,
    'return_photo',
    'PRIVATE',
  )
  insertVariant(
    '22222222-2222-4222-8222-222222222222',
    RETURN_ASSET_ID,
    'return_photo',
    'PUBLIC',
  )
  insertVariant(
    '33333333-3333-4333-8333-333333333333',
    QR_ASSET_ID,
    'contact_qr',
    'PRIVATE',
  )
  insertVariant(
    '44444444-4444-4444-8444-444444444444',
    QR_ASSET_ID,
    'contact_qr',
    'PUBLIC',
  )
  sqlite.prepare(`
    INSERT INTO return_characters (
      id, slug, name, version, created_at, updated_at
    ) VALUES ('55555555-5555-4555-8555-555555555555', 'retired', '退役', 1, ?, ?)
  `).run(NOW, NOW)
  sqlite.prepare(`
    INSERT INTO return_photos (
      id, character_id, asset_id, alt, is_primary, publication_status,
      version, created_at, updated_at
    ) VALUES (
      '66666666-6666-4666-8666-666666666666',
      '55555555-5555-4555-8555-555555555555', ?, '退役图片', 1,
      'draft', 1, ?, ?
    )
  `).run(RETURN_ASSET_ID, NOW, NOW)
  const pendingKey = `${PREFIX}pending/return-upload.png`
  sqlite.prepare(`
    INSERT INTO upload_sessions (
      id, owner_type, owner_id, owner_version, media_role,
      private_object_key, expected_content_type, expected_bytes,
      expected_content_md5, expected_sha256, expected_width, expected_height,
      created_by, status, version, created_at, expires_at, updated_at
    ) VALUES (
      '77777777-7777-4777-8777-777777777777', 'return',
      '55555555-5555-4555-8555-555555555555', 1, 'return_photo', ?,
      'image/png', 100, ?, ?, 640, 640, ?, 'AWAITING_UPLOAD', 1, ?, ?, ?
    )
  `).run(pendingKey, 'A'.repeat(24), 'c'.repeat(64), USER_ID, NOW, NOW + 300_000, NOW)
  store.seed('private', pendingKey)
  const cleanupKey = `${PREFIX}web/pending/preview.png`
  sqlite.prepare(`
    INSERT INTO publication_operations (
      id, operation_type, entity_type, entity_id, requested_version, status,
      cleanup_object_keys_json, edge_purge_urls_json, edge_purge_status,
      version, attempt, started_at, updated_at
    ) VALUES (
      '88888888-8888-4888-8888-888888888888', 'PUBLISH', 'RETURN_PHOTO',
      '66666666-6666-4666-8666-666666666666', 1, 'CLEANING_PUBLIC', ?, ?,
      'PENDING', 1, 0, ?, ?
    )
  `).run(
    JSON.stringify([cleanupKey]),
    JSON.stringify([`${MEDIA_ORIGIN}/${cleanupKey}`]),
    NOW,
    NOW,
  )
  store.seed('public', cleanupKey)
  sqlite.prepare(`
    INSERT INTO analytics_events (
      occurred_at, event_type, route_key, entity_type, entity_id, session_hmac
    ) VALUES (?, 'page_view', 'return_character', 'return_character', ?, ?)
  `).run(NOW, '55555555-5555-4555-8555-555555555555', 'd'.repeat(64))
  sqlite.prepare(`
    INSERT INTO updates (
      id, type, title, content, publication_status, version, created_at, updated_at
    ) VALUES ('99999999-9999-4999-8999-999999999999', 'other', '退役', '退役', 'draft', 1, ?, ?)
  `).run(NOW, NOW)
  sqlite.prepare(`
    UPDATE site_content SET official_channels_json = ? WHERE id = 'site'
  `).run(JSON.stringify([
    { platform: 'qq', account: '10000', qrCodeAssetId: null },
    { platform: 'douyin', account: 'sensitive-account', qrCodeAssetId: QR_ASSET_ID },
    { platform: 'qq_group', account: '20000', qrCodeAssetId: null },
    { platform: 'xiaohongshu', account: 'sensitive-account', qrCodeAssetId: null },
    { platform: 'bilibili', account: 'sensitive-account', qrCodeAssetId: null },
  ]))
}

function options(overrides: Partial<Parameters<typeof runR3StageACleanup>[0]> = {}) {
  return {
    appEnv: 'test' as const,
    applicationBackups: 2,
    cache,
    databaseAbsolute: true,
    endpointConfigured: true,
    environmentPrefix: PREFIX,
    mediaOrigin: MEDIA_ORIGIN,
    privateBucketConfigured: true,
    publicBucketConfigured: true,
    sqlite,
    store,
    ...overrides,
  }
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-r3-a-cleanup-'))
  const databaseFile = resolve(directory, 'legacy.db')
  await migrateDatabase(databaseFile)
  sqlite = openDatabase(databaseFile).sqlite
  store = new FakeRetirementStore()
  cache = new FakeCache()
  seedComplexLegacyState()
})

afterEach(() => {
  sqlite.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('R3-A retirement cleanup', () => {
  it('defaults to a sanitized dry-run and does not mutate objects or database', async () => {
    const result = await runR3StageACleanup(options())
    expect(result.dryRun).toBe(true)
    expect(result.contractReady).toBe(false)
    expect(result.counts).toMatchObject({
      analyticsRows: 1,
      applicationBackups: 2,
      assetRows: 2,
      currentObjects: 8,
      deleteMarkers: 8,
      objectKeys: 8,
      objectVersions: 16,
      operationRows: 1,
      orphanQrAssets: 1,
      retiredAccounts: 3,
      retiredChannelEntries: 3,
      retiredQrReferences: 1,
      returnCharacters: 1,
      returnPhotos: 1,
      updates: 1,
      uploadSessions: 1,
      variantRows: 4,
    })
    expect(store.deleted).toEqual([])
    expect(cache.purges).toEqual([])
    expect(JSON.stringify(result)).not.toContain(PREFIX)
    expect(JSON.stringify(result)).not.toContain('sensitive-account')
    expect(sqlite.prepare(`
      SELECT COUNT(*) FROM audit_logs WHERE action = ?
    `).pluck().get(R3_STAGE_A_AUDIT_ACTION)).toBe(0)
  })

  it('requires the exact confirmation and withholds Contract readiness on failure', async () => {
    await expect(runR3StageACleanup(options({
      dryRun: false,
      confirmation: 'wrong',
    }))).rejects.toThrow(R3_STAGE_A_CONFIRMATION)
    store.failAfter = 1
    await expect(runR3StageACleanup(options({
      dryRun: false,
      confirmation: R3_STAGE_A_CONFIRMATION,
    }))).rejects.toThrow(/Contract is forbidden/)
    expect(sqlite.prepare(`
      SELECT COUNT(*) FROM audit_logs WHERE action = ?
    `).pluck().get(R3_STAGE_A_AUDIT_ACTION)).toBe(0)
  })

  it('deletes versions and markers, waits for purge, and is safely repeatable', async () => {
    const first = await runR3StageACleanup(options({
      dryRun: false,
      confirmation: R3_STAGE_A_CONFIRMATION,
    }))
    expect(first.contractReady).toBe(true)
    expect(first.counts).toMatchObject({
      currentObjects: 0,
      deleteMarkers: 0,
      objectVersions: 0,
    })
    expect(store.deleted).toHaveLength(8)
    expect(cache.purges).toHaveLength(1)
    expect(sqlite.prepare(`
      SELECT COUNT(*) FROM audit_logs WHERE action = ? AND result = 'SUCCESS'
    `).pluck().get(R3_STAGE_A_AUDIT_ACTION)).toBe(1)

    const repeated = await runR3StageACleanup(options({
      dryRun: false,
      confirmation: R3_STAGE_A_CONFIRMATION,
    }))
    expect(repeated.contractReady).toBe(true)
    expect(repeated.counts.currentObjects).toBe(0)
    expect(sqlite.prepare('SELECT COUNT(*) FROM return_photos').pluck().get()).toBe(1)
  })

  it('refuses an unproven test prefix before inventory', async () => {
    await expect(runR3StageACleanup(options({
      environmentPrefix: 'prod/',
    }))).rejects.toThrow(/unique test/)
  })
})

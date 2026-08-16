import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  backupDatabase,
  DATABASE_MIGRATIONS_FOLDER,
  migrateDatabase,
  openDatabase,
  restoreDatabase,
} from '../../server/utils/database'
import {
  R3_STAGE_A_BACKUP_CONFIRMATION,
  runR3StageABackupPrune,
} from '../../server/utils/runner/r3-stage-a-backup-retirement'
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
  failInspectAfter = Number.POSITIVE_INFINITY
  inspectCalls = 0

  seed(scope: R3StageAObjectScope, objectKey: string) {
    this.entries.set(`${scope}:${objectKey}`, {
      current: true,
      deleteMarkers: 1,
      versionBytes: 200,
      versions: 2,
    })
  }

  async inspect(scope: R3StageAObjectScope, objectKey: string) {
    this.inspectCalls += 1
    if (this.inspectCalls > this.failInspectAfter) {
      throw new Error('injected final inventory failure')
    }
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

  async purgeExactWaitAndVerifyUnavailable(urls: readonly string[]) {
    if (this.fail) throw new Error('injected purge failure')
    this.purges.push([...urls])
  }
}

let directory: string
let databaseFile: string
let sqlite: Database.Database
let store: FakeRetirementStore
let cache: FakeCache

function migrationsBeforeContract() {
  const folder = resolve(dirname(databaseFile), 'pre-r3-a-contract-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const contractIndex = journal.entries.findIndex(
    entry => entry.tag === '0036_r3_a_contract',
  )
  if (contractIndex < 0) {
    throw new Error('R3-A contract migration is missing from the journal.')
  }
  const entries = journal.entries.slice(0, contractIndex)
  for (const { tag } of entries) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries,
  }))
  return folder
}

function migrationsFromContractCount() {
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const contractIndex = journal.entries.findIndex(
    entry => entry.tag === '0036_r3_a_contract',
  )
  if (contractIndex < 0) {
    throw new Error('R3-A contract migration is missing from the journal.')
  }
  return journal.entries.length - contractIndex
}

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
    INSERT INTO publication_operations (
      id, operation_type, entity_type, entity_id, requested_version, status,
      cleanup_object_keys_json, edge_purge_urls_json, edge_purge_status,
      version, attempt, started_at, updated_at, completed_at
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'PUBLISH', 'HOME',
      'home', 1, 'DONE', '[]', '[]', 'NOT_REQUIRED', 1, 0, ?, ?, ?
    )
  `).run(NOW, NOW, NOW)
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
  databaseFile = resolve(directory, 'legacy.db')
  await migrateDatabase(databaseFile, {
    migrationsFolder: migrationsBeforeContract(),
  })
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
      pendingObjects: 2,
      privateOriginalKeys: 2,
      privatePreprocessKeys: 2,
      privatePreviewKeys: 0,
      publicDerivedKeys: 3,
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

  it('refuses an ESA URL outside the confirmed isolated-test prefix', async () => {
    sqlite.prepare(`
      UPDATE publication_operations SET edge_purge_urls_json = ?
      WHERE entity_type = 'RETURN_PHOTO'
    `).run(JSON.stringify([`${MEDIA_ORIGIN}/prod/web/retired.png`]))
    await expect(runR3StageACleanup(options()))
      .rejects.toThrow(/outside the confirmed environment prefix/)
    expect(store.inspectCalls).toBe(0)
    expect(cache.purges).toEqual([])
  })

  it('does not persist success when the final inventory fails', async () => {
    store.failInspectAfter = 16
    await expect(runR3StageACleanup(options({
      dryRun: false,
      confirmation: R3_STAGE_A_CONFIRMATION,
    }))).rejects.toThrow(/final inventory failure/)
    expect(sqlite.prepare(`
      SELECT COUNT(*) FROM audit_logs WHERE action = ?
    `).pluck().get(R3_STAGE_A_AUDIT_ACTION)).toBe(0)
  })

  it('blocks the database Contract before successful object cleanup', async () => {
    sqlite.close()
    let migrationError: unknown
    try {
      await migrateDatabase(databaseFile)
    }
    catch (error) {
      migrationError = error
    }
    expect(migrationError).toMatchObject({
      cause: {
        code: 'SQLITE_CONSTRAINT_CHECK',
        message: expect.stringContaining('r3_a_cleanup_required'),
      },
    })
    sqlite = openDatabase(databaseFile).sqlite
    expect(sqlite.prepare(`
      SELECT COUNT(*) FROM return_photos
    `).pluck().get()).toBe(1)
    expect(sqlite.prepare(`
      SELECT 1 FROM sqlite_master
      WHERE type = 'table' AND name = 'updates'
    `).pluck().get()).toBe(1)
  })

  it('contracts a cleaned complex legacy database and enforces target constraints', async () => {
    const oldBackup = resolve(directory, 'backups', 'pre-contract-old.db')
    await backupDatabase(databaseFile, oldBackup)
    expect(existsSync(oldBackup)).toBe(true)

    await runR3StageACleanup(options({
      dryRun: false,
      confirmation: R3_STAGE_A_CONFIRMATION,
    }))
    sqlite.close()
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: migrationsFromContractCount(),
    })
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: 0,
    })
    sqlite = openDatabase(databaseFile).sqlite

    expect(sqlite.prepare(`
      SELECT operation_type, entity_type, status, edge_purge_status,
        internal_error_code, failure_stage
      FROM publication_operations
      WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    `).get()).toEqual({
      operation_type: 'PUBLISH',
      entity_type: 'HOME',
      status: 'DONE',
      edge_purge_status: 'NOT_REQUIRED',
      internal_error_code: null,
      failure_stage: null,
    })
    expect(sqlite.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN ('updates', 'return_characters', 'return_photos')
    `).all()).toEqual([])
    expect(sqlite.prepare(`
      SELECT COUNT(*) FROM assets WHERE id IN (?, ?)
    `).pluck().get(RETURN_ASSET_ID, QR_ASSET_ID)).toBe(0)
    expect(JSON.parse(sqlite.prepare(`
      SELECT official_channels_json FROM site_content WHERE id = 'site'
    `).pluck().get() as string)).toEqual([
      { platform: 'qq', account: '10000', qrCodeAssetId: null },
      { platform: 'qq_group', account: '20000', qrCodeAssetId: null },
    ])
    expect((sqlite.pragma('table_info(site_content)') as { name: string }[])
      .some(column => column.name === 'contact_douyin')).toBe(false)
    expect(sqlite.prepare(`
      SELECT COUNT(*) FROM audit_logs WHERE action = ? AND result = 'SUCCESS'
    `).pluck().get(R3_STAGE_A_AUDIT_ACTION)).toBe(1)
    expect(sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(sqlite.pragma('foreign_key_check')).toEqual([])

    expect(() => sqlite.prepare(`
      INSERT INTO assets (
        id, role, status, private_object_key, sha256, byte_size,
        mime_type, width, height, created_at, updated_at
      ) VALUES (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'return_photo', 'READY',
        'test/r3-a-drill/forbidden/original.png', ?, 100,
        'image/png', 640, 640, ?, ?
      )
    `).run('e'.repeat(64), NOW, NOW)).toThrow(/assets_role/)
    expect(() => sqlite.prepare(`
      INSERT INTO analytics_events (
        occurred_at, event_type, route_key, session_hmac
      ) VALUES (?, 'page_view', 'updates', ?)
    `).run(NOW, 'f'.repeat(64))).toThrow(/analytics_events_route_key/)
    expect(() => sqlite.prepare(`
      UPDATE site_content SET official_channels_json = ? WHERE id = 'site'
    `).run(JSON.stringify([
      { platform: 'qq', account: null, qrCodeAssetId: null },
      { platform: 'douyin', account: null, qrCodeAssetId: null },
      { platform: 'qq_group', account: null, qrCodeAssetId: null },
      { platform: 'xiaohongshu', account: null, qrCodeAssetId: null },
      { platform: 'bilibili', account: null, qrCodeAssetId: null },
    ]))).toThrow(/site_content_official_channels_json/)
    const schemaSql = (sqlite.prepare(`
      SELECT group_concat(sql, ' ') FROM sqlite_master
      WHERE type IN ('table', 'trigger')
    `).pluck().get() as string).toLowerCase()
    expect(schemaSql).not.toContain('return_photo')
    expect(schemaSql).not.toContain('return-wall')
    expect(schemaSql).not.toContain('return_character')
    expect(schemaSql).not.toContain('contact_douyin')

    sqlite.close()
    const cleanBackup = resolve(directory, 'backups', 'post-contract-clean.db')
    const restoredFile = resolve(directory, 'restored', 'post-contract.db')
    await backupDatabase(databaseFile, cleanBackup)
    await restoreDatabase(cleanBackup, restoredFile, {
      activeDatabaseFile: databaseFile,
    })
    const restored = openDatabase(restoredFile).sqlite
    try {
      expect(restored.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(restored.pragma('foreign_key_check')).toEqual([])
      expect(restored.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name IN ('updates', 'return_characters', 'return_photos')
      `).all()).toEqual([])
      expect(JSON.parse(restored.prepare(`
        SELECT official_channels_json FROM site_content WHERE id = 'site'
      `).pluck().get() as string).map((channel: { platform: string }) => channel.platform))
        .toEqual(['qq', 'qq_group'])
    }
    finally {
      restored.close()
    }
    const backupOptions = {
      activeDatabaseFile: databaseFile,
      appEnv: 'test' as const,
      backupDirectories: [resolve(directory, 'backups')],
      cleanBackupFile: cleanBackup,
      restoredDatabaseFile: restoredFile,
    }
    expect(runR3StageABackupPrune(backupOptions)).toMatchObject({
      counts: {
        applicationBackups: 3,
        deletedBackups: 0,
        oldBackups: 2,
      },
      dryRun: true,
    })
    expect(() => runR3StageABackupPrune({
      ...backupOptions,
      confirmation: 'wrong',
      dryRun: false,
    })).toThrow(R3_STAGE_A_BACKUP_CONFIRMATION)
    expect(runR3StageABackupPrune({
      ...backupOptions,
      confirmation: R3_STAGE_A_BACKUP_CONFIRMATION,
      dryRun: false,
    })).toMatchObject({
      counts: {
        applicationBackups: 3,
        deletedBackups: 2,
        oldBackups: 2,
      },
      dryRun: false,
    })
    expect(existsSync(oldBackup)).toBe(false)
    expect(existsSync(cleanBackup)).toBe(true)
    expect(runR3StageABackupPrune(backupOptions)).toMatchObject({
      counts: { applicationBackups: 1, oldBackups: 0 },
      dryRun: true,
    })
    sqlite = openDatabase(databaseFile).sqlite

    const postContract = await runR3StageACleanup(options())
    expect(postContract.counts).toMatchObject({
      analyticsRows: 0,
      assetRows: 0,
      currentObjects: 0,
      deleteMarkers: 0,
      objectKeys: 0,
      objectVersions: 0,
      operationRows: 0,
      orphanQrAssets: 0,
      pendingObjects: 0,
      privateOriginalKeys: 0,
      privatePreprocessKeys: 0,
      privatePreviewKeys: 0,
      publicDerivedKeys: 0,
      retiredAccounts: 0,
      retiredChannelEntries: 0,
      retiredQrReferences: 0,
      returnCharacters: 0,
      returnPhotos: 0,
      updates: 0,
      uploadSessions: 0,
      variantRows: 0,
    })
  })
})

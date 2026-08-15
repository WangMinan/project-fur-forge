import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  DATABASE_MIGRATIONS_FOLDER,
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import { claimHeroCollectionVersion } from '../../server/utils/repository/hero-collection-repository'

const directories: string[] = []

function databaseFile() {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-r3-hero-'))
  directories.push(directory)
  return resolve(directory, 'studio.db')
}

function migrationsThrough(databaseFile: string, lastTag: string) {
  const folder = resolve(dirname(databaseFile), `migrations-through-${lastTag}`)
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  const end = journal.entries.findIndex(entry => entry.tag === lastTag) + 1
  const entries = journal.entries.slice(0, end)
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

function seedAsset(
  sqlite: ReturnType<typeof openDatabase>['sqlite'],
  id: string,
  role: 'home_hero_landscape' | 'home_hero_portrait',
  now: number,
) {
  const landscape = role === 'home_hero_landscape'
  sqlite.prepare(`
    INSERT INTO assets (
      id, role, status, private_object_key, sha256, byte_size,
      mime_type, width, height, created_at, updated_at
    ) VALUES (?, ?, 'READY', ?, ?, 1024, 'image/png', ?, ?, ?, ?)
  `).run(
    id,
    role,
    `test/original/${id}.png`,
    id.replaceAll('-', '').padEnd(64, 'a').slice(0, 64),
    landscape ? 1920 : 1080,
    landscape ? 1080 : 1920,
    now,
    now,
  )
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('R3-B Hero expand migration', () => {
  it('creates exactly four empty collection domains on a fresh database and is re-entrant', async () => {
    const file = databaseFile()
    await expect(migrateDatabase(file)).resolves.toMatchObject({ applied: 38 })
    await expect(migrateDatabase(file)).resolves.toMatchObject({ applied: 0 })
    const database = openDatabase(file)
    try {
      expect(database.sqlite.prepare(`
        SELECT placement, orientation, version
        FROM site_hero_collections
        ORDER BY placement, orientation
      `).all()).toEqual([
        { placement: 'commission', orientation: 'landscape', version: 1 },
        { placement: 'commission', orientation: 'portrait', version: 1 },
        { placement: 'home', orientation: 'landscape', version: 1 },
        { placement: 'home', orientation: 'portrait', version: 1 },
      ])
      expect(database.sqlite.prepare('SELECT count(*) FROM site_hero_items').pluck().get()).toBe(0)
      expect(database.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(database.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      database.sqlite.close()
    }
  })

  it('deterministically splits existing pairs, clears previews and normalizes each orientation', async () => {
    const file = databaseFile()
    await migrateDatabase(file, {
      migrationsFolder: migrationsThrough(file, '0036_r3_a_contract'),
    })
    const before = openDatabase(file)
    const now = Date.UTC(2026, 7, 16)
    const ids = {
      homeA: '11111111-1111-4111-8111-111111111111',
      homeB: '22222222-2222-4222-8222-222222222222',
      commission: '33333333-3333-4333-8333-333333333333',
    }
    const assets = [
      ['44444444-4444-4444-8444-444444444444', 'home_hero_landscape'],
      ['55555555-5555-4555-8555-555555555555', 'home_hero_portrait'],
      ['66666666-6666-4666-8666-666666666666', 'home_hero_landscape'],
      ['77777777-7777-4777-8777-777777777777', 'home_hero_portrait'],
      ['88888888-8888-4888-8888-888888888888', 'home_hero_landscape'],
      ['99999999-9999-4999-8999-999999999999', 'home_hero_portrait'],
    ] as const
    try {
      before.sqlite.prepare(`
        INSERT INTO users (
          id, username, password_hash, password_changed_at,
          created_at, updated_at
        ) VALUES (?, 'r3-hero-admin', 'hash', ?, ?, ?)
      `).run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now, now, now)
      for (const [id, role] of assets) {
        seedAsset(before.sqlite, id, role, now)
      }
      before.sqlite.prepare(`
        INSERT INTO site_hero_slides (
          id, placement, landscape_asset_id, portrait_asset_id,
          alt_text, sort_order, enabled,
          landscape_preview_object_key, portrait_preview_object_key,
          preview_expires_at, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ids.homeA, 'home', assets[0][0], assets[1][0], '首页 A', 4, 1,
        'test/preview/a-landscape.webp', 'test/preview/a-portrait.webp', now + 1_000, 3, now, now)
      before.sqlite.prepare(`
        INSERT INTO site_hero_slides (
          id, placement, landscape_asset_id, portrait_asset_id,
          alt_text, sort_order, enabled, version, created_at, updated_at
        ) VALUES (?, 'home', ?, ?, '首页 B', 9, 0, 2, ?, ?)
      `).run(ids.homeB, assets[2][0], assets[3][0], now, now)
      before.sqlite.prepare(`
        INSERT INTO site_hero_slides (
          id, placement, landscape_asset_id, portrait_asset_id,
          alt_text, sort_order, enabled, version, created_at, updated_at
        ) VALUES (?, 'commission', ?, ?, '委托 A', 3, 1, 5, ?, ?)
      `).run(ids.commission, assets[4][0], assets[5][0], now, now)
      const siteVersion = Number(before.sqlite.prepare(`
        SELECT version FROM site_content WHERE id = 'site'
      `).pluck().get())
      before.sqlite.prepare(`
        INSERT INTO upload_sessions (
          id, owner_type, owner_id, owner_version, media_role,
          private_object_key, expected_content_type, expected_bytes,
          expected_content_md5, expected_sha256, expected_width,
          expected_height, created_by, status, asset_id, created_at,
          expires_at, updated_at
        ) VALUES (?, 'site', 'home', ?, 'home_hero_landscape', ?,
          'image/png', 1024, ?, ?, 1920, 1080, ?, 'COMPLETED', ?, ?, ?, ?)
      `).run(
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        siteVersion,
        'test/pending/legacy.png',
        'A'.repeat(22) + '==',
        'b'.repeat(64),
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        assets[0][0],
        now,
        now + 300_000,
        now,
      )
    }
    finally {
      before.sqlite.close()
    }

    await expect(migrateDatabase(file)).resolves.toMatchObject({ applied: 1 })
    await expect(migrateDatabase(file)).resolves.toMatchObject({ applied: 0 })
    const after = openDatabase(file)
    try {
      const items = after.sqlite.prepare(`
        SELECT id, placement, orientation, asset_id AS assetId,
          alt_text AS alt, sort_order AS sortOrder, enabled,
          preview_object_key AS previewObjectKey,
          preview_expires_at AS previewExpiresAt, version
        FROM site_hero_items
        ORDER BY placement, orientation, sort_order, id
      `).all()
      expect(items).toHaveLength(6)
      expect(items).toContainEqual({
        id: `${ids.homeA}:landscape`,
        placement: 'home',
        orientation: 'landscape',
        assetId: assets[0][0],
        alt: '首页 A',
        sortOrder: 0,
        enabled: 1,
        previewObjectKey: null,
        previewExpiresAt: null,
        version: 3,
      })
      expect(items).toContainEqual(expect.objectContaining({
        id: `${ids.homeB}:portrait`,
        sortOrder: 1,
        enabled: 0,
      }))
      expect(after.sqlite.prepare(`
        SELECT owner_id AS ownerId, owner_version AS ownerVersion
        FROM upload_sessions
      `).get()).toEqual({
        ownerId: 'hero-home-landscape',
        ownerVersion: 1,
      })
      expect(after.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(after.sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
    }
    finally {
      after.sqlite.close()
    }
  })

  it('keeps collection CAS and upload ownership independent', async () => {
    const file = databaseFile()
    await migrateDatabase(file)
    const database = openDatabase(file)
    try {
      claimHeroCollectionVersion(database.sqlite, 'home', 'landscape', 1, 100)
      claimHeroCollectionVersion(database.sqlite, 'home', 'portrait', 1, 101)
      expect(() => claimHeroCollectionVersion(
        database.sqlite,
        'home',
        'landscape',
        1,
        102,
      )).toThrow(/stale/u)
      expect(database.sqlite.prepare(`
        SELECT placement, orientation, version
        FROM site_hero_collections
        WHERE placement = 'commission'
        ORDER BY orientation
      `).all()).toEqual([
        { placement: 'commission', orientation: 'landscape', version: 1 },
        { placement: 'commission', orientation: 'portrait', version: 1 },
      ])
    }
    finally {
      database.sqlite.close()
    }
  })
})

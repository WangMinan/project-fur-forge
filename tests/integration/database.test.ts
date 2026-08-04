import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
  dirname,
  resolve,
} from 'node:path'
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  assertDatabaseMigrated,
  backupDatabase,
  DATABASE_BUSY_TIMEOUT_MS,
  DATABASE_MIGRATIONS_FOLDER,
  DEVELOPMENT_DATABASE_FILE,
  migrateDatabase,
  openDatabase,
  PRODUCTION_DATABASE_FILE,
  readSqlitePragmas,
  resolveDatabaseFile,
} from '../../server/utils/database'

const temporaryDirectories: string[] = []

function temporaryDatabase(name = 'studio.db') {
  const directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-db-'))
  temporaryDirectories.push(directory)
  return resolve(directory, name)
}

function migrationsBeforeGate07(databaseFile: string) {
  const folder = resolve(dirname(databaseFile), 'pre-gate07-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  for (const { tag } of journal.entries.slice(0, 7)) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries: journal.entries.slice(0, 7),
  }))
  return folder
}

function migrationsBeforeT23(databaseFile: string) {
  const folder = resolve(dirname(databaseFile), 'pre-t23-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })
  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as { entries: { tag: string }[] }
  for (const { tag } of journal.entries.slice(0, 11)) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, `${tag}.sql`),
      resolve(folder, `${tag}.sql`),
    )
  }
  writeFileSync(resolve(meta, '_journal.json'), JSON.stringify({
    ...journal,
    entries: journal.entries.slice(0, 11),
  }))
  return folder
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => rmSync(
    directory,
    {
      force: true,
      recursive: true,
    },
  ))
})

describe('SQLite foundation', () => {
  it('migrates an empty database and repeated migration is idempotent', async () => {
    const databaseFile = temporaryDatabase()

    expect(() => assertDatabaseMigrated(databaseFile))
      .toThrow(/run pnpm db:migrate first/)
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: 14,
      backupFile: undefined,
    })
    expect(() => assertDatabaseMigrated(databaseFile)).not.toThrow()
    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: 0,
      backupFile: undefined,
    })

    const database = openDatabase(databaseFile)

    try {
      expect(database.sqlite.prepare(`
        SELECT COUNT(*)
        FROM sqlite_master
        WHERE type = 'table' AND name = '__drizzle_migrations'
      `).pluck().get()).toBe(1)
      expect(database.sqlite.prepare(`
        SELECT COUNT(*) FROM __drizzle_migrations
      `).pluck().get()).toBe(14)
    }
    finally {
      database.sqlite.close()
    }
  })

  it('upgrades existing self-referencing variants without losing integrity', async () => {
    const databaseFile = temporaryDatabase()
    await migrateDatabase(databaseFile, {
      migrationsFolder: migrationsBeforeGate07(databaseFile),
    })
    const legacy = openDatabase(databaseFile)

    try {
      const now = Date.UTC(2026, 7, 1)
      const assetSha = 'a'.repeat(64)
      const sourceSha = 'b'.repeat(64)
      legacy.sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, created_at, updated_at
        ) VALUES (
          'asset', 'studio_photo', 'READY', 'dev/original/asset.png',
          ?, 1024, 'image/png', 1600, 900, ?, ?
        )
      `).run(assetSha, now, now)
      legacy.sqlite.prepare(`
        INSERT INTO asset_variants (
          id, asset_id, source_variant_id, storage_scope, status, object_key,
          input_sha256, media_role, usage, width, height, format, quality,
          crop_identity, recipe_version, watermark_profile, logo_digest,
          watermark_anchor, sha256, byte_size, created_at, updated_at
        ) VALUES (
          'source', 'asset', NULL, 'PRIVATE', 'READY',
          'dev/processing/source.png', ?, 'studio_photo', 'preprocess',
          1600, 900, 'png', 82, 'source-crop', 'recipe-v1', 'none',
          'none', 'none', ?, 2048, ?, ?
        )
      `).run(assetSha, sourceSha, now, now)
      legacy.sqlite.prepare(`
        INSERT INTO asset_variants (
          id, asset_id, source_variant_id, storage_scope, status, object_key,
          input_sha256, media_role, usage, width, height, format, quality,
          crop_identity, recipe_version, watermark_profile, logo_digest,
          watermark_anchor, sha256, byte_size, created_at, updated_at
        ) VALUES (
          'public', 'asset', 'source', 'PUBLIC', 'READY',
          'dev/web/public.webp', ?, 'studio_photo', 'detail',
          1280, 720, 'webp', 82, 'public-crop', 'recipe-v1',
          'brand-standard-v1', ?, 'top-left', ?, 1024, ?, ?
        )
      `).run(sourceSha, 'c'.repeat(64), 'd'.repeat(64), now, now)
    }
    finally {
      legacy.sqlite.close()
    }

    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: 7,
    })
    const upgraded = openDatabase(databaseFile)
    try {
      expect(upgraded.sqlite.pragma('foreign_key_check')).toEqual([])
      expect(upgraded.sqlite.prepare(`
        SELECT source_variant_id FROM asset_variants WHERE id = 'public'
      `).pluck().get()).toBe('source')
    }
    finally {
      upgraded.sqlite.close()
    }
  })

  it('migrates an existing published studio-photo relation without touching its private original', async () => {
    const databaseFile = temporaryDatabase()
    await migrateDatabase(databaseFile, {
      migrationsFolder: migrationsBeforeT23(databaseFile),
    })
    const legacy = openDatabase(databaseFile)
    const privateKey = 'prod/original/t21/source.png'
    try {
      const now = Date.UTC(2026, 7, 2)
      legacy.sqlite.prepare(`
        INSERT INTO works (
          id, slug, character_name, species, suit_type, purpose,
          owner_display, publication_status, created_at, updated_at
        ) VALUES (
          't21-work', 't21-work', '旧作品', '犬科', 'full', 'showcase',
          '不公开', 'published', ?, ?
        )
      `).run(now, now)
      legacy.sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, created_at, updated_at
        ) VALUES (
          't21-photo', 'studio_photo', 'READY', ?, ?, 1024,
          'image/png', 3200, 2400, ?, ?
        )
      `).run(privateKey, 'a'.repeat(64), now, now)
      legacy.sqlite.prepare(`
        INSERT INTO work_assets (
          work_id, asset_id, role, alt_text, position, is_primary
        ) VALUES (
          't21-work', 't21-photo', 'studio_photo', '旧作品出厂照', 0, 1
        )
      `).run()
    }
    finally {
      legacy.sqlite.close()
    }

    await expect(migrateDatabase(databaseFile)).resolves.toMatchObject({
      applied: 3,
    })
    const upgraded = openDatabase(databaseFile)
    try {
      expect(upgraded.sqlite.prepare(`
        SELECT
          work.publication_status AS publicationStatus,
          relation.position,
          relation.is_primary AS "primary",
          asset.private_object_key AS privateObjectKey
        FROM works AS work
        JOIN work_assets AS relation ON relation.work_id = work.id
        JOIN assets AS asset ON asset.id = relation.asset_id
        WHERE work.id = 't21-work'
      `).get()).toEqual({
        publicationStatus: 'published',
        position: 0,
        primary: 1,
        privateObjectKey: privateKey,
      })
      expect(upgraded.sqlite.pragma('foreign_key_check')).toEqual([])
    }
    finally {
      upgraded.sqlite.close()
    }
  })

  it('enforces the required PRAGMAs on every connection', () => {
    const database = openDatabase(temporaryDatabase())

    try {
      expect(readSqlitePragmas(database.sqlite)).toEqual({
        busyTimeout: DATABASE_BUSY_TIMEOUT_MS,
        foreignKeys: 1,
        journalMode: 'wal',
        synchronous: 2,
      })
    }
    finally {
      database.sqlite.close()
    }
  })

  it('keeps temporary test databases isolated', () => {
    const first = openDatabase(temporaryDatabase('first.db'))
    const second = openDatabase(temporaryDatabase('second.db'))

    try {
      first.sqlite.exec('CREATE TABLE marker (value TEXT NOT NULL)')
      first.sqlite.prepare('INSERT INTO marker VALUES (?)').run('first')

      expect(first.sqlite.prepare('SELECT value FROM marker').pluck().get())
        .toBe('first')
      expect(second.sqlite.prepare(`
        SELECT COUNT(*)
        FROM sqlite_master
        WHERE type = 'table' AND name = 'marker'
      `).pluck().get()).toBe(0)
    }
    finally {
      first.sqlite.close()
      second.sqlite.close()
    }
  })

  it('creates a consistent online backup without copying the active db file', async () => {
    const databaseFile = temporaryDatabase('source.db')
    const backupFile = temporaryDatabase('backup.db')
    const source = openDatabase(databaseFile)

    try {
      source.sqlite.exec('CREATE TABLE marker (value TEXT NOT NULL)')
      source.sqlite.prepare('INSERT INTO marker VALUES (?)').run('saved')

      await expect(backupDatabase(databaseFile, backupFile))
        .resolves.toBe(backupFile)

      const backup = openDatabase(backupFile)
      try {
        expect(backup.sqlite.prepare('SELECT value FROM marker').pluck().get())
          .toBe('saved')
      }
      finally {
        backup.sqlite.close()
      }
    }
    finally {
      source.sqlite.close()
    }
  })

  it('does not create a database while backing up a missing source', async () => {
    const databaseFile = temporaryDatabase('missing.db')
    const backupFile = temporaryDatabase('backup.db')

    await expect(backupDatabase(databaseFile, backupFile))
      .rejects.toThrow(/does not exist or is empty/)
  })
})

describe('database path boundaries', () => {
  it('locks development and production to their documented files', () => {
    const cwd = resolve(tmpdir(), 'fur-forge-project')

    expect(resolveDatabaseFile({
      appEnv: 'development',
      databaseFile: DEVELOPMENT_DATABASE_FILE,
    }, cwd)).toBe(resolve(cwd, DEVELOPMENT_DATABASE_FILE))
    expect(resolveDatabaseFile({
      appEnv: 'production',
      databaseFile: PRODUCTION_DATABASE_FILE,
    }, cwd)).toBe(PRODUCTION_DATABASE_FILE)

    expect(() => resolveDatabaseFile({
      appEnv: 'development',
      databaseFile: 'other.db',
    }, cwd)).toThrow(/Development DATABASE_FILE/)
    expect(() => resolveDatabaseFile({
      appEnv: 'production',
      databaseFile: resolve(cwd, 'studio.db'),
    }, cwd)).toThrow(/Production DATABASE_FILE/)
  })

  it('requires tests to use an absolute temporary database', () => {
    const databaseFile = temporaryDatabase()

    expect(resolveDatabaseFile({
      appEnv: 'test',
      databaseFile,
    })).toBe(databaseFile)
    expect(() => resolveDatabaseFile({
      appEnv: 'test',
      databaseFile: DEVELOPMENT_DATABASE_FILE,
    })).toThrow(/system temporary directory/)
    expect(() => resolveDatabaseFile({
      appEnv: 'test',
      databaseFile: PRODUCTION_DATABASE_FILE,
    })).toThrow(/system temporary directory/)
  })
})

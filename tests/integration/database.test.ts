import {
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
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
      applied: 5,
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
      `).pluck().get()).toBe(5)
    }
    finally {
      database.sqlite.close()
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

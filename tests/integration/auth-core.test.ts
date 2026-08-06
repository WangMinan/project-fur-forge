import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  authenticateAdmin,
  initializeAdmin,
  LOGIN_FAILURE_LIMIT,
  LOGIN_LOCK_MS,
} from '../../server/utils/service/auth'
import {
  initializeAdminCommand,
  RESET_CONFIRMATION,
  resetAdminPasswordCommand,
} from '../../server/utils/service/auth-commands'
import {
  assertDatabaseMigrated,
  DATABASE_MIGRATIONS_FOLDER,
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import { loadRuntimeConfig } from '../../server/utils/runtime-config'

const originalPassword = 'initial admin password'
let directory: string
let databaseFile: string

function legacyMigrationsFolder() {
  const folder = resolve(directory, 'legacy-migrations')
  const meta = resolve(folder, 'meta')
  mkdirSync(meta, { recursive: true })

  for (const migration of [
    '0000_sparkling_absorbing_man.sql',
    '0001_preserve_design_sheet_purpose.sql',
  ]) {
    copyFileSync(
      resolve(DATABASE_MIGRATIONS_FOLDER, migration),
      resolve(folder, migration),
    )
  }

  const journal = JSON.parse(readFileSync(
    resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
    'utf8',
  )) as {
    entries: unknown[]
  }
  writeFileSync(
    resolve(meta, '_journal.json'),
    JSON.stringify({
      ...journal,
      entries: journal.entries.slice(0, 2),
    }),
  )
  return folder
}

function config(file = databaseFile) {
  return loadRuntimeConfig({
    env: {
      APP_ENV: 'test',
      DATABASE_FILE: file,
      PUBLIC_BASE_URL: 'http://127.0.0.1:3200',
      ADMIN_BASE_URL: 'http://localhost:3200',
      MEDIA_BASE_URL: 'https://media.test.invalid',
      OSS_UPLOAD_BASE_URL: 'https://upload.test.invalid',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters',
    },
  })
}

beforeEach(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-auth-core-'))
  databaseFile = resolve(directory, 'auth.db')
  await migrateDatabase(databaseFile)
})

afterEach(() => {
  rmSync(directory, { force: true, recursive: true })
})

describe('single administrator commands and lockout', () => {
  it('requires an explicitly migrated database before initialization', async () => {
    const missingDatabase = resolve(directory, 'missing.db')

    await expect(initializeAdminCommand(config(missingDatabase), {
      username: 'admin',
      password: originalPassword,
    })).rejects.toThrow(/run pnpm db:migrate first/)
    expect(existsSync(missingDatabase)).toBe(false)
  })

  it('initializes idempotently without replacing the first password', async () => {
    const first = await initializeAdminCommand(config(), {
      username: 'admin',
      password: originalPassword,
    })
    const repeated = await initializeAdminCommand(config(), {
      username: 'admin',
      password: 'different admin password',
    })
    const database = openDatabase(databaseFile)

    try {
      expect(first.created).toBe(true)
      expect(repeated).toEqual({
        created: false,
        id: first.id,
        username: 'admin',
      })
      await expect(authenticateAdmin(database.sqlite, {
        username: 'admin',
        password: originalPassword,
      })).resolves.toMatchObject({
        id: first.id,
      })
      await expect(authenticateAdmin(database.sqlite, {
        username: 'admin',
        password: 'different admin password',
      })).resolves.toBeNull()
    }
    finally {
      database.sqlite.close()
    }
  }, 20_000)

  it('locks after five failures for thirty minutes', async () => {
    await initializeAdminCommand(config(), {
      username: 'admin',
      password: originalPassword,
    })
    const database = openDatabase(databaseFile)
    const now = Date.UTC(2026, 6, 31, 12)

    try {
      for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
        await expect(authenticateAdmin(database.sqlite, {
          username: 'admin',
          password: 'wrong admin password',
          now,
        })).resolves.toBeNull()
      }

      const row = database.sqlite.prepare(`
        SELECT failed_login_count, locked_until
        FROM users
      `).get() as {
        failed_login_count: number
        locked_until: number
      }
      expect(row).toEqual({
        failed_login_count: LOGIN_FAILURE_LIMIT,
        locked_until: now + LOGIN_LOCK_MS,
      })
      await expect(authenticateAdmin(database.sqlite, {
        username: 'admin',
        password: originalPassword,
        now: now + LOGIN_LOCK_MS - 1,
      })).resolves.toBeNull()
      await expect(authenticateAdmin(database.sqlite, {
        username: 'admin',
        password: originalPassword,
        now: now + LOGIN_LOCK_MS,
      })).resolves.toMatchObject({
        username: 'admin',
      })
    }
    finally {
      database.sqlite.close()
    }
  }, 20_000)

  it('requires explicit confirmation and invalidates sessions on reset', async () => {
    await initializeAdminCommand(config(), {
      username: 'admin',
      password: originalPassword,
    })
    expect(() => resetAdminPasswordCommand(config(), {
      username: 'admin',
      password: 'replacement admin password',
      confirmation: 'wrong',
    })).toThrow(/Reset requires/)

    const result = await resetAdminPasswordCommand(config(), {
      username: 'admin',
      password: 'replacement admin password',
      confirmation: RESET_CONFIRMATION,
    })
    const database = openDatabase(databaseFile)

    try {
      expect(result.version).toBe(2)
      const row = database.sqlite.prepare(`
        SELECT session_version, version
        FROM users
      `).get()
      expect(row).toEqual({
        session_version: 2,
        version: 2,
      })
      await expect(authenticateAdmin(database.sqlite, {
        username: 'admin',
        password: originalPassword,
      })).resolves.toBeNull()
      await expect(authenticateAdmin(database.sqlite, {
        username: 'admin',
        password: 'replacement admin password',
      })).resolves.toMatchObject({
        sessionVersion: 2,
      })
    }
    finally {
      database.sqlite.close()
    }
  }, 20_000)

  it('never migrates or backs up while resetting a password', async () => {
    const pendingDatabaseFile = resolve(directory, 'pending.db')
    await migrateDatabase(pendingDatabaseFile, {
      migrationsFolder: legacyMigrationsFolder(),
    })
    const before = openDatabase(pendingDatabaseFile)
    await initializeAdmin(before.sqlite, {
      username: 'admin',
      password: originalPassword,
    })
    let migrationCount: number
    let userVersion: number

    try {
      migrationCount = before.sqlite.prepare(`
        SELECT COUNT(*) FROM __drizzle_migrations
      `).pluck().get() as number
      userVersion = before.sqlite.prepare(`
        SELECT version FROM users
      `).pluck().get() as number
    }
    finally {
      before.sqlite.close()
    }

    expect(() => assertDatabaseMigrated(pendingDatabaseFile))
      .toThrow(/pending migration/)
    await expect(resetAdminPasswordCommand(config(pendingDatabaseFile), {
      username: 'admin',
      password: 'replacement admin password',
      confirmation: RESET_CONFIRMATION,
    })).rejects.toThrow(/run pnpm db:migrate first/)

    const afterRejectedReset = openDatabase(pendingDatabaseFile)
    try {
      expect(afterRejectedReset.sqlite.prepare(`
        SELECT COUNT(*) FROM __drizzle_migrations
      `).pluck().get()).toBe(migrationCount)
      expect(afterRejectedReset.sqlite.prepare(`
        SELECT version FROM users
      `).pluck().get()).toBe(userVersion)
    }
    finally {
      afterRejectedReset.sqlite.close()
    }
    expect(existsSync(resolve(directory, 'backups'))).toBe(false)

    await expect(migrateDatabase(pendingDatabaseFile)).resolves.toMatchObject({
      // 历史库只应用了前两个迁移，剩余数量从 journal 推导。
      applied: JSON.parse(readFileSync(
        resolve(DATABASE_MIGRATIONS_FOLDER, 'meta/_journal.json'),
        'utf8',
      ) as string).entries.length - 2,
    })
    const backupEntries = readdirSync(resolve(directory, 'backups'))
    expect(backupEntries.length).toBeGreaterThan(0)
    await expect(resetAdminPasswordCommand(config(pendingDatabaseFile), {
      username: 'admin',
      password: 'replacement admin password',
      confirmation: RESET_CONFIRMATION,
    })).resolves.toMatchObject({
      version: userVersion + 1,
    })
    expect(readdirSync(resolve(directory, 'backups'))).toEqual(backupEntries)
  }, 20_000)
})

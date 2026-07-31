import {
  mkdtempSync,
  rmSync,
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
  LOGIN_FAILURE_LIMIT,
  LOGIN_LOCK_MS,
} from '../../server/utils/auth'
import {
  initializeAdminCommand,
  RESET_CONFIRMATION,
  resetAdminPasswordCommand,
} from '../../server/utils/auth-commands'
import { openDatabase } from '../../server/utils/database'
import { loadRuntimeConfig } from '../../server/utils/runtime-config'

const originalPassword = 'initial admin password'
let directory: string
let databaseFile: string

function config() {
  return loadRuntimeConfig({
    env: {
      APP_ENV: 'test',
      DATABASE_FILE: databaseFile,
      PUBLIC_BASE_URL: 'http://127.0.0.1:3200',
      ADMIN_BASE_URL: 'http://localhost:3200',
      MEDIA_BASE_URL: 'https://media.test.invalid',
      OSS_UPLOAD_BASE_URL: 'https://upload.test.invalid',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters',
    },
  })
}

beforeEach(() => {
  directory = mkdtempSync(resolve(tmpdir(), 'fur-forge-auth-core-'))
  databaseFile = resolve(directory, 'auth.db')
})

afterEach(() => {
  rmSync(directory, { force: true, recursive: true })
})

describe('single administrator commands and lockout', () => {
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
})

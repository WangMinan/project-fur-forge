import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setup } from '@nuxt/test-utils/e2e'
import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { initializeAdmin } from '../../server/utils/auth'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'

const port = 3103
const publicBaseUrl = `http://127.0.0.1:${port}`
const adminBaseUrl = `http://localhost:${port}`
const databaseFile = resolve(
  tmpdir(),
  `fur-forge-auth-api-${process.pid}.db`,
)
const originalPassword = 'initial admin password'
const sessionSecret = 'test-session-secret-at-least-32-characters'

await migrateDatabase(databaseFile)
const setupDatabase = openDatabase(databaseFile)
await initializeAdmin(setupDatabase.sqlite, {
  username: 'admin',
  password: originalPassword,
})
const originalPasswordHash = setupDatabase.sqlite.prepare(`
  SELECT password_hash FROM users WHERE username = 'admin'
`).pluck().get() as string
setupDatabase.sqlite.close()

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  browser: false,
  server: true,
  port,
  env: {
    APP_ENV: 'test',
    DATABASE_FILE: databaseFile,
    PUBLIC_BASE_URL: publicBaseUrl,
    ADMIN_BASE_URL: adminBaseUrl,
    MEDIA_BASE_URL: 'https://media.test.invalid',
    OSS_UPLOAD_BASE_URL: 'https://upload.test.invalid',
    SESSION_SECRET: sessionSecret,
  },
})

function cookieFrom(response: Response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? ''
}

function expectPrivateResponseHeaders(response: Response) {
  expect(response.headers.get('cache-control')).toBe(
    'no-store, max-age=0',
  )
  expect(response.headers.get('pragma')).toBe('no-cache')
  expect(response.headers.get('x-robots-tag')).toBe(
    'noindex, nofollow, noarchive',
  )
  expect(response.headers.get('vary')).toBe('Cookie, Origin')
}

async function login(
  username = 'admin',
  password = originalPassword,
  origin: string | null | undefined = adminBaseUrl,
  baseUrl = adminBaseUrl,
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (origin) {
    headers.origin = origin
  }

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username,
      password,
    }),
  })
  const body = await response.json()
  return {
    body,
    cookie: cookieFrom(response),
    response,
  }
}

beforeEach(() => {
  const database = openDatabase(databaseFile)
  try {
    database.sqlite.prepare(`
      UPDATE users
      SET
        password_hash = ?,
        session_version = 1,
        version = 1,
        failed_login_count = 0,
        locked_until = NULL,
        active = 1,
        updated_at = ?
      WHERE username = 'admin'
    `).run(originalPasswordHash, Date.now())
  }
  finally {
    database.sqlite.close()
  }
})

describe('authentication API', () => {
  it('logs in and sets a Host-only strict eight-hour cookie', async () => {
    const { body, cookie, response } = await login()
    const setCookie = response.headers.get('set-cookie') ?? ''

    expect(response.status).toBe(200)
    expectPrivateResponseHeaders(response)
    expect(body).toMatchObject({
      data: {
        user: {
          username: 'admin',
          version: 1,
        },
      },
    })
    expect(body.data.csrfToken).toMatch(/^[A-Za-z0-9_-]{32,128}$/)
    expect(setCookie).toContain('__Host-fur-forge-session=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).not.toContain('Domain=')
    const expires = /Expires=([^;]+)/.exec(setCookie)?.[1]
    expect(expires).toBeDefined()
    expect(new Date(expires!).getTime() - Date.now()).toBeGreaterThan(
      7.9 * 60 * 60 * 1_000,
    )
    expect(new Date(expires!).getTime() - Date.now()).toBeLessThanOrEqual(
      8 * 60 * 60 * 1_000,
    )

    const session = await fetch(`${adminBaseUrl}/api/auth/session`, {
      headers: { cookie },
    })
    expect(session.status).toBe(200)
    expectPrivateResponseHeaders(session)
    await expect(session.json()).resolves.toMatchObject({
      data: {
        user: {
          username: 'admin',
        },
      },
    })
  }, 20_000)

  it('does not reveal whether the account exists or is locked', async () => {
    const wrongPassword = await login('admin', 'wrong admin password')
    const unknownUser = await login('unknown', 'wrong admin password')

    expect(wrongPassword.response.status).toBe(401)
    expect(unknownUser.response.status).toBe(401)
    expectPrivateResponseHeaders(wrongPassword.response)
    expectPrivateResponseHeaders(unknownUser.response)
    expect(wrongPassword.body).toEqual(unknownUser.body)

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await login('admin', 'wrong admin password')
    }
    const locked = await login()
    expect(locked.response.status).toBe(401)
    expect(locked.body).toEqual(wrongPassword.body)

    const database = openDatabase(databaseFile)
    try {
      const row = database.sqlite.prepare(`
        SELECT failed_login_count, locked_until FROM users
      `).get() as {
        failed_login_count: number
        locked_until: number
      }
      expect(row.failed_login_count).toBe(5)
      expect(row.locked_until).toBeGreaterThan(Date.now())
    }
    finally {
      database.sqlite.close()
    }
  }, 30_000)

  it('enforces public Host, Origin and CSRF boundaries', async () => {
    const missingOrigin = await login(
      'admin',
      originalPassword,
      null,
    )
    const publicHost = await login(
      'admin',
      originalPassword,
      adminBaseUrl,
      publicBaseUrl,
    )
    expect(missingOrigin.response.status).toBe(403)
    expect(publicHost.response.status).toBe(404)
    expectPrivateResponseHeaders(missingOrigin.response)
    expectPrivateResponseHeaders(publicHost.response)

    const authenticated = await login()
    const passwordRequest = {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie: authenticated.cookie,
        origin: adminBaseUrl,
      },
      body: JSON.stringify({
        expectedVersion: 1,
        payload: {
          currentPassword: originalPassword,
          newPassword: 'replacement admin password',
        },
      }),
    }
    const missingCsrf = await fetch(
      `${adminBaseUrl}/api/admin/account/password`,
      passwordRequest,
    )
    expect(missingCsrf.status).toBe(403)
    expectPrivateResponseHeaders(missingCsrf)

    const wrongOrigin = await fetch(
      `${adminBaseUrl}/api/admin/account/password`,
      {
        ...passwordRequest,
        headers: {
          ...passwordRequest.headers,
          origin: publicBaseUrl,
          'x-csrf-token': authenticated.body.data.csrfToken,
        },
      },
    )
    expect(wrongOrigin.status).toBe(403)
    expectPrivateResponseHeaders(wrongOrigin)

    const conflict = await fetch(
      `${adminBaseUrl}/api/admin/account/password`,
      {
        ...passwordRequest,
        headers: {
          ...passwordRequest.headers,
          'x-csrf-token': authenticated.body.data.csrfToken,
        },
        body: JSON.stringify({
          expectedVersion: 99,
          payload: {
            currentPassword: originalPassword,
            newPassword: 'replacement admin password',
          },
        }),
      },
    )
    expect(conflict.status).toBe(409)
    expectPrivateResponseHeaders(conflict)

    const failure = await fetch(
      `${adminBaseUrl}/api/auth/__test__/error`,
    )
    expect(failure.status).toBe(500)
    expectPrivateResponseHeaders(failure)
  }, 20_000)

  it('changes password and invalidates every old SessionVersion', async () => {
    const authenticated = await login()
    const changed = await fetch(
      `${adminBaseUrl}/api/admin/account/password`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: authenticated.cookie,
          origin: adminBaseUrl,
          'x-csrf-token': authenticated.body.data.csrfToken,
        },
        body: JSON.stringify({
          expectedVersion: 1,
          payload: {
            currentPassword: originalPassword,
            newPassword: 'replacement admin password',
          },
        }),
      },
    )

    expect(changed.status).toBe(200)
    expectPrivateResponseHeaders(changed)
    await expect(changed.json()).resolves.toEqual({
      data: {
        version: 2,
        reauthenticationRequired: true,
      },
    })
    const staleSession = await fetch(
      `${adminBaseUrl}/api/auth/session`,
      {
        headers: { cookie: authenticated.cookie },
      },
    )
    expect(staleSession.status).toBe(401)
    expectPrivateResponseHeaders(staleSession)
    expect((await login()).response.status).toBe(401)
    expect((await login(
      'admin',
      'replacement admin password',
    )).response.status).toBe(200)

    const database = openDatabase(databaseFile)
    try {
      expect(database.sqlite.prepare(`
        SELECT session_version, version FROM users
      `).get()).toEqual({
        session_version: 2,
        version: 2,
      })
    }
    finally {
      database.sqlite.close()
    }
  }, 30_000)

  it('rejects a session as soon as the administrator becomes inactive', async () => {
    const authenticated = await login()
    const database = openDatabase(databaseFile)
    try {
      database.sqlite.prepare(`
        UPDATE users SET active = 0, updated_at = ?
      `).run(Date.now())
    }
    finally {
      database.sqlite.close()
    }

    const session = await fetch(`${adminBaseUrl}/api/auth/session`, {
      headers: { cookie: authenticated.cookie },
    })
    expect(session.status).toBe(401)
    expectPrivateResponseHeaders(session)
  }, 20_000)

  it('logs out through Origin and CSRF validation', async () => {
    const authenticated = await login()
    const logout = await fetch(`${adminBaseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: authenticated.cookie,
        origin: adminBaseUrl,
        'x-csrf-token': authenticated.body.data.csrfToken,
      },
    })

    expect(logout.status).toBe(200)
    expectPrivateResponseHeaders(logout)
    await expect(logout.json()).resolves.toEqual({
      data: {
        cleared: true,
      },
    })
    const staleSession = await fetch(
      `${adminBaseUrl}/api/auth/session`,
      {
        headers: { cookie: authenticated.cookie },
      },
    )
    expect(staleSession.status).toBe(401)
    expectPrivateResponseHeaders(staleSession)
  }, 20_000)
})

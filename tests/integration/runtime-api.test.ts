import { request } from 'node:http'
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
import { initializeAdmin } from '../../server/utils/service/auth'
import {
  migrateDatabase,
  openDatabase,
} from '../../server/utils/database'
import { ADMIN_WRITE_RATE_LIMIT, LOGIN_RATE_LIMIT } from '../../server/utils/route/request-rate-limit'
import { ADMIN_JSON_BODY_MAX_BYTES } from '../../server/utils/route/request-body'

const port = 3103
const publicBaseUrl = `http://127.0.0.1:${port}`
const adminBaseUrl = `http://localhost:${port}`
const mediaBaseUrl = `http://127.0.0.2:${port}`
const databaseFile = resolve(
  tmpdir(),
  `fur-forge-runtime-api-${process.pid}.db`,
)
const originalPassword = 'initial admin password'
const sessionSecret = 'test-session-secret-at-least-32-characters'
const officialChannels = (qq: string | null, qqGroup: string | null) => [
  { platform: 'qq', account: qq, qrCodeAssetId: null },
  { platform: 'qq_group', account: qqGroup, qrCodeAssetId: null },
]

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

// Host/error and authenticated API contracts share one built Nitro fixture.
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
    MEDIA_BASE_URL: mediaBaseUrl,
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

function requestWithHost(
  path: string,
  host: string,
  options: {
    body?: string
    headers?: Record<string, string>
    method?: string
  } = {},
) {
  return new Promise<{
    body: unknown
    retryAfter: string | undefined
    status: number
  }>((resolve, reject) => {
    const clientRequest = request({
      host: '127.0.0.1',
      port,
      path,
      method: options.method,
      headers: {
        ...options.headers,
        host,
      },
    }, (response) => {
      const chunks: Buffer[] = []

      response.on('data', chunk => chunks.push(Buffer.from(chunk)))
      response.on('end', () => {
        try {
          resolve({
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
            retryAfter: response.headers['retry-after'],
            status: response.statusCode ?? 0,
          })
        }
        catch (error) { reject(error) }
      })
    })

    clientRequest.on('error', reject)
    if (options.body) {
      const middle = Math.ceil(options.body.length / 2)
      clientRequest.write(options.body.slice(0, middle))
      clientRequest.end(options.body.slice(middle))
    }
    else {
      clientRequest.end()
    }
  })
}

describe('runtime request boundaries', () => {
  /**
   * T34-F6：liveness 只证明进程能响应，readiness 才检查数据库与迁移。
   * 两者必须区分：等待服务启动的探针（Playwright webServer、容器编排）用
   * liveness，否则数据库尚未迁移时会把"未就绪"误判为"启动失败"。
   */
  it('separates liveness from readiness and never leaks internals', async () => {
    const [live, ready, legacy, adminHealth] = await Promise.all([
      fetch(`${publicBaseUrl}/api/health/live`),
      fetch(`${publicBaseUrl}/api/health/ready`),
      fetch(`${publicBaseUrl}/api/health`),
      fetch(`${adminBaseUrl}/api/health`),
    ])

    // liveness 不触碰数据库，因此永远 200。
    expect(live.status).toBe(200)
    await expect(live.json()).resolves.toEqual({ status: 'live' })
    expect(live.headers.get('cache-control')).toBe('no-store')

    // 本套件的库已迁移，因此 readiness 与旧兼容端点都应为就绪。
    expect(ready.status).toBe(200)
    expect(legacy.status).toBe(200)
    expect(adminHealth.ok).toBe(true)
    await expect(legacy.json()).resolves.toEqual({ status: 'ok', service: 'project-fur-paws' })
    const readyBody = await ready.json() as {
      checks: Record<string, unknown>
      status: string
    }
    expect(readyBody.status).toBe('ready')
    // checks 只有布尔项，不含路径、SQL、表名或栈。
    expect(Object.values(readyBody.checks)
      .every(value => typeof value === 'boolean')).toBe(true)
    const serialized = JSON.stringify(readyBody)
    expect(serialized).not.toContain('studio.db')
    expect(serialized).not.toContain('SELECT')
    expect(serialized).not.toContain('__drizzle_migrations')
    expect(serialized).not.toMatch(/Error|at \w+ \(/u)
  })

  it('keeps page failures as HTML and API failures as JSON', async () => {
    const publicAdminResponse = await fetch(
      `${publicBaseUrl}/admin/login`,
      {
        headers: {
          accept: 'text/html',
        },
      },
    )
    const adminPublicResponse = await fetch(`${adminBaseUrl}/works`, {
      headers: {
        accept: 'text/html',
      },
    })
    const publicAdminApiResponse = await fetch(
      `${publicBaseUrl}/api/auth/login`,
    )

    expect(publicAdminResponse.status).toBe(404)
    expect(adminPublicResponse.status).toBe(404)
    expect(publicAdminResponse.headers.get('content-type')).toContain(
      'text/html',
    )
    expect(adminPublicResponse.headers.get('content-type')).toContain(
      'text/html',
    )
    expect(await publicAdminResponse.text()).toContain('<title>')
    expect(publicAdminApiResponse.status).toBe(404)
    expect(publicAdminApiResponse.headers.get('content-type')).toContain(
      'application/json',
    )
    await expect(publicAdminApiResponse.json()).resolves.toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource was not found.',
      },
    })
  })

  it('returns media-host failures without recursing into the HTML renderer', async () => {
    const mediaResponse = await requestWithHost(
      '/dev/web/missing.webp',
      new URL(mediaBaseUrl).host,
    )

    expect(mediaResponse.status).toBe(404)
    expect(mediaResponse.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource was not found.',
      },
    })
    expect((await fetch(`${publicBaseUrl}/api/health`)).status).toBe(200)
  })

  it('rejects oversized chunked login JSON while streaming', async () => {
    const response = await requestWithHost(
      '/api/auth/login',
      new URL(adminBaseUrl).host,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'origin': adminBaseUrl,
          'transfer-encoding': 'chunked',
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'x'.repeat(ADMIN_JSON_BODY_MAX_BYTES),
        }),
      },
    )

    expect(response.status).toBe(413)
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body is too large.',
      },
    })
  })

  it('rate limits login requests before password verification', async () => {
    let limited: Awaited<ReturnType<typeof requestWithHost>> | undefined

    for (let attempt = 0; attempt <= LOGIN_RATE_LIMIT; attempt += 1) {
      const response = await requestWithHost(
        '/api/auth/login',
        new URL(adminBaseUrl).host,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: adminBaseUrl,
          },
          body: '{}',
        },
      )
      if (response.status === 429) {
        limited = response
        break
      }
      expect(response.status).toBe(400)
    }

    expect(limited?.retryAfter).toMatch(/^\d+$/)
    expect(limited?.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again later.',
      },
    })
  })

  it('marks previews private without changing public SSR headers', async () => {
    const [preview, homepage] = await Promise.all([
      fetch(`${publicBaseUrl}/preview/work/missing`, {
        headers: { accept: 'text/html' },
      }),
      fetch(publicBaseUrl, {
        headers: { accept: 'text/html' },
      }),
    ])

    expect(preview.status).toBe(404)
    expect(preview.headers.get('cache-control')).toBe(
      'no-store, max-age=0',
    )
    expect(preview.headers.get('pragma')).toBe('no-cache')
    expect(preview.headers.get('x-robots-tag')).toBe(
      'noindex, nofollow, noarchive',
    )
    expect(homepage.status).toBe(200)
    expect(homepage.headers.get('x-robots-tag')).toBeNull()
    expect(homepage.headers.get('cache-control')).not.toBe(
      'no-store, max-age=0',
    )
  })

  it('renders page 404/500 HTML and keeps API 404/500 envelopes', async () => {
    const [pageNotFound, pageFailure, apiNotFound, apiFailure] =
      await Promise.all([
        fetch(`${publicBaseUrl}/works/not-exist`, {
          headers: { accept: 'text/html' },
        }),
        fetch(`${publicBaseUrl}/__test__/page-error`, {
          headers: { accept: 'text/html' },
        }),
        fetch(`${publicBaseUrl}/api/not-exist`),
        fetch(`${publicBaseUrl}/api/__test__/error`),
      ])

    expect(pageNotFound.status).toBe(404)
    expect(pageNotFound.headers.get('content-type')).toContain('text/html')
    const notFoundHtml = await pageNotFound.text()
    expect(notFoundHtml).toContain('<title>404 · 页面未找到')
    expect(notFoundHtml).toContain('访问的页面不存在、尚未发布或已经下架')

    expect(pageFailure.status).toBe(500)
    expect(pageFailure.headers.get('content-type')).toContain('text/html')
    const failureHtml = await pageFailure.text()
    expect(failureHtml).toContain('<title>500 · 页面暂时无法显示')
    expect(failureHtml).toContain('服务器暂时无法完成请求，请稍后重试')
    expect(failureHtml).not.toContain('test-contact@example.invalid')
    expect(failureHtml).not.toContain('prod/original/private.jpg')

    expect(apiNotFound.status).toBe(404)
    expect(apiNotFound.headers.get('content-type')).toContain(
      'application/json',
    )
    await expect(apiNotFound.json()).resolves.toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource was not found.',
      },
    })

    expect(apiFailure.status).toBe(500)
    expect(apiFailure.headers.get('content-type')).toContain(
      'application/json',
    )
    expect(apiFailure.headers.get('x-request-id')).toMatch(
      /^[A-Za-z0-9._:-]{8,128}$/,
    )
    const apiFailureBody = await apiFailure.json()
    expect(apiFailureBody).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error.',
      },
    })
    expect(JSON.stringify(apiFailureBody)).not.toContain(
      'test-contact@example.invalid',
    )
  })

  it('redirects the admin root and rejects unknown hosts', async () => {
    const redirectResponse = await fetch(adminBaseUrl, {
      redirect: 'manual',
    })
    const unknownHostResponse = await requestWithHost(
      '/api/health',
      `unknown.example:${port}`,
    )

    expect(redirectResponse.status).toBe(302)
    expect(redirectResponse.headers.get('location')).toBe('/admin/login')
    expect(unknownHostResponse.status).toBe(421)
    expect(unknownHostResponse.body).toEqual({
      error: {
        code: 'HOST_NOT_ALLOWED',
        message: 'Host is not allowed.',
      },
    })
  })
})

describe('authentication API', () => {
  beforeEach(async () => {
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
    // Auth cases start with clean limiters; requests within one case still accumulate.
    const reset = await fetch(`${adminBaseUrl}/api/e2e-fake-media-control`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'resetRateLimits' }),
    })
    expect(reset.status).toBe(200)
  })

  it('does not renew cookies for passive session checks', async () => {
    const { cookie } = await login()
    const headers = { cookie }
    const passive = await fetch(`${adminBaseUrl}/api/auth/session?touch=0`, { headers })
    expect(passive.status).toBe(200)
    expect(passive.headers.get('set-cookie')).toBeNull()
    const active = await fetch(`${adminBaseUrl}/api/auth/session`, { headers })
    expect(active.status).toBe(200)
    expect(active.headers.get('set-cookie')).not.toBeNull()

  })

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

    const database = openDatabase(databaseFile)
    try {
      // The service suite checks failure counts/expiry; this case checks HTTP error equivalence.
      database.sqlite.prepare('UPDATE users SET locked_until = ? WHERE username = ?')
        .run(Date.now() + 30 * 60_000, 'admin')
    }
    finally { database.sqlite.close() }
    const locked = await login()
    expect(locked.response.status).toBe(401)
    expectPrivateResponseHeaders(locked.response)
    expect(locked.body).toEqual(wrongPassword.body)
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

  it('applies T22 work schemas through authenticated no-store routes', async () => {
    const authenticated = await login()
    const suffix = crypto.randomUUID().replaceAll('-', '')
    const headers = {
      'content-type': 'application/json',
      cookie: authenticated.cookie,
      origin: adminBaseUrl,
      'x-csrf-token': authenticated.body.data.csrfToken,
    }
    const common = {
      characterName: '接口角色',
      species: '犬科',
      sortOrder: 2,
      featured: false,
    }
    const create = (payload: Record<string, unknown>) => fetch(
      `${adminBaseUrl}/api/admin/v1/works`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
    )

    for (const purpose of ['commission', 'showcase'] as const) {
      const response = await create({
        ...common,
        slug: `${purpose}-${suffix}`,
        purpose,
      })
      expect(response.status).toBe(201)
      expectPrivateResponseHeaders(response)
      await expect(response.json()).resolves.toMatchObject({
        data: { purpose, sortOrder: 0, featured: false, version: 1 },
      })
    }

    const adoptionResponse = await create({
      ...common,
      slug: `adoption-${suffix}`,
      purpose: 'adoption',
      adoptionStatus: 'available',
      priceCnyMinor: 1,
    })
    expect(adoptionResponse.status).toBe(201)
    expectPrivateResponseHeaders(adoptionResponse)
    const adoption = await adoptionResponse.json()
    expect(adoption).toMatchObject({
      data: {
        purpose: 'adoption',
        adoptionStatus: 'available',
        priceCnyMinor: 1,
        sortOrder: 0,
      },
    })

    const noPortraitFeatured = await create({
      ...common,
      featured: true,
      slug: `featured-without-photo-${suffix}`,
      purpose: 'showcase',
    })
    expect(noPortraitFeatured.status).toBe(409)
    await expect(noPortraitFeatured.json()).resolves.toMatchObject({
      error: { reason: 'FEATURED_PORTRAIT_PHOTO_REQUIRED' },
    })

    const invalid = await create({
      ...common,
      slug: `invalid-${suffix}`,
      purpose: 'showcase',
      adoptionStatus: 'available',
    })
    expect(invalid.status).toBe(400)
    expectPrivateResponseHeaders(invalid)
    await expect(invalid.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Work fields are invalid for the selected purpose.',
      },
    })

    const update = await fetch(
      `${adminBaseUrl}/api/admin/v1/works/${adoption.data.id}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          expectedVersion: 1,
          payload: {
            ...common,
            slug: `adoption-${suffix}`,
            purpose: 'showcase',
          },
        }),
      },
    )
    expect(update.status).toBe(200)
    expectPrivateResponseHeaders(update)
    await expect(update.json()).resolves.toMatchObject({
      data: { purpose: 'showcase', version: 2 },
    })

    const stale = await fetch(
      `${adminBaseUrl}/api/admin/v1/works/${adoption.data.id}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          expectedVersion: 1,
          payload: {
            ...common,
            slug: `adoption-${suffix}`,
            purpose: 'showcase',
          },
        }),
      },
    )
    expect(stale.status).toBe(409)
    expectPrivateResponseHeaders(stale)
  }, 30_000)

  it('secures versioned site content and refreshes safe public projections', async () => {
    const database = openDatabase(databaseFile)
    try {
      database.sqlite.transaction(() => {
        database.sqlite.prepare('DELETE FROM business_statuses').run()
        database.sqlite.prepare(`
          UPDATE site_content
          SET commission_intro = NULL,
              commission_estimate_note = NULL, commission_email_action = NULL,
              about_studio_facts = NULL,
              about_making_scope = NULL, basic_terms = NULL,
              privacy_policy = NULL,
              contact_anti_scam = NULL, version = 1
          WHERE id = 'site'
        `).run()
        database.sqlite.prepare(`
          INSERT INTO works (
            id, slug, character_name, species, purpose, publication_status,
            created_at, updated_at
          ) VALUES (?, ?, '隐私守卫', '犬科', 'showcase', 'draft', ?, ?)
        `).run(
          crypto.randomUUID(),
          `site-content-private-${crypto.randomUUID()}`,
          Date.now(),
          Date.now(),
        )
      })()
    }
    finally {
      database.sqlite.close()
    }

    const authenticated = await login()
    const headers = {
      'content-type': 'application/json',
      cookie: authenticated.cookie,
      origin: adminBaseUrl,
      'x-csrf-token': authenticated.body.data.csrfToken as string,
    }
    const adminContentUrl = `${adminBaseUrl}/api/admin/v1/site/home/content`
    // T34-F3：写入按分区拆分，读取仍是同一个聚合 GET。
    const sectionUrl = (section: string) =>
      `${adminBaseUrl}/api/admin/v1/site/home/content/${section}`
    const content = await fetch(adminContentUrl, {
      headers: { cookie: authenticated.cookie },
    })
    expect(content.status).toBe(200)
    expectPrivateResponseHeaders(content)
    const initial = await content.json()
    const initialSectionVersions = initial.data.sectionVersions as {
      about: number
      commission: number
      contact: number
      privacy: number
      terms: number
    }
    expect(initial).toMatchObject({
      data: {
        version: 1,
        sectionVersions: {
          commission: expect.any(Number),
          about: expect.any(Number),
          terms: expect.any(Number),
          privacy: expect.any(Number),
          contact: expect.any(Number),
        },
        statuses: { commission: null },
        commission: {
          intro: null,
          estimateNote: null,
          emailAction: null,
        },
        about: {
          studioFacts: null,
          makingScope: null,
          basicTerms: null,
          privacyPolicy: null,
        },
        contact: {
          email: '765678159@qq.com',
          officialChannels: officialChannels('765678159', '1040925427'),
        },
      },
    })
    expect(Object.values(initialSectionVersions).every(version => version > 0))
      .toBe(true)

    const publicHostAdmin = await fetch(
      `${publicBaseUrl}/api/admin/v1/site/home/content`,
    )
    const adminHostPublic = await fetch(
      `${adminBaseUrl}/api/public/v1/site-content`,
    )
    expect(publicHostAdmin.status).toBe(404)
    expect(adminHostPublic.status).toBe(404)

    const commissionPayload = {
      intro: '委托说明由工作室确认后填写。',
      estimateNote: '每件作品通过邮件人工估价。',
      emailAction: '发送邮件或复制业务邮箱。',
    }
    const privacyPayload = {
      privacyPolicy: '本站不提供访客账号，不使用营销分析 Cookie。',
    }
    // 需求3阶段 A：邮箱与 QQ/QQ群数组在同一个 contact 分区里编辑。
    const contactPayload = {
      email: 'studio@example.test',
      officialChannels: officialChannels('3114559925', '456789012'),
    }
    const missingCsrf = await fetch(sectionUrl('commission'), {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie: authenticated.cookie,
        origin: adminBaseUrl,
      },
      body: JSON.stringify({
        expectedVersion: initialSectionVersions.commission,
        payload: commissionPayload,
      }),
    })
    const wrongOrigin = await fetch(sectionUrl('commission'), {
      method: 'PUT',
      headers: { ...headers, origin: publicBaseUrl },
      body: JSON.stringify({
        expectedVersion: initialSectionVersions.commission,
        payload: commissionPayload,
      }),
    })
    // 分区写入端点同样不接受公开 Host。
    const publicHostSection = await fetch(
      `${publicBaseUrl}/api/admin/v1/site/home/content/commission`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: initialSectionVersions.commission,
          payload: commissionPayload,
        }),
      },
    )
    expect(publicHostSection.status).toBe(404)
    expect(missingCsrf.status).toBe(403)
    expect(wrongOrigin.status).toBe(403)
    expectPrivateResponseHeaders(missingCsrf)
    expectPrivateResponseHeaders(wrongOrigin)

    const invalidContent = await fetch(sectionUrl('commission'), {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        expectedVersion: initialSectionVersions.commission,
        payload: { ...commissionPayload, intro: '<script>x</script>' },
      }),
    })
    const invalidContact = await fetch(sectionUrl('contact'), {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        expectedVersion: initialSectionVersions.contact,
        payload: {
          ...contactPayload,
          officialChannels: officialChannels('3114559925', '@bad handle'),
        },
      }),
    })
    expect(invalidContent.status).toBe(400)
    expect(invalidContact.status).toBe(400)

    const putSection = (
      section: string,
      expectedVersion: number,
      payload: unknown,
    ) => fetch(sectionUrl(section), {
      method: 'PUT',
      headers,
      body: JSON.stringify({ expectedVersion, payload }),
    })

    const updatedContent = await putSection(
      'commission',
      initialSectionVersions.commission,
      commissionPayload,
    )
    expect(updatedContent.status).toBe(200)
    expectPrivateResponseHeaders(updatedContent)
    await expect(updatedContent.json()).resolves.toMatchObject({
      data: {
        sectionVersions: {
          commission: initialSectionVersions.commission + 1,
          about: initialSectionVersions.about,
        },
        commission: commissionPayload,
      },
    })

    // 不同分区各自保存都成功，且只推进自己的版本。
    expect((await putSection('commission-faq', 1, { faqs: [] })).status).toBe(404)
    expect((await putSection(
      'privacy',
      initialSectionVersions.privacy,
      privacyPayload,
    )).status).toBe(200)
    expect((await putSection(
      'contact',
      initialSectionVersions.contact,
      contactPayload,
    )).status).toBe(200)
    // 同一分区用旧版本再保存拿到 409。
    expect((await putSection(
      'commission',
      initialSectionVersions.commission,
      commissionPayload,
    )).status).toBe(409)

    const payload = {
      commission: commissionPayload,
      about: {
        studioFacts: null,
        makingScope: null,
        basicTerms: null,
        privacyPolicy: privacyPayload.privacyPolicy,
      },
      contact: contactPayload,
    }

    const updateStatus = (
      kind: 'commission' | 'adoption',
      expectedVersion: number,
      tone: 'open' | 'closed',
      label: string,
    ) => fetch(
      `${adminBaseUrl}/api/admin/v1/site/home/business-statuses/${kind}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          expectedVersion,
          payload: { tone, label },
        }),
      },
    )
    expect((await updateStatus('commission', 0, 'open', '接受委托中')).status)
      .toBe(200)
    const adoption = await updateStatus('adoption', 0, 'open', '领养开放')
    expect(adoption.status).toBe(400)
    expect((await updateStatus('commission', 0, 'closed', '陈旧更新')).status)
      .toBe(409)

    const firstPublic = await fetch(`${publicBaseUrl}/api/public/v1/site-content`)
    expect(firstPublic.status).toBe(200)
    expect(firstPublic.headers.get('cache-control')).toBe('no-store')
    const firstProjection = await firstPublic.json()
    expect(firstProjection).toMatchObject({
      data: {
        statuses: {
          commission: { tone: 'open', href: '/commission' },
        },
        commission: {
          ...payload.commission,
          // contact 分区保存后，公开投影里的邮箱随之更新。
          email: contactPayload.email,
          termsHref: '/service',
        },
        about: {
          studioFacts: null,
          makingScope: null,
          basicTerms: null,
          privacyPolicy: payload.about.privacyPolicy,
          // T03：只有账号与 READY 二维码派生同时存在才进入公开投影。
          officialChannels: [],
        },
      },
    })
    expect(JSON.stringify(firstProjection)).not.toContain('version')

    expect((await updateStatus('commission', 1, 'closed', '委托关闭')).status)
      .toBe(200)
    const refreshed = await fetch(`${publicBaseUrl}/api/public/v1/site-content`)
    await expect(refreshed.json()).resolves.toMatchObject({
      data: {
        statuses: {
          commission: { tone: 'closed', label: '委托关闭' },
        },
      },
    })
  }, 30_000)

  it('rate limits authenticated admin writes', async () => {
    const authenticated = await login()
    expect(authenticated.response.status).toBe(200)
    let limited: Response | undefined

    for (let attempt = 0; attempt <= ADMIN_WRITE_RATE_LIMIT; attempt += 1) {
      const response = await fetch(`${adminBaseUrl}/api/admin/v1/works`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: authenticated.cookie,
          origin: adminBaseUrl,
          'x-csrf-token': authenticated.body.data.csrfToken,
        },
        body: '{}',
      })
      if (response.status === 429) {
        limited = response
        break
      }
      expect(response.status).toBe(400)
    }

    expect(limited).toBeDefined()
    expectPrivateResponseHeaders(limited!)
    expect(limited!.headers.get('retry-after')).toMatch(/^\d+$/)
    await expect(limited!.json()).resolves.toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again later.',
      },
    })
  }, 30_000)
})

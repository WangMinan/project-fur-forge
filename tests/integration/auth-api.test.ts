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
import { ADMIN_WRITE_RATE_LIMIT } from '../../server/utils/route/request-rate-limit'

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
      suitType: 'full',
      ownerDisplay: '公开角色主',
      ownerContact: 'private-contact',
      featureTags: ['柔软', '大尾巴'],
      sortOrder: 2,
      featured: true,
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
        data: { purpose, sortOrder: 2, featured: true, version: 1 },
      })
    }

    const adoptionResponse = await create({
      ...common,
      slug: `adoption-${suffix}`,
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      priceCnyMinor: 1,
    })
    expect(adoptionResponse.status).toBe(201)
    expectPrivateResponseHeaders(adoptionResponse)
    const adoption = await adoptionResponse.json()
    expect(adoption).toMatchObject({
      data: {
        purpose: 'adoption',
        adoptionMethod: 'regular',
        businessStatus: 'available',
        priceCnyMinor: 1,
        private: { ownerContact: 'private-contact' },
      },
    })

    const invalid = await create({
      ...common,
      slug: `invalid-${suffix}`,
      purpose: 'showcase',
      adoptionMethod: 'regular',
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
    const privateContact = 'owner-private-site-content@example.test'
    const database = openDatabase(databaseFile)
    try {
      database.sqlite.transaction(() => {
        database.sqlite.prepare('DELETE FROM business_statuses').run()
        database.sqlite.prepare(`
          UPDATE site_content
          SET contact_douyin = 'to3114559925', commission_intro = NULL,
              commission_estimate_note = NULL, commission_email_action = NULL,
              commission_faq_json = NULL, about_studio_facts = NULL,
              about_making_scope = NULL, basic_terms = NULL,
              privacy_policy = NULL,
              contact_anti_scam = NULL, version = 1
          WHERE id = 'site'
        `).run()
        database.sqlite.prepare(`
          INSERT INTO works (
            id, slug, character_name, species, suit_type, purpose,
            owner_display, owner_contact, publication_status,
            created_at, updated_at
          ) VALUES (?, ?, '隐私守卫', '犬科', 'full', 'showcase',
            '不公开', ?, 'draft', ?, ?)
        `).run(
          crypto.randomUUID(),
          `site-content-private-${crypto.randomUUID()}`,
          privateContact,
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
    expect(initial).toMatchObject({
      data: {
        version: 1,
        sectionVersions: {
          commission: 1,
          commissionFaq: 1,
          about: 1,
          terms: 1,
          privacy: 1,
          contact: 1,
        },
        statuses: { commission: null, adoption: null },
        commission: {
          intro: null,
          estimateNote: null,
          emailAction: null,
          faqs: [],
        },
        about: {
          studioFacts: null,
          makingScope: null,
          basicTerms: null,
          privacyPolicy: null,
        },
        contact: {
          email: '3114559925@qq.com',
          qq: '3114559925',
          douyin: 'to3114559925',
          antiScam: null,
        },
      },
    })

    const publicHostAdmin = await fetch(
      `${publicBaseUrl}/api/admin/v1/site/home/content`,
    )
    const adminHostPublic = await fetch(
      `${adminBaseUrl}/api/public/v1/site-content`,
    )
    expect(publicHostAdmin.status).toBe(404)
    expect(adminHostPublic.status).toBe(404)

    const FAQ_ID = '33333333-3333-4333-8333-333333333333'
    const commissionPayload = {
      intro: '委托说明由工作室确认后填写。',
      estimateNote: '每件作品通过邮件人工估价。',
      emailAction: '发送邮件或复制业务邮箱。',
    }
    const faqPayload = {
      faqs: [{ id: FAQ_ID, question: '如何估价？', answer: '通过业务邮箱逐件沟通。' }],
    }
    const privacyPayload = {
      privacyPolicy: '本站不提供访客账号，不使用营销分析 Cookie。',
    }
    // T34-F3：邮箱与 QQ 也在 contact 分区里编辑。
    const contactPayload = {
      email: 'studio@example.test',
      qq: '3114559925',
      douyin: 'to3114559925',
      antiScam: null,
    }
    const missingCsrf = await fetch(sectionUrl('commission'), {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie: authenticated.cookie,
        origin: adminBaseUrl,
      },
      body: JSON.stringify({ expectedVersion: 1, payload: commissionPayload }),
    })
    const wrongOrigin = await fetch(sectionUrl('commission'), {
      method: 'PUT',
      headers: { ...headers, origin: publicBaseUrl },
      body: JSON.stringify({ expectedVersion: 1, payload: commissionPayload }),
    })
    // 分区写入端点同样不接受公开 Host。
    const publicHostSection = await fetch(
      `${publicBaseUrl}/api/admin/v1/site/home/content/commission`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: 1, payload: commissionPayload }),
      },
    )
    expect(publicHostSection.status).toBe(404)
    expect(missingCsrf.status).toBe(403)
    expect(wrongOrigin.status).toBe(403)
    expectPrivateResponseHeaders(missingCsrf)
    expectPrivateResponseHeaders(wrongOrigin)

    const invalidChannels = await fetch(
      `${adminBaseUrl}/api/admin/v1/site/home/settings`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          expectedVersion: 1,
          payload: {
            tagline: '不只做小狗毛',
            // 首屏设置不再接受官方邮箱与 QQ：strict 拒绝旧字段。
            contactEmail: 'studio@example.test',
            contactQq: '3114559925',
            autoRotate: false,
            autoRotateIntervalMs: 6000,
          },
        }),
      },
    )
    const invalidContent = await fetch(sectionUrl('commission'), {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        expectedVersion: 1,
        payload: { ...commissionPayload, intro: '<script>x</script>' },
      }),
    })
    const invalidContact = await fetch(sectionUrl('contact'), {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        expectedVersion: 1,
        payload: { ...contactPayload, douyin: '@bad handle' },
      }),
    })
    expect(invalidChannels.status).toBe(400)
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

    const updatedContent = await putSection('commission', 1, commissionPayload)
    expect(updatedContent.status).toBe(200)
    expectPrivateResponseHeaders(updatedContent)
    await expect(updatedContent.json()).resolves.toMatchObject({
      data: {
        sectionVersions: { commission: 2, commissionFaq: 1, about: 1 },
        commission: commissionPayload,
      },
    })

    // 不同分区各自保存都成功，且只推进自己的版本。
    expect((await putSection('commission-faq', 1, faqPayload)).status).toBe(200)
    expect((await putSection('privacy', 1, privacyPayload)).status).toBe(200)
    expect((await putSection('contact', 1, contactPayload)).status).toBe(200)
    // 同一分区用旧版本再保存拿到 409。
    expect((await putSection('commission', 1, commissionPayload)).status).toBe(409)

    const payload = {
      commission: { ...commissionPayload, faqs: faqPayload.faqs },
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
      tone: 'open' | 'limited' | 'closed',
      label: string,
    ) => fetch(
      `${adminBaseUrl}/api/admin/v1/site/home/business-statuses/${kind}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          expectedVersion,
          payload: { tone, label, detail: `${label}的公开说明。` },
        }),
      },
    )
    expect((await updateStatus('commission', 0, 'limited', '委托有限开放')).status)
      .toBe(200)
    const adoption = await updateStatus('adoption', 0, 'open', '领养开放')
    expect(adoption.status).toBe(200)
    await expect(adoption.json()).resolves.toMatchObject({
      data: {
        // T34-F3：文案与营业状态各自独立版本；全局 site_content.version 不再随文案推进。
        version: 1,
        statuses: {
          commission: { version: 1, tone: 'limited' },
          adoption: { version: 1, tone: 'open' },
        },
      },
    })
    expect((await updateStatus('commission', 0, 'closed', '陈旧更新')).status)
      .toBe(409)

    const firstPublic = await fetch(`${publicBaseUrl}/api/public/v1/site-content`)
    expect(firstPublic.status).toBe(200)
    expect(firstPublic.headers.get('cache-control')).toBe('no-store')
    const firstProjection = await firstPublic.json()
    expect(firstProjection).toMatchObject({
      data: {
        statuses: {
          commission: { tone: 'limited', href: '/commission' },
          adoption: { tone: 'open', href: '/adoptions' },
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
          officialChannels: {
            email: contactPayload.email,
            qq: contactPayload.qq,
            douyin: contactPayload.douyin,
          },
        },
      },
    })
    expect(JSON.stringify(firstProjection)).not.toContain('version')
    expect(JSON.stringify(firstProjection)).not.toContain(privateContact)

    expect((await updateStatus('commission', 1, 'closed', '委托关闭')).status)
      .toBe(200)
    const refreshed = await fetch(`${publicBaseUrl}/api/public/v1/site-content`)
    await expect(refreshed.json()).resolves.toMatchObject({
      data: {
        statuses: {
          commission: { tone: 'closed', label: '委托关闭' },
          adoption: { tone: 'open', label: '领养开放' },
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

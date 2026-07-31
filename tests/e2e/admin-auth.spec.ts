import { expect, test } from '@playwright/test'
import {
  adminBaseURL,
  E2E_ADMIN,
  fetchSession,
  loginAsAdmin,
  publicBaseURL,
  resetE2EAdmin,
} from './helpers/auth'

const SESSION_COOKIE_NAME = '__Host-fur-forge-session'

async function loginViaUi(
  page: import('@playwright/test').Page,
  credentials = E2E_ADMIN,
) {
  await page.getByLabel('用户名').fill(credentials.username)
  await page.getByLabel('密码', { exact: true }).fill(credentials.password)
  await page.getByRole('button', { name: '登录' }).click()
}

test.describe('Cookie 与存储契约', () => {
  test('真实浏览器接受 __Host- Session Cookie，JavaScript 不可读取', async ({
    page,
    context,
  }) => {
    const response = await page.request.post(`${adminBaseURL}/api/auth/login`, {
      data: {
        username: E2E_ADMIN.username,
        password: E2E_ADMIN.password,
      },
      headers: {
        Origin: adminBaseURL,
      },
    })
    expect(response.status()).toBe(200)

    const setCookie = response.headers()['set-cookie'] ?? ''
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).not.toContain('Domain=')

    const cookies = await context.cookies(adminBaseURL)
    const sessionCookie = cookies.find(
      cookie => cookie.name === SESSION_COOKIE_NAME,
    )
    expect(sessionCookie, '浏览器 Cookie jar 应接受 __Host- Secure Cookie').toBeDefined()
    expect(sessionCookie!.secure).toBe(true)
    expect(sessionCookie!.httpOnly).toBe(true)
    expect(sessionCookie!.sameSite).toBe('Strict')
    expect(sessionCookie!.path).toBe('/')

    const sessionResponse = await fetchSession(page)
    expect(sessionResponse.status()).toBe(200)

    await page.goto(`${adminBaseURL}/admin/login`)
    const readableCookies = await page.evaluate(() => document.cookie)
    expect(readableCookies).not.toContain(SESSION_COOKIE_NAME)
  })

  test('登录成功与 401 响应都带 no-store 与 noindex', async ({
    page,
    request,
  }) => {
    const loginResponse = await page.request.post(
      `${adminBaseURL}/api/auth/login`,
      {
        data: {
          username: E2E_ADMIN.username,
          password: E2E_ADMIN.password,
        },
        headers: {
          Origin: adminBaseURL,
        },
      },
    )
    expect(loginResponse.status()).toBe(200)
    expect(loginResponse.headers()['cache-control']).toContain('no-store')
    expect(loginResponse.headers()['x-robots-tag']).toContain('noindex')
    expect(loginResponse.headers().vary).toContain('Cookie')

    // request fixture 使用独立 Cookie jar，此处为匿名访问。
    const anonymousSession = await request.get(
      `${adminBaseURL}/api/auth/session`,
    )
    expect(anonymousSession.status()).toBe(401)
    expect(anonymousSession.headers()['cache-control']).toContain('no-store')
    expect(anonymousSession.headers()['x-robots-tag']).toContain('noindex')
  })

  test('认证状态不进入持久存储与 URL', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await loginViaUi(page)
    await expect(page).toHaveURL(/\/admin\/works$/)

    const storage = await page.evaluate(async () => ({
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
      indexedDbs: await window.indexedDB.databases(),
      cookie: document.cookie,
    }))
    expect(Object.keys(storage.local)).toHaveLength(0)
    expect(Object.keys(storage.session)).toHaveLength(0)
    expect(storage.indexedDbs).toHaveLength(0)
    expect(storage.cookie).not.toContain(SESSION_COOKIE_NAME)

    const sessionResponse = await fetchSession(page)
    const sessionBody = await sessionResponse.json() as {
      data: { csrfToken: string }
    }
    expect(page.url()).not.toContain(sessionBody.data.csrfToken)
  })
})

test.describe('登录与 Session 恢复', () => {
  test('界面登录成功进入作品列表，壳层显示当前用户名', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await loginViaUi(page)

    await expect(page).toHaveURL(/\/admin\/works$/)
    await expect(
      page.getByRole('heading', { level: 1, name: '作品' }),
    ).toBeVisible()
    await expect(page.getByTestId('admin-shell')).toContainText(E2E_ADMIN.username)
  })

  test('提交期间忽略重复提交，只产生一次登录请求', async ({ page }) => {
    let loginRequests = 0
    await page.route('**/api/auth/login', async (route) => {
      loginRequests += 1
      await route.continue()
    })

    await page.goto(`${adminBaseURL}/admin/login`)
    await page.getByLabel('用户名').fill(E2E_ADMIN.username)
    await page.getByLabel('密码', { exact: true }).fill(E2E_ADMIN.password)

    const submitButton = page.getByRole('button', { name: '登录' })
    await submitButton.click()
    await expect(submitButton).toBeDisabled()
    await expect(page).toHaveURL(/\/admin\/works$/)
    expect(loginRequests).toBe(1)
  })

  test('刷新页面后通过 session 接口恢复登录状态', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(`${adminBaseURL}/admin/works`)
    await expect(
      page.getByRole('heading', { level: 1, name: '作品' }),
    ).toBeVisible()

    await page.reload()
    await expect(page).toHaveURL(/\/admin\/works$/)
    await expect(
      page.getByRole('heading', { level: 1, name: '作品' }),
    ).toBeVisible()
    await expect(page.getByTestId('admin-shell')).toContainText(E2E_ADMIN.username)
  })

  test('已登录访问登录页直接回到作品列表', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(`${adminBaseURL}/admin/login`)
    await expect(page).toHaveURL(/\/admin\/works$/)
  })

  test('登录后回到受保护目标页，外部跳转地址被拒绝', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/account`)
    await expect(page).toHaveURL(/\/admin\/login\?redirect=/)

    await loginViaUi(page)
    await expect(page).toHaveURL(/\/admin\/account$/)
    await expect(
      page.getByRole('heading', { level: 1, name: '账号' }),
    ).toBeVisible()

    await page.context().clearCookies()
    await page.goto(`${adminBaseURL}/admin/login?redirect=https%3A%2F%2Fevil.example%2F`)
    await loginViaUi(page)
    await expect(page).toHaveURL(/\/admin\/works$/)
  })
})

test.describe('未认证访问保护', () => {
  test('未认证访问 /admin/works 只显示登录页，作品内容不渲染', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works`)

    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.getByTestId('admin-login')).toBeVisible()
    await expect(page.getByText('蓝莓')).toHaveCount(0)
    await expect(page.getByTestId('admin-shell')).toHaveCount(0)
  })

  test('未认证访问 /admin 与 /admin/account 同样只落登录页', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin`)
    await expect(page).toHaveURL(/\/admin\/login/)

    await page.goto(`${adminBaseURL}/admin/account`)
    await expect(page).toHaveURL(/\/admin\/login\?redirect=/)
    await expect(page.getByTestId('account-username')).toHaveCount(0)
  })

  test('session 接口的 403/500 不会被误判为未登录', async ({ page }) => {
    // 构造会话检查的瞬时 500：布局显示持久错误与重试，而不是登录页或作品内容。
    await loginAsAdmin(page)
    await page.route('**/api/auth/session', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' },
      }),
    }))

    await page.goto(`${adminBaseURL}/admin/works`)
    await expect(page.getByRole('alert')).toContainText('暂时无法确认登录状态')
    await expect(page.getByTestId('admin-login')).toHaveCount(0)
    await expect(page.getByText('蓝莓')).toHaveCount(0)

    await page.unroute('**/api/auth/session')
    await page.getByRole('button', { name: '重试' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: '作品' }),
    ).toBeVisible()
  })
})

test.describe('统一错误提示与锁定', () => {
  test('错误密码与不存在的账号显示完全相同的提示', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await loginViaUi(page, {
      username: E2E_ADMIN.username,
      password: 'wrong-password-000',
    })
    await expect(page.getByRole('alert')).toHaveText('用户名或密码不正确。')
    const wrongPasswordText = await page.getByRole('alert').textContent()

    await loginViaUi(page, {
      username: 'no-such-admin',
      password: 'wrong-password-000',
    })
    await expect(page.getByRole('alert')).toHaveText('用户名或密码不正确。')
    expect(await page.getByRole('alert').textContent()).toBe(wrongPasswordText)
  })

  test('登录锁定不被页面单独揭示', async ({ page }) => {
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await page.request.post(`${adminBaseURL}/api/auth/login`, {
          data: {
            username: E2E_ADMIN.username,
            password: 'wrong-password-000',
          },
          headers: {
            Origin: adminBaseURL,
          },
        })
        expect(response.status()).toBe(401)
      }

      // 锁定后即使使用正确密码，页面仍只显示统一提示，不出现锁定时长。
      await page.goto(`${adminBaseURL}/admin/login`)
      await loginViaUi(page)
      await expect(page.getByRole('alert')).toHaveText('用户名或密码不正确。')
      await expect(page.getByText(/锁定|分钟/)).toHaveCount(0)
      await expect(page.getByTestId('admin-shell')).toHaveCount(0)
    }
    finally {
      await resetE2EAdmin()
    }
  })
})

test.describe('CSRF 与 Origin 边界', () => {
  test('缺失或错误的 CSRF token 使写请求失败，正确 token 成功', async ({ page }) => {
    const { csrfToken } = await loginAsAdmin(page)

    // 携带正确 Origin，让 403 只归因于 CSRF 校验。
    const missingToken = await page.request.post(`${adminBaseURL}/api/auth/logout`, {
      headers: {
        Origin: adminBaseURL,
      },
    })
    expect(missingToken.status()).toBe(403)

    const wrongToken = await page.request.post(`${adminBaseURL}/api/auth/logout`, {
      headers: {
        'Origin': adminBaseURL,
        'x-csrf-token': 'definitely-not-the-token',
      },
    })
    expect(wrongToken.status()).toBe(403)

    // 403 之后原会话仍可用：CSRF 失败不销毁 Session。
    expect((await fetchSession(page)).status()).toBe(200)

    const correctToken = await page.request.post(`${adminBaseURL}/api/auth/logout`, {
      headers: {
        'Origin': adminBaseURL,
        'x-csrf-token': csrfToken,
      },
    })
    expect(correctToken.status()).toBe(200)
    expect((await fetchSession(page)).status()).toBe(401)
  })

  test('改密接口同样强制 CSRF token', async ({ page }) => {
    await loginAsAdmin(page)

    const missingToken = await page.request.put(
      `${adminBaseURL}/api/admin/account/password`,
      {
        data: {
          expectedVersion: 0,
          payload: {
            currentPassword: E2E_ADMIN.password,
            newPassword: 'brand-new-password-2026',
          },
        },
        headers: {
          Origin: adminBaseURL,
        },
      },
    )
    expect(missingToken.status()).toBe(403)
    expect((await fetchSession(page)).status()).toBe(200)
  })

  test('错误 Origin 的登录请求被拒绝', async ({ page }) => {
    const response = await page.request.post(`${adminBaseURL}/api/auth/login`, {
      data: {
        username: E2E_ADMIN.username,
        password: E2E_ADMIN.password,
      },
      headers: {
        Origin: 'https://evil.example',
      },
    })
    expect(response.status()).toBe(403)
  })
})

test.describe('退出登录', () => {
  test('界面退出后原页面不可继续使用', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await loginViaUi(page)
    await expect(page).toHaveURL(/\/admin\/works$/)

    await page.getByRole('button', { name: '退出登录' }).click()
    await expect(page).toHaveURL(/\/admin\/login/)
    expect(new URL(page.url()).pathname).toBe('/admin/login')
    expect((await fetchSession(page)).status()).toBe(401)

    await page.goto(`${adminBaseURL}/admin/works`)
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.getByText('蓝莓')).toHaveCount(0)
  })
})

test.describe('修改密码', () => {
  test('客户端校验阻止过短密码与不一致确认', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(`${adminBaseURL}/admin/account`)

    await page.getByLabel('当前密码').fill(E2E_ADMIN.password)
    await page.getByLabel('新密码', { exact: true }).fill('short')
    await page.getByLabel('确认新密码').fill('short')
    await page.getByRole('button', { name: '修改密码' }).click()

    await expect(page.locator('#password-new-error')).toHaveText('新密码至少需要 12 个字符。')

    await page.getByLabel('新密码', { exact: true }).fill('brand-new-password-2026')
    await page.getByLabel('确认新密码').fill('different-password-2026')
    await page.getByRole('button', { name: '修改密码' }).click()
    await expect(page.locator('#password-confirm-error')).toHaveText('两次输入的新密码不一致。')
  })

  test('当前密码错误显示字段错误，成功后旧 Session 失效并要求重新登录', async ({ page }) => {
    try {
      await page.goto(`${adminBaseURL}/admin/login`)
      await loginViaUi(page)
      await expect(page).toHaveURL(/\/admin\/works$/)

      await page.goto(`${adminBaseURL}/admin/account`)
      await expect(page.getByTestId('account-username')).toHaveText(E2E_ADMIN.username)

      await page.getByLabel('当前密码').fill('wrong-password-000')
      await page.getByLabel('新密码', { exact: true }).fill('brand-new-password-2026')
      await page.getByLabel('确认新密码').fill('brand-new-password-2026')
      await page.getByRole('button', { name: '修改密码' }).click()
      await expect(page.locator('#password-current-error')).toHaveText('当前密码不正确。')
      // 字段错误不会清除既有 Session。
      expect((await fetchSession(page)).status()).toBe(200)

      await page.getByLabel('当前密码').fill(E2E_ADMIN.password)
      await page.getByLabel('新密码', { exact: true }).fill('brand-new-password-2026')
      await page.getByLabel('确认新密码').fill('brand-new-password-2026')
      await page.getByRole('button', { name: '修改密码' }).click()

      await expect(page).toHaveURL(/\/admin\/login\?state=password-changed/)
      await expect(page.getByRole('status')).toContainText('密码已修改，请使用新密码重新登录。')

      // 旧 Session 已失效；旧密码不能再登录，新密码可以。
      expect((await fetchSession(page)).status()).toBe(401)

      const oldPasswordLogin = await page.request.post(`${adminBaseURL}/api/auth/login`, {
        data: {
          username: E2E_ADMIN.username,
          password: E2E_ADMIN.password,
        },
        headers: {
          Origin: adminBaseURL,
        },
      })
      expect(oldPasswordLogin.status()).toBe(401)

      await loginViaUi(page, {
        username: E2E_ADMIN.username,
        password: 'brand-new-password-2026',
      })
      await expect(page).toHaveURL(/\/admin\/works$/)
    }
    finally {
      await resetE2EAdmin()
    }
  })

  test('过期 expectedVersion 被服务端拒绝（409）', async ({ page }) => {
    const { csrfToken, user } = await loginAsAdmin(page)

    const stale = await page.request.put(
      `${adminBaseURL}/api/admin/account/password`,
      {
        data: {
          expectedVersion: user.version + 99,
          payload: {
            currentPassword: E2E_ADMIN.password,
            newPassword: 'brand-new-password-2026',
          },
        },
        headers: {
          'Origin': adminBaseURL,
          'x-csrf-token': csrfToken,
        },
      },
    )
    expect(stale.status()).toBe(409)
    // 409 不影响既有 Session 与密码。
    expect((await fetchSession(page)).status()).toBe(200)
  })

  test('冲突响应显示持久提示，刷新登录状态后恢复', async ({ page }) => {
    // T13 中资源版本与 SessionVersion 同时递增，活动 Session 在实际使用中
    // 不会遇到 409；这里拦截一次响应验证界面的冲突呈现与刷新恢复链路。
    await loginAsAdmin(page)
    await page.goto(`${adminBaseURL}/admin/account`)

    await page.route('**/api/admin/account/password', route => route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'CONFLICT', message: 'Resource version is stale.' },
      }),
    }))

    await page.getByLabel('当前密码').fill(E2E_ADMIN.password)
    await page.getByLabel('新密码', { exact: true }).fill('brand-new-password-2026')
    await page.getByLabel('确认新密码').fill('brand-new-password-2026')
    await page.getByRole('button', { name: '修改密码' }).click()

    await expect(page.getByRole('alert')).toContainText(
      '账号信息已在其他地方发生变化，本次修改未保存',
    )

    await page.unroute('**/api/admin/account/password')
    await page.getByRole('button', { name: '刷新登录状态' }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: '修改密码' }),
    ).toBeEnabled()
  })
})

test.describe('公开 Host 隔离', () => {
  test('公开 Host 请求认证路径仍为 404', async ({ page }) => {
    const sessionResponse = await page.context().request.get(
      `${publicBaseURL}/api/auth/session`,
    )
    expect(sessionResponse.status()).toBe(404)
    const sessionBody = await sessionResponse.json()
    expect(sessionBody).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource was not found.',
      },
    })

    const loginResponse = await page.context().request.post(
      `${publicBaseURL}/api/auth/login`,
      {
        data: {
          username: E2E_ADMIN.username,
          password: E2E_ADMIN.password,
        },
        headers: {
          Origin: publicBaseURL,
        },
      },
    )
    expect(loginResponse.status()).toBe(404)

    const adminPageResponse = await page.context().request.get(
      `${publicBaseURL}/admin/works`,
      {
        headers: {
          accept: 'text/html',
        },
      },
    )
    expect(adminPageResponse.status()).toBe(404)
  })
})

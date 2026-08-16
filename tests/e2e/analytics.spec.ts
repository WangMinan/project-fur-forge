import { expect, test } from '@playwright/test'
import {
  adminBaseURL,
  E2E_DATABASE_FILE,
  loginAsAdmin,
  publicBaseURL,
} from './helpers/auth'
import { openFixtureDatabase } from './helpers/fixture-db'

const SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function clearAnalytics() {
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
  try {
    sqlite.prepare('DELETE FROM analytics_events').run()
  }
  finally {
    sqlite.close()
  }
}

test.beforeEach(() => {
  clearAnalytics()
})

test('public navigation records a minimal event and a failed collector stays invisible', async ({ page }) => {
  const requestPromise = page.waitForRequest(request =>
    request.url().endsWith('/api/public/v1/analytics/events'),
  )
  const responsePromise = page.waitForResponse(response =>
    response.url().endsWith('/api/public/v1/analytics/events'),
  )
  await page.goto('/')
  const analyticsRequest = await requestPromise
  const analyticsResponse = await responsePromise
  const body = analyticsRequest.postDataJSON() as Record<string, unknown>

  expect(body).toEqual({
    eventType: 'page_view',
    routeKey: 'home',
    entityType: null,
    entityId: null,
    actionKey: null,
    sessionId: expect.any(String),
  })
  expect(analyticsRequest.headers()).toMatchObject({
    'content-type': 'application/json',
  })
  expect(analyticsRequest.headers()).not.toHaveProperty('cookie')
  expect(analyticsRequest.headers()['referer'] ?? '').toBe('')
  expect(body).not.toHaveProperty('url')
  expect(body).not.toHaveProperty('query')
  expect(body).not.toHaveProperty('referer')
  expect(body).not.toHaveProperty('userAgent')
  expect(analyticsResponse.status()).toBe(200)

  await expect.poll(() => {
    const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
    try {
      return sqlite.prepare(`
        SELECT route_key AS routeKey, session_hmac AS sessionHmac
        FROM analytics_events ORDER BY id DESC LIMIT 1
      `).get()
    }
    finally {
      sqlite.close()
    }
  }).toMatchObject({
    routeKey: 'home',
    sessionHmac: expect.stringMatching(/^[0-9a-f]{64}$/u),
  })

  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
  try {
    sqlite.prepare(`
      UPDATE site_content SET contact_email = ?, updated_at = ? WHERE id = 'site'
    `).run('studio@example.test', Date.now())
  }
  finally {
    sqlite.close()
  }

  await page.route('**/api/public/v1/analytics/events', route => route.abort())
  await page.goto('/about')
  await expect(page.getByTestId('about-contact')).toBeVisible()
  await page.getByRole('button', { name: '复制邮箱' }).click()
  // 邮箱不再以文本贴在按钮下方，真实地址只出现在 mailto 上。
  await expect(
    page.getByTestId('about-contact').getByRole('link', { name: '打开邮件客户端' }),
  ).toHaveAttribute('href', /^mailto:studio@example\.test/u)
})

test('public write rejects foreign origin and enforces the per-minute limit', async ({ request }) => {
  const reset = await request.post(`${adminBaseURL}/api/e2e-fake-media-control`, {
    data: { action: 'resetRateLimits' },
  })
  expect(reset.ok()).toBeTruthy()

  const payload = {
    eventType: 'page_view',
    routeKey: 'home',
    entityType: null,
    entityId: null,
    actionKey: null,
    sessionId: SESSION_ID,
  }
  const forbidden = await request.post(
    `${publicBaseURL}/api/public/v1/analytics/events`,
    {
      data: payload,
      headers: { Origin: 'https://tracker.example' },
    },
  )
  expect(forbidden.status()).toBe(403)
  expect(await forbidden.text()).not.toContain('tracker.example')

  const resetAgain = await request.post(
    `${adminBaseURL}/api/e2e-fake-media-control`,
    { data: { action: 'resetRateLimits' } },
  )
  expect(resetAgain.ok()).toBeTruthy()
  for (let index = 0; index < 120; index += 1) {
    const response = await request.post(
      `${publicBaseURL}/api/public/v1/analytics/events`,
      {
        data: payload,
        headers: { Origin: publicBaseURL },
      },
    )
    expect(response.status(), `request ${index + 1} should be accepted`).toBe(200)
  }

  const limited = await request.post(
    `${publicBaseURL}/api/public/v1/analytics/events`,
    {
      data: payload,
      headers: { Origin: publicBaseURL },
    },
  )
  expect(limited.status()).toBe(429)
  expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0)
})

test('authenticated overview is responsive and explains the approximate count', async ({ page }) => {
  const now = Date.now()
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
  try {
    sqlite.prepare(`
      INSERT INTO analytics_events (
        occurred_at, event_type, route_key,
        entity_type, entity_id, action_key, session_hmac
      ) VALUES
        (?, 'page_view', 'home', NULL, NULL, NULL, ?),
        (?, 'page_view', 'works', NULL, NULL, NULL, ?),
        (?, 'contact_action', 'about', NULL, NULL, 'email_copy', ?)
    `).run(now, 'a'.repeat(64), now, 'b'.repeat(64), now, 'a'.repeat(64))
  }
  finally {
    sqlite.close()
  }

  await loginAsAdmin(page)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto(`${adminBaseURL}/admin/analytics`)
    await expect(page.getByRole('heading', { level: 1, name: '访问概览' }))
      .toBeVisible()
    await expect(page.getByText('次页面浏览').first()).toBeVisible()
    await expect(page.getByText('大约会话', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('联系行动', { exact: true }).first()).toBeVisible()
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )).toBeLessThanOrEqual(1)
  }

  await page.keyboard.press('Shift+Tab')
  expect(consoleErrors).toEqual([])
})

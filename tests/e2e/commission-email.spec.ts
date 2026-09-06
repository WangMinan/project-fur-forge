import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import { adminBaseURL, publicBaseURL, E2E_DATABASE_FILE, loginAsAdmin } from './helpers/auth'
import { openFixtureDatabase } from './helpers/fixture-db'

const evidence = resolve('agent_docs/需求5-委托邮件通知与站点配置/implementation/evidence')
const viewports = [[390, 844], [430, 932], [768, 1024], [1023, 900], [1024, 900], [1440, 900]]

async function observe(page: Page) {
  const failures: string[] = []
  page.on('pageerror', () => failures.push('pageerror'))
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text().includes('status of 409') ? 'expected-conflict-response' : 'console-error') })
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push('network-failure') })
  await page.addInitScript(() => {
    const metrics = { cls: 0, lcp: 0 }
    Object.assign(window, { r5Metrics: metrics })
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean, value: number }
        if (!shift.hadRecentInput) metrics.cls += shift.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver(list => {
      metrics.lcp = list.getEntries().at(-1)?.startTime ?? 0
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  return failures
}
async function measure(page: Page, label: string, width: number, failures: string[]) {
  const metrics = await page.evaluate(async () => {
    const images = [...document.images].filter(image => {
      const box = image.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0
    })
    const decoded = await Promise.all(images.map(image => image.decode().then(() => true, () => false)))
    return { ...(window as unknown as { r5Metrics: { cls: number, lcp: number } }).r5Metrics,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      decoded, viewportFit: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
    }
  })
  expect(metrics.horizontalOverflow).toBe(false)
  expect(metrics.decoded.every(Boolean)).toBe(true)
  expect(failures).toEqual([])
  writeFileSync(resolve(evidence, `${label}-${width}-metrics.json`), JSON.stringify({ ...metrics, failures }, null, 2))
}

test('private recipient editing, validation, conflict and public projection isolation', async ({ page }) => {
  test.setTimeout(120_000)
  const failures = await observe(page)
  const session = await loginAsAdmin(page)
  const before = await (await page.request.get(`${publicBaseURL}/api/public/v1/site-content`)).json()
  await page.goto(`${adminBaseURL}/admin/site/content#content-contact`)
  await expect(page.getByRole('heading', { name: '站点配置', exact: true })).toBeVisible({ timeout: 30_000 })
  const section = page.locator('#content-contact')
  await expect(section.getByLabel('收件邮箱 1', { exact: true })).toHaveValue('765678159@qq.com')
  await section.getByLabel('收件邮箱 1', { exact: true }).fill('one@example.com')
  await section.getByLabel('收件邮箱 2', { exact: true }).fill('two@example.com')
  await section.getByRole('button', { name: '新增收件邮箱' }).click()
  await expect(section.getByLabel('收件邮箱 3', { exact: true })).toBeFocused()
  await page.keyboard.type('one@example.com')
  await expect(section.getByRole('button', { name: '保存', exact: true })).toBeDisabled()
  await section.getByLabel('收件邮箱 3', { exact: true }).fill('three@example.com')
  await section.getByRole('button', { name: '保存', exact: true }).click()
  await expect(section.getByTestId('site-section-saved')).toBeVisible()
  expect(await (await page.request.get(`${publicBaseURL}/api/public/v1/site-content`)).json()).toEqual(before)
  await page.reload()
  await expect(section.getByLabel('收件邮箱 3', { exact: true })).toHaveValue('three@example.com')

  // Concurrent update must preserve the draft and show the new internal list.
  const current = await (await page.request.get(`${adminBaseURL}/api/admin/v1/site/home/content`)).json()
  const save = await page.request.put(`${adminBaseURL}/api/admin/v1/site/home/content/contact`, {
    headers: { Origin: adminBaseURL, 'x-csrf-token': session.csrfToken },
    data: { expectedVersion: current.data.sectionVersions.contact, payload: {
      email: current.data.contact.email,
      officialChannels: current.data.contact.officialChannels.map(({ qrLinkUrl: _link, ...rest }: Record<string, unknown>) => rest),
      commissionNotificationRecipients: ['latest@example.com'],
    } },
  })
  expect(save.status()).toBe(200)
  await section.getByLabel('收件邮箱 1', { exact: true }).fill('draft@example.com')
  await section.getByRole('button', { name: '保存', exact: true }).click()
  await expect(section.getByText('latest@example.com', { exact: true })).toBeVisible()
  // Chromium logs the intentionally rejected stale save as an HTTP error.
  expect(failures).toContain('expected-conflict-response')
  failures.splice(failures.indexOf('expected-conflict-response'), 1)
  await expect(section.getByLabel('收件邮箱 1', { exact: true })).toHaveValue('draft@example.com')
  await section.getByRole('button', { name: '改用最新内容' }).click()
  await section.getByRole('button', { name: '删除收件邮箱 1', exact: true }).click()
  await expect(section.getByRole('button', { name: '新增收件邮箱' })).toBeFocused()
  await section.getByRole('button', { name: '保存', exact: true }).click()
  await expect(section.getByTestId('site-section-saved')).toBeVisible()
  await page.reload()
  await expect(section.getByText('未配置委托通知邮箱，新投递仅在后台列表中保存。')).toBeVisible()
  await section.getByRole('button', { name: '新增收件邮箱' }).click()
  await section.getByLabel('收件邮箱 1', { exact: true }).fill('one@example.com')
  await section.getByRole('button', { name: '保存', exact: true }).click()
  await expect(section.getByTestId('site-section-saved')).toBeVisible()
  mkdirSync(evidence, { recursive: true })
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width: width!, height: height! })
    await section.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await measure(page, 'contact', width!, failures)
    await page.screenshot({ path: resolve(evidence, `contact-${width}.png`) })
  }
  await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-contrast', value: 'more' },
    { name: 'prefers-reduced-transparency', value: 'reduce' },
  ] })
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true)
  await expect(section.getByRole('button', { name: '新增收件邮箱' })).toBeEnabled()
})

test('submission stays unchanged and admin notifications are authenticated and private', async ({ page }) => {
  test.setTimeout(120_000)
  const failures = await observe(page)
  const session = await loginAsAdmin(page)
  const content = createSyntheticSourcePng(640, 480) as Buffer
  const uploadResponse = await page.request.post(`${publicBaseURL}/api/public/v1/commission-upload-sessions`, {
    headers: { Origin: publicBaseURL },
    data: { expected: {
      contentType: 'image/png', byteSize: content.length,
      contentMd5: createHash('md5').update(content).digest('base64'), sha256: createHash('sha256').update(content).digest('hex'),
      width: 640, height: 480,
    } },
  })
  expect(uploadResponse.status()).toBe(201)
  const upload = (await uploadResponse.json()).data
  expect((await page.request.put(upload.upload.url, { headers: upload.upload.headers, data: content })).ok()).toBe(true)
  const headers = { Origin: publicBaseURL, Authorization: `Bearer ${upload.token}` }
  const completed = await page.request.post(`${publicBaseURL}/api/public/v1/commission-upload-sessions/${upload.session.uploadSessionId}/complete`, {
    headers, data: { expectedVersion: upload.session.version },
  })
  expect(completed.status()).toBe(200)
  const ready = (await completed.json()).data.session
  const submission = await page.request.post(`${publicBaseURL}/api/public/v1/commission-submissions`, {
    headers, data: { adultConfirmed: true, privacyNoticeAcknowledged: true,
      uploadSessionId: ready.uploadSessionId, expectedUploadVersion: ready.version,
      nickname: '虚构通知测试', species: '小狗', phone: { countryCode: '+86', number: '19900000000' },
      qq: '100001', heightCm: 170, weightKg: 60.5,
    },
  })
  expect(submission.status()).toBe(201)
  expect(Object.keys((await submission.json()).data)).toEqual(['receiptCode'])
  const rows = (await (await page.request.get(`${adminBaseURL}/api/admin/v1/commissions`)).json()).data
  const id = rows[0].id
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
  try {
    sqlite.prepare("INSERT INTO commission_email_notifications (id, submission_id, recipient, status, attempt_count, next_attempt_at, created_at, updated_at, last_error_code) VALUES (?, ?, ?, 'failed', 3, ?, ?, ?, 'CONNECTION')")
      .run('cccccccc-cccc-4ccc-8ccc-cccccccccccc', id, 'one@example.com', Date.now(), Date.now(), Date.now())
  }
  finally { sqlite.close() }
  expect((await page.request.get(`${publicBaseURL}/api/admin/v1/commissions/${id}/email`)).status()).toBe(404)
  const noCsrf = await page.request.post(`${adminBaseURL}/api/admin/v1/commissions/${id}/email-retry`, {
    headers: { Origin: adminBaseURL }, data: { notificationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
  })
  expect(noCsrf.status()).toBe(403)
  const wrongOrigin = await page.request.post(`${adminBaseURL}/api/admin/v1/commissions/${id}/email-retry`, {
    headers: { Origin: publicBaseURL, 'x-csrf-token': session.csrfToken }, data: {},
  })
  expect(wrongOrigin.status()).toBe(403)
  await page.goto(`${adminBaseURL}/admin/commissions/${id}`)
  await expect(page.getByRole('heading', { name: '委托邮件通知' })).toBeVisible()
  await expect(page.getByText('one@example.com', { exact: true })).toBeVisible()
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width: width!, height: height! })
    await page.getByRole('heading', { name: '委托邮件通知' }).scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await measure(page, 'notification', width!, failures)
    await page.screenshot({ path: resolve(evidence, `notification-${width}.png`) })
  }
})

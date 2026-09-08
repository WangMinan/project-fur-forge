import { createHash, randomInt } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import { adminBaseURL, publicBaseURL, loginAsAdmin } from './helpers/auth'
import { seedHeroCollections } from './helpers/public-catalog'

const imageBytes = createSyntheticSourcePng(640, 480) as Buffer
const imageName = '委托申请私有设定图'
const signedEndpoint = '**/design-reference?w=640&delivery=url'

async function commission(page: Page) {
  const uploadResponse = await page.request.post(`${publicBaseURL}/api/public/v1/commission-upload-sessions`, {
    headers: { Origin: publicBaseURL },
    data: { expected: {
      contentType: 'image/png', byteSize: imageBytes.length,
      contentMd5: createHash('md5').update(imageBytes).digest('base64'), sha256: createHash('sha256').update(imageBytes).digest('hex'),
      width: 640, height: 480,
    } },
  })
  expect(uploadResponse.status()).toBe(201)
  const upload = (await uploadResponse.json()).data
  expect((await page.request.put(upload.upload.url, { headers: upload.upload.headers, data: imageBytes })).ok()).toBe(true)
  const headers = { Origin: publicBaseURL, Authorization: `Bearer ${upload.token}` }
  const completed = await page.request.post(`${publicBaseURL}/api/public/v1/commission-upload-sessions/${upload.session.uploadSessionId}/complete`, {
    headers, data: { expectedVersion: upload.session.version },
  })
  expect(completed.status()).toBe(200)
  const ready = (await completed.json()).data.session
  const submitted = await page.request.post(`${publicBaseURL}/api/public/v1/commission-submissions`, {
    headers, data: { adultConfirmed: true, privacyNoticeAcknowledged: true,
      uploadSessionId: ready.uploadSessionId, expectedUploadVersion: ready.version,
      nickname: '虚构图片测试', species: '犬科', phone: { countryCode: '+86', number: `199${String(randomInt(100_000_000)).padStart(8, '0')}` },
      qq: '100001', heightCm: 170, weightKg: 60.5,
    },
  })
  expect(submitted.status()).toBe(201)
  const receipt = (await submitted.json()).data.receiptCode
  const rows = (await (await page.request.get(`${adminBaseURL}/api/admin/v1/commissions`)).json()).data
  return rows.find((row: { receiptCode: string }) => row.receiptCode === receipt).id as string
}

async function expectImage(page: Page) {
  const image = page.getByRole('img', { name: imageName, exact: true })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
  return image
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
})

test('signed thumbnails decode at all viewports; originals redirect and passive resumes never renew cookies', async ({ page }, info) => {
  test.setTimeout(120_000)
  const id = await commission(page)
  let signatures = 0
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.name))
  page.on('request', request => { if (request.url().includes('design-reference?w=640&delivery=url')) signatures++ })
  await page.goto(`${adminBaseURL}/admin/commissions/${id}`)
  const image = await expectImage(page)
  await expect(image).toHaveAttribute('src', /\/api\/e2e-fake-oss\/.+x-oss-process=/u)
  await expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
  const src = await image.getAttribute('src')
  const cookie = (await page.context().cookies()).find(value => value.name === '__Host-fur-forge-session')!
  await page.clock.install()
  await page.clock.fastForward(11 * 60 * 1_000)
  const passiveResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/session?touch=0'))
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow')) })
  await page.clock.runFor(200)
  expect((await passiveResponse).headers()['set-cookie']).toBeUndefined()
  await expect(image).toHaveAttribute('src', src!)
  expect(signatures).toBe(1)
  expect((await page.context().cookies()).find(value => value.name === cookie.name)?.value).toBe(cookie.value)
  for (const [width, height] of [[390, 844], [430, 932], [768, 1024], [1023, 900], [1024, 900], [1440, 900]]) {
    await page.setViewportSize({ width: width!, height: height! })
    await image.scrollIntoViewIfNeeded()
    await expectImage(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`private-image-${width}.png`) })
  }
  const original = await page.request.get(`${adminBaseURL}/api/admin/v1/commissions/${id}/design-reference?original=1`, { maxRedirects: 0 })
  expect(original.status()).toBe(302)
  expect(original.headers()['cache-control']).toContain('no-store')
  expect(original.headers()['set-cookie']).toBeUndefined()
  expect(new URL(original.headers().location!).searchParams.has('x-oss-process')).toBe(false)
  expect(await (await page.request.get(original.headers().location!)).body()).toEqual(imageBytes)
  expect(errors).toEqual([])
})

test('loads bytes from a separate OSS origin, renews an expired link once, and exposes bounded recovery', async ({ page }) => {
  const id = await commission(page)
  let signatures = 0
  let broken = false
  await page.route(signedEndpoint, async (route) => {
    signatures++
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    const { data } = await response.json()
    await route.fulfill({ json: { data: { ...data, url: `https://oss-fixture.test/image-${signatures}.png` } } })
  })
  await page.route('https://oss-fixture.test/**', async (route) => {
    const expired = route.request().url().endsWith('/image-1.png')
    await route.fulfill(expired || broken ? { status: 403, body: 'Expired' } : { contentType: 'image/png', body: imageBytes })
  })
  await page.goto(`${adminBaseURL}/admin/commissions/${id}`)
  let image = await expectImage(page)
  await expect(image).toHaveAttribute('src', 'https://oss-fixture.test/image-2.png')
  expect(signatures).toBe(2)
  broken = true
  await image.evaluate(element => element.dispatchEvent(new Event('error')))
  const retry = page.getByRole('button', { name: `${imageName}：重新加载`, exact: true })
  await expect(retry).toBeVisible()
  expect(signatures).toBe(3)
  broken = false
  await retry.focus()
  await page.keyboard.press('Enter')
  image = await expectImage(page)
  await expect(image).toHaveAttribute('src', 'https://oss-fixture.test/image-4.png')
})

test('recovers after offline and hidden time, and sends an expired login to the login page', async ({ page }) => {
  const id = await commission(page)
  let signatures = 0
  page.on('request', request => { if (request.url().includes('design-reference?w=640&delivery=url')) signatures++ })
  await page.goto(`${adminBaseURL}/admin/commissions/${id}`)
  const image = await expectImage(page)
  await page.context().setOffline(true)
  await image.evaluate(element => element.dispatchEvent(new Event('error')))
  await expect(page.getByRole('button', { name: `${imageName}：重新加载` })).toBeVisible()
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }))
  await page.context().setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  expect(signatures).toBe(1)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expectImage(page)
  expect(signatures).toBe(2)
  await page.context().clearCookies()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page).toHaveURL(/\/admin\/login/u)
  await expect(page.getByRole('img', { name: imageName })).toHaveCount(0)
})

test('ignores a delayed signature from a detail page that has been left', async ({ page }) => {
  const first = await commission(page)
  const second = await commission(page)
  const held = Promise.withResolvers<undefined>()
  let started = false
  await page.route(`**/commissions/${first}/design-reference?*`, async (route) => {
    const response = await route.fetch()
    started = true
    await held.promise
    await route.fulfill({ response }).catch(() => {})
  })
  await page.goto(`${adminBaseURL}/admin/commissions/${first}`)
  await expect.poll(() => started).toBe(true)
  await page.locator('a[href="/admin/commissions"]').first().click()
  await page.locator(`a[href="/admin/commissions/${second}"]`).click()
  const image = await expectImage(page)
  const src = await image.getAttribute('src')
  held.resolve(undefined)
  await expect(image).toHaveAttribute('src', src!)
  await expect(page).toHaveURL(new RegExp(`/admin/commissions/${second}$`))
})

test('Hero image retry remains clickable above its focal drag surface', async ({ page }) => {
  await seedHeroCollections(page, {
    landscape: [{ alt: '虚构横版大图', sortOrder: 0, enabled: false }], portrait: [],
  })
  let broken = true
  await page.route('**/api/e2e-fake-oss/**', async (route) => {
    if (broken && route.request().method() === 'GET') await route.fulfill({ status: 500, body: 'Unavailable' })
    else await route.continue()
  })
  await page.goto(`${adminBaseURL}/admin/site/home`)
  const preview = page.locator('.hero-focal-picker__preview').first()
  const retry = preview.getByRole('button', { name: /重新加载/u })
  await expect(retry).toBeVisible()
  broken = false
  await retry.click()
  await expect.poll(() => preview.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  const drag = preview.getByRole('button', { name: '拖动设置大图焦点' })
  await expect(drag).toBeEnabled()
  const slider = page.locator('.hero-focal-picker__controls input[type="range"]').first()
  const before = await slider.inputValue()
  await drag.click({ position: { x: 20, y: 20 } })
  await expect(slider).not.toHaveValue(before)
})

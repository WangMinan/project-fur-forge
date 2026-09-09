import { createHash, randomInt } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import { adminBaseURL, publicBaseURL, loginAsAdmin } from './helpers/auth'
import { seedHeroCollections, seedPublicCatalog } from './helpers/public-catalog'

const imageBytes = createSyntheticSourcePng(1600, 1000) as Buffer
const imageName = '委托申请私有设定图'

async function commission(page: Page) {
  const uploadResponse = await page.request.post(`${publicBaseURL}/api/public/v1/commission-upload-sessions`, {
    headers: { Origin: publicBaseURL },
    data: { expected: {
      contentType: 'image/png', byteSize: imageBytes.length,
      contentMd5: createHash('md5').update(imageBytes).digest('base64'), sha256: createHash('sha256').update(imageBytes).digest('hex'),
      width: 1600, height: 1000,
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


async function assertOriginalTab(page: Page, link: ReturnType<Page['getByRole']>) {
  const downloads: string[] = []
  page.on('download', () => downloads.push('download'))
  const href = await link.getAttribute('href')
  const original = await page.request.get(new URL(href!, adminBaseURL).href, { maxRedirects: 0 })
  expect(original.status()).toBe(200)
  expect(original.headers()['content-type']).toContain('image/')
  expect(original.headers()['content-disposition']).toBe('inline')
  expect(original.headers()['cache-control']).toContain('no-store')
  expect(original.headers().location).toBeUndefined()
  expect(original.headers()['set-cookie']).toBeUndefined()
  const popupPromise = page.waitForEvent('popup')
  await link.click()
  const popup = await popupPromise
  popup.on('download', () => downloads.push('download'))
  await popup.waitForLoadState('load')
  expect(new URL(popup.url()).origin).toBe(adminBaseURL)
  await expect.poll(() => popup.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  expect(downloads).toEqual([])
  await popup.close()
  return original
}

test('commission uses a same-origin 1280 preview and opens the original image in a new tab', async ({ page }, info) => {
  test.setTimeout(120_000)
  const id = await commission(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.name))
  await page.goto(adminBaseURL + '/admin/commissions/' + id)
  const image = await expectImage(page)
  const previewPath = '/api/admin/v1/commissions/' + id + '/design-reference'
  await expect(image).toHaveAttribute('src', previewPath + '?w=1280')
  const state = await page.request.post(adminBaseURL + '/api/e2e-fake-media-control', { data: { action: 'state' } })
  expect((await state.json()).data.privateProcessCalls).toContainEqual({ process: 'image/auto-orient,1/resize,m_lfit,w_1280' })
  const preview = await page.request.get(adminBaseURL + previewPath + '?w=1280', { maxRedirects: 0 })
  expect(preview.status()).toBe(200)
  expect(preview.headers()['cache-control']).toContain('no-store')
  expect(preview.headers()['set-cookie']).toBeUndefined()
  expect(preview.headers().location).toBeUndefined()
  for (const [width, height] of [[390, 844], [430, 932], [768, 1024], [1023, 900], [1024, 900], [1440, 900], [3840, 2160]]) {
    await page.setViewportSize({ width: width!, height: height! })
    await image.scrollIntoViewIfNeeded()
    await expectImage(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('private-image-' + width + '.png') })
  }
  const original = await assertOriginalTab(page, page.getByRole('link', { name: '放大预览原图' }))
  expect(await original.body()).toEqual(imageBytes)
  const legacy = await page.request.get(adminBaseURL + previewPath)
  expect(await legacy.body()).toEqual(imageBytes)
  for (const query of ['?w=1280&delivery=url', '?w=2560', '?original=1&w=1280']) {
    expect((await page.request.get(adminBaseURL + previewPath + query)).status()).toBe(400)
  }
  await page.context().clearCookies()
  expect((await page.request.get(adminBaseURL + previewPath + '?w=1280')).status()).toBe(401)
  expect((await page.request.get(adminBaseURL + previewPath + '?original=1')).status()).toBe(401)
  expect(errors).toEqual([])
})

test('work editor uses 1280 for cover and design sheet, 640 for photos, and 320 for the list', async ({ page }) => {
  test.setTimeout(120_000)
  await seedPublicCatalog(page, [{
    slug: 'e2e-public-admin-image-sizes', characterName: '虚构图片尺寸测试',
    purpose: 'adoption', adoptionStatus: 'available', publicationStatus: 'draft',
    adoptionCover: { alt: '虚构横版封面', width: 2400, height: 1600 },
    designSheet: { alt: '虚构完整设定图', width: 2400, height: 1600 },
    photos: [{ alt: '虚构出厂照', width: 2400, height: 1600 }],
  }])
  await page.goto(adminBaseURL + '/admin/works')
  await page.getByRole('link', { name: '虚构图片尺寸测试', exact: true }).click()
  for (const [alt, width] of [['虚构横版封面', 1280], ['虚构完整设定图', 1280], ['虚构出厂照', 640]] as const) {
    const image = page.getByRole('img', { name: alt, exact: true })
    await expect(image).toHaveAttribute('src', new RegExp('/preview\\?w=' + width + '$'))
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  }
  await assertOriginalTab(page, page.getByRole('link', { name: '查看原图', exact: true }).first())
  await page.goto(adminBaseURL + '/admin/works')
  await expect(page.locator('img[src*="/preview?w=320"]').first()).toBeVisible()
})

test('Hero editor requests 1280 through the authenticated image endpoint', async ({ page }) => {
  await seedHeroCollections(page, {
    landscape: [{ alt: '虚构横版大图', sortOrder: 0, enabled: false }], portrait: [],
  })
  await page.goto(adminBaseURL + '/admin/site/home')
  const image = page.getByRole('img', { name: '虚构横版大图目标裁切预览' })
  await expect(image).toHaveAttribute('src', /\/preview\?w=1280$/u)
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  const src = await image.getAttribute('src')
  const response = await page.request.get(adminBaseURL + src!, { maxRedirects: 0 })
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/')
  expect(response.headers().location).toBeUndefined()
})

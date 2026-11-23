import { expect, test, type Page } from '@playwright/test'
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import { adminBaseURL, loginAsAdmin, publicBaseURL } from '../e2e/helpers/auth'
import { seedHeroCollections } from '../e2e/helpers/public-catalog'

const card = (page: Page) => page.locator('[data-testid="hero-collection-item"]:visible').first()

async function adjust(page: Page) {
  await card(page).getByRole('button', { name: /调整.*构图/u }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '缩小选区' }).click()
  await dialog.getByRole('button', { name: '选区向右' }).click()
  await dialog.getByRole('button', { name: '应用构图' }).click()
}

test('upload opens the cropper before adding a Hero and persists the applied selection', async ({ page }) => {
  await loginAsAdmin(page)
  await seedHeroCollections(page, { placement: 'commission', landscape: [], portrait: [] })
  await page.goto(`${adminBaseURL}/admin/site/home?placement=commission&orientation=portrait`)
  await page.getByRole('button', { name: '新增图片' }).click()
  await card(page).getByLabel('替代文字').fill('上传后裁切')
  await card(page).getByLabel('竖版原图', { exact: true }).setInputFiles({
    name: 'portrait.png', mimeType: 'image/png', buffer: createSyntheticSourcePng(640, 960) as Buffer,
  })
  await card(page).getByRole('button', { name: '上传图片' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAccessibleName('4:5构图')
  await dialog.getByRole('button', { name: '缩小选区' }).click()
  await dialog.getByRole('button', { name: '应用构图' }).click()
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/portrait/items'))
  await card(page).getByRole('button', { name: '新增', exact: true }).click()
  const response = await saved
  expect(response.ok()).toBe(true)
  const { cropRect } = (await response.json()).data.items[0]
  expect(cropRect.width).toBeLessThan(1)
  expect(cropRect.width * 640 / (cropRect.height * 960)).toBeCloseTo(4 / 5, 5)
  await page.reload()
  await expect(card(page).getByLabel('替代文字')).toHaveValue('上传后裁切')
})

test('a failed crop save preserves the draft and does not start publication', async ({ page }) => {
  await loginAsAdmin(page)
  await seedHeroCollections(page, { landscape: [], portrait: [{ alt: '保存失败竖图', sortOrder: 0, enabled: false }] })
  await page.goto(`${adminBaseURL}/admin/site/home?placement=home&orientation=portrait`)
  await adjust(page)
  const image = card(page).locator('.hero-item__preview img')
  const draftStyle = await image.getAttribute('style')
  let publications = 0
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/enable')) publications++ })
  await page.route('**/hero-collections/home/portrait/items/*', route =>
    route.request().method() === 'PUT' ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR' } } }) : route.continue())
  await card(page).getByRole('button', { name: '发布并启用', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存大图项失败')
  expect(await image.getAttribute('style')).toBe(draftStyle)
  expect(publications).toBe(0)
})

test('small commission selection adapts before automatic publication', async ({ page }) => {
  await loginAsAdmin(page)
  test.setTimeout(120_000)
  await seedHeroCollections(page, { placement: 'commission', landscape: [], portrait: [{ alt: '小尺寸竖图', sortOrder: 0, enabled: false, portraitWidth: 900, portraitHeight: 1600 }] })
  await page.goto(`${adminBaseURL}/admin/site/home?placement=commission&orientation=portrait`)
  await adjust(page)
  await card(page).getByRole('checkbox').check()
  await card(page).getByRole('button', { name: '适配大尺寸' }).click()
  await expect(card(page)).toHaveAttribute('data-enabled', 'true', { timeout: 90_000 })
})

test('four Hero crops survive publication and match their public frames', async ({ page }) => {
  test.setTimeout(150_000)
  await loginAsAdmin(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const placement of ['home', 'commission'] as const) {
    await seedHeroCollections(page, {
      placement,
      landscape: [{ alt: '独立横图', sortOrder: 0, enabled: false, landscapeWidth: 5500, landscapeHeight: 3100 }],
      portrait: [{ alt: '独立竖图', sortOrder: 0, enabled: false, portraitWidth: 1800, portraitHeight: 3200 }],
    })
    for (const orientation of ['landscape', 'portrait'] as const) {
      const desktop = orientation === 'landscape'
      const ratio = placement === 'home' ? (desktop ? 16 / 9 : 9 / 16) : (desktop ? 7 / 5 : 4 / 5)
      const viewport = desktop ? { width: 1440, height: 810 } : { width: 390, height: placement === 'home' ? 693 : 844 }
      await page.setViewportSize(viewport)
      await page.goto(`${adminBaseURL}/admin/site/home?placement=${placement}&orientation=${orientation}`)
      await adjust(page)
      const image = card(page).locator('.hero-item__preview img')
      const editedStyle = await image.getAttribute('style')
      await card(page).getByRole('button', { name: /调整.*构图/u }).click()
      await page.getByRole('dialog').getByRole('button', { name: '缩小选区' }).click()
      await page.keyboard.press('Escape')
      expect(await image.getAttribute('style')).toBe(editedStyle)
      const saved = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes('/hero-collections/'))
      await card(page).getByRole('button', { name: '发布并启用' }).click()
      const response = await saved
      expect(response.status()).toBe(200)
      const rect = response.request().postDataJSON().payload.cropRect
      expect(rect.width).toBeLessThan(1)
      await expect(card(page)).toHaveAttribute('data-enabled', 'true')
      await page.reload()
      await expect(image).toHaveAttribute('style', editedStyle!)
      const api = placement === 'home' ? 'home' : 'commission-hero'
      const data = (await (await page.request.get(`${publicBaseURL}/api/public/v1/${api}`)).json()).data
      for (const variant of [...data[orientation][0].sources.webp, ...data[orientation][0].sources.fallback]) {
        expect(variant.height).toBe(Math.round(variant.width / ratio))
        expect(variant.src).toContain('/crop-')
      }
      await page.goto(publicBaseURL + (placement === 'home' ? '/' : '/commission'))
      const frame = page.locator(placement === 'home' ? '.home-hero__viewport' : '.commission-lead__media')
      const urls = [...data[orientation][0].sources.webp, ...data[orientation][0].sources.fallback].map((v: { src: string }) => v.src)
      await expect.poll(async () => {
        const src = await frame.locator('img').first().evaluate(img => (img as HTMLImageElement).currentSrc)
        return urls.includes(src)
      }).toBe(true)
      const bounds = await frame.boundingBox()
      if (placement === 'home') {
        const stage = await page.locator('.home-hero').boundingBox()
        expect(bounds!.width).toBe(stage!.width)
        expect(bounds!.height).toBe(viewport.height)
      }
      else {
        expect(bounds!.width / bounds!.height).toBeCloseTo(ratio, 2)
      }
      if (placement === 'commission' && desktop) {
        await page.setViewportSize({ width: 390, height: 844 })
        await expect(frame.locator('img')).toHaveCSS('object-fit', 'contain')
        const fallback = await frame.boundingBox()
        expect(fallback!.width / fallback!.height).toBeCloseTo(7 / 5, 2)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    }
  }
  expect(errors).toEqual([])
})

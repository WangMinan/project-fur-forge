import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from '../e2e/helpers/auth'
import { seedHeroCollections } from '../e2e/helpers/public-catalog'

test('Hero workspace keeps collections independent in a flat responsive editor', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await loginAsAdmin(page)
  await seedHeroCollections(page, {
    landscape: [{ alt: '首页已发布横图', sortOrder: 0, enabled: true }, { alt: '首页横图草稿', sortOrder: 1, enabled: false }],
    portrait: [{ alt: '首页竖图草稿', sortOrder: 0, enabled: false }],
  })
  await seedHeroCollections(page, {
    placement: 'commission',
    landscape: [{ alt: '委托横图草稿', sortOrder: 0, enabled: false }],
    portrait: [{ alt: '委托已发布竖图', sortOrder: 0, enabled: true }],
  })
  await page.goto(`${adminBaseURL}/admin/site/home`)
  await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as HTMLElement & { __vue_app__?: unknown })?.__vue_app__))
  const placement = page.getByRole('combobox', { name: '使用页面' })
  const formats = page.getByRole('navigation', { name: '设备画框与图片方向' })
  const portrait = formats.getByRole('link', { name: /竖版/u })
  const landscape = formats.getByRole('link', { name: /横版/u })
  const card = page.locator('[data-testid="hero-collection-item"]:visible').first()
  await expect(landscape).toContainText('1/5')
  await expect(portrait).toContainText('0/5')
  await expect(card.getByRole('button', { name: '停用并撤销公开图' })).toBeVisible()
  await expect(card.getByRole('button', { name: '选择图片' })).toHaveCount(0)
  await expect(card.getByRole('slider')).toHaveCount(0)
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(placement).toBeVisible()
    await expect(landscape).toBeVisible()
  }
  await page.screenshot({ path: testInfo.outputPath('home-landscape.png'), fullPage: true })
  await portrait.click()
  await expect(page).toHaveURL(/orientation=portrait/u)
  const description = card.getByLabel('替代文字', { exact: true })
  await description.fill('保留在竖版的未保存说明')
  await landscape.click()
  await portrait.click()
  await expect(description).toHaveValue('保留在竖版的未保存说明')
  const order = card.getByLabel('播放顺序（1–5）')
  await expect(order).toHaveValue('1')
  await order.fill('2')
  const saved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/hero-collections/home/portrait/items/'))
  await card.getByRole('button', { name: '保存', exact: true }).click()
  const response = await saved
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON().payload.sortOrder).toBe(1)
  await page.getByRole('button', { name: '新增图片', exact: true }).click()
  const draft = page.locator('[data-testid="hero-collection-item"]:visible').last()
  await draft.getByRole('button', { name: '取消新增' }).click()
  await expect(page.getByRole('button', { name: '新增图片', exact: true })).toBeFocused()
  await placement.click()
  await page.getByRole('option', { name: '委托页大图', exact: true }).click()
  await expect(page).toHaveURL(/placement=commission&orientation=portrait/u)
  await expect(card).toContainText('委托已发布竖图')
  await placement.click()
  await page.getByRole('option', { name: '首页大图', exact: true }).click()
  await expect(page).toHaveURL(/placement=home&orientation=portrait/u)
  await expect(description).toHaveValue('保留在竖版的未保存说明')
  await page.goto(`${adminBaseURL}/admin/site/home?placement=commission&orientation=landscape`)
  await expect(description).toHaveValue('委托横图草稿')
  await expect(card.getByLabel('播放顺序（1–5）')).toHaveCount(0)
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect.poll(() => card.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`commission-landscape-${width}.png`), fullPage: true })
  }
  await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
  await portrait.focus()
  await page.keyboard.press('Enter')
  await expect(card).toContainText('委托已发布竖图')
  expect(errors).toEqual([])
})

import { expect, test } from '@playwright/test'
import { seedPublicCatalog } from '../e2e/helpers/public-catalog'

test('sheet-only adoption stays out of works and remains reachable from adoptions', async ({ page }, testInfo) => {
  await seedPublicCatalog(page, [
    { slug: 'e2e-public-sheet-only', characterName: '图纸小狗', purpose: 'adoption', adoptionStatus: 'available', photos: [], designSheet: { alt: '完整设定图' } },
    { slug: 'e2e-public-cover-only', characterName: '横图小狗', purpose: 'adoption', adoptionStatus: 'available', photos: [], adoptionCover: { alt: '横版封面' } },
  ])
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/works')
    await expect(page.locator('[data-work-slug="e2e-public-sheet-only"]')).toHaveCount(0)
    await expect(page.locator('[data-work-slug="e2e-public-cover-only"]')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`works-${width}.png`), fullPage: true })
    await page.goto('/works?q=图纸')
    await expect(page.locator('[data-work-slug]')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.goto('/adoptions')
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    const card = page.locator('[data-work-slug="e2e-public-sheet-only"]')
    await expect(card).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`adoptions-${width}.png`), fullPage: true })
    await card.click()
    await expect(page).toHaveURL(/\/works\/e2e-public-sheet-only\?from=adoptions$/u)
    await expect(page.getByRole('heading', { level: 1, name: '图纸小狗' })).toBeVisible()
    await expect(page.getByRole('link', { name: '返回设定领养' })).toHaveAttribute('href', '/adoptions')
    await expect.poll(() => page.locator('.work-detail__media img').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  expect(errors).toEqual([])
})

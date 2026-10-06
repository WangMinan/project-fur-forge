import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from '../e2e/helpers/auth'
import { seedHeroCollections } from '../e2e/helpers/public-catalog'

test('Hero focus survives save and reload in all four collections', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await loginAsAdmin(page)
  for (const placement of ['home', 'commission'] as const) {
    await seedHeroCollections(page, {
      placement,
      landscape: [{ alt: '焦点横图', sortOrder: 0, enabled: false, landscapeWidth: 4000, landscapeHeight: 3000 }],
      portrait: [{ alt: '焦点竖图', sortOrder: 0, enabled: false, portraitWidth: 1600, portraitHeight: 2400 }],
    })
    for (const orientation of ['landscape', 'portrait']) {
      await page.emulateMedia({ reducedMotion: orientation === 'portrait' ? 'reduce' : 'no-preference' })
      await page.setViewportSize(orientation === 'landscape' ? { width: 1440, height: 900 } : { width: 390, height: 844 })
      await page.goto(`${adminBaseURL}/admin/site/home?placement=${placement}&orientation=${orientation}`)
      const card = page.locator('[data-testid="hero-collection-item"]:visible').first()
      const ranges = card.locator('input[type="range"]')
      await expect(ranges).toHaveCount(2)
      await ranges.nth(0).fill('37')
      await ranges.nth(0).focus()
      await page.keyboard.press('ArrowRight')
      await ranges.nth(1).fill('64.7')
      const saved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/hero-collections/'))
      await card.getByRole('button', { name: '保存', exact: true }).click()
      expect((await saved).status()).toBe(200)
      await expect(ranges.nth(0)).toHaveValue('37.1')
      await expect(ranges.nth(1)).toHaveValue('64.7')
      await page.reload()
      await expect(ranges.nth(0)).toHaveValue('37.1')
      await expect(ranges.nth(1)).toHaveValue('64.7')
      const frame = card.locator('.hero-focal-picker__drag-surface')
      await frame.scrollIntoViewIfNeeded()
      const bounds = (await frame.boundingBox())!
      expect(bounds.width / bounds.height).toBeCloseTo(orientation === 'landscape' ? 16 / 9 : 9 / 16, 2)
      await expect(card.locator('.hero-focal-picker__preview img')).toHaveCSS('object-position', '37.1% 64.7%')
      if (orientation === 'portrait') {
        const session = await page.context().newCDPSession(page)
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width * 0.5, y: bounds.y + bounds.height * 0.5 }] })
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bounds.x + bounds.width * 0.2, y: bounds.y + bounds.height * 0.8 }] })
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await session.detach()
      }
      else {
        await frame.click({ position: { x: bounds.width * 0.2, y: bounds.height * 0.8 } })
      }
      expect(Number(await ranges.nth(0).inputValue())).toBeCloseTo(20, 0)
      expect(Number(await ranges.nth(1).inputValue())).toBeCloseTo(80, 0)
      const pointerSaved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/hero-collections/'))
      await card.getByRole('button', { name: '保存', exact: true }).click()
      expect((await pointerSaved).status()).toBe(200)
      await page.reload()
      expect(Number(await ranges.nth(0).inputValue())).toBeCloseTo(20, 0)
      expect(Number(await ranges.nth(1).inputValue())).toBeCloseTo(80, 0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
      await expect.poll(() => card.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
      await card.screenshot({ path: testInfo.outputPath(`${placement}-${orientation}.png`) })
    }
  }
  expect(errors).toEqual([])
})

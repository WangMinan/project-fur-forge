import { expect, test } from '@playwright/test'
import { ADMIN_NAV_ITEMS } from '../../app/utils/admin-nav'
import { adminBaseURL, loginAsAdmin } from '../e2e/helpers/auth'
import { seedHeroCollections, seedPublicCatalog } from '../e2e/helpers/public-catalog'

test('admin navigation pages share title geometry and one header divider', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await loginAsAdmin(page)
  await seedPublicCatalog(page, [{ slug: 'e2e-public-header', characterName: '布局测试', photos: [{ alt: '合成测试图片' }] }])
  await seedHeroCollections(page, {
    landscape: [{ alt: '布局测试横图', sortOrder: 0, enabled: true }],
    portrait: [{ alt: '布局测试竖图', sortOrder: 0, enabled: true }],
  })
  await page.route('**/api/admin/v1/commissions?status=*', route => route.fulfill({ json: { data: [
    { id: '11111111-1111-4111-8111-111111111111', receiptCode: 'DD-TEST-01', nickname: '虚构布局测试', species: '测试物种', status: 'pending', createdAt: '2026-10-08T00:00:00Z', version: 1 },
  ] } }))
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    let reference: unknown
    for (const item of ADMIN_NAV_ITEMS) {
      await page.goto(`${adminBaseURL}${item.href}`)
      await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as HTMLElement & { __vue_app__?: unknown })?.__vue_app__))
      await expect(page.getByRole('heading', { level: 1, name: item.label })).toBeVisible()
      const header = page.locator('.admin-page-header')
      const geometry = await header.evaluate(element => {
        const heading = element.querySelector('h1')!
        const box = heading.getBoundingClientRect()
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(heading)
        return {
          x: box.x, y: box.y, height: box.height,
          fontSize: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight,
          dividerY: rect.bottom, dividerLeft: rect.left, dividerRight: rect.right,
          dividerWidth: getComputedStyle(element).borderBottomWidth,
        }
      })
      reference ??= geometry
      expect(geometry, `${item.label} at ${width}`).toEqual(reference)
      expect(geometry.dividerWidth).toBe('1px')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (item.key === 'home') {
        const tabs = page.getByRole('navigation', { name: '设备画框与图片方向' })
        await expect(tabs).toContainText('1/5')
        for (const tab of await tabs.getByRole('link').all()) {
          const alignment = await tab.evaluate(element => {
            const style = getComputedStyle(element)
            return {
              align: style.alignItems, justify: style.justifyContent,
              size: style.fontSize,
              sizes: Array.from(element.children).filter(child => !child.hasAttribute('aria-hidden')).map(child => getComputedStyle(child).fontSize),
            }
          })
          expect(alignment.align).toBe('center')
          expect(alignment.justify).toBe('center')
          expect(alignment.sizes.every(size => size === alignment.size)).toBe(true)
        }
      }
      for (const toolbar of await page.locator('.admin-list-toolbar, .hero-admin__toolbar').all()) {
        await expect(toolbar).toHaveCSS('border-top-width', '0px')
        await expect(toolbar).toHaveCSS('border-bottom-width', '0px')
      }
      if (width === 1440 || (width === 390 && ['home', 'content'].includes(item.key))) {
        await page.screenshot({ path: testInfo.outputPath(`${item.key}-${width}.png`) })
      }
    }
  }
  expect(errors).toEqual([])
})

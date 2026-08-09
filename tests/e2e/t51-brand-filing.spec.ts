import { expect, test } from '@playwright/test'
import { adminBaseURL } from './helpers/auth'

test('short navigation brand and empty filing state stay truthful at three viewports', async ({ page }) => {
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
    await page.goto('/privacy')
    await expect(page.locator('.public-header__brand-name')).toHaveText('有点小狗')
    const footer = page.getByTestId('public-footer')
    await expect(footer).not.toContainText('ICP备案')
    await expect(footer).not.toContainText('公网安备')
    await expect(footer).not.toContainText('待备案')
    await expect(footer.getByRole('link', { name: '开源软件声明' })).toBeVisible()
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )).toBeLessThanOrEqual(1)
    expect(await page.locator('img').evaluateAll(images => images.filter(image => (
      !image.complete || image.naturalWidth === 0
    )).length)).toBe(0)

    if (viewport.width === 390) {
      await page.getByRole('button', { name: '打开导航' }).click()
      await expect(page.locator('.mobile-nav__brand')).toHaveText('有点小狗')
      await page.getByRole('button', { name: '关闭导航' }).click()
    }
  }

  expect(consoleErrors).toEqual([])
})

test('configured long filing information renders in the shared login shell', async ({ page }) => {
  const longIcp = '浙 ICP 备 12345678 号-有点小狗工作室正式站点备案信息长文本布局验证'
  const police = '浙公网安备 33010000000000 号'
  await page.route('**/api/site-meta', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        filings: {
          icp: {
            number: longIcp,
            url: 'https://beian.miit.gov.cn/',
          },
          police: {
            number: police,
            url: 'https://www.beian.gov.cn/portal/registerSystemInfo',
          },
        },
      },
    }),
  }))

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${adminBaseURL}/admin/login`)
  await expect(page.locator('.public-header__brand-name')).toHaveText('有点小狗')
  const footer = page.getByTestId('public-footer')
  await expect(footer.getByRole('link', { name: longIcp })).toHaveAttribute(
    'href',
    'https://beian.miit.gov.cn/',
  )
  await expect(footer.getByRole('link', { name: police })).toHaveAttribute(
    'href',
    'https://www.beian.gov.cn/portal/registerSystemInfo',
  )
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
})

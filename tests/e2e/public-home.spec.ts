import {
  expect,
  test,
} from '@playwright/test'

const VIEWPORTS = [
  { width: 390, height: 844, name: '390x844' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1440, height: 900, name: '1440x900' },
] as const

test('home SSR ships hero, featured works and business statuses', async ({ request }) => {
  const response = await request.get('/')
  const html = await response.text()

  expect(response.ok()).toBe(true)
  expect(html).toContain('data-testid="public-hero"')
  expect(html).toContain('有点小狗工作室')
  expect(html).toContain('dite dog')
  expect(html).toContain('data-testid="featured-grid"')
  expect(html).toContain('精选作品')
  expect(html).toContain('自设委托')
  expect(html).toContain('角色领养')
  expect(html).toContain('营业状态')

  const workLinks = [...html.matchAll(/href="\/works\/([a-z0-9-]+)"/g)]
  expect(workLinks.length).toBeGreaterThanOrEqual(6)
})

test('hero image reserves dimensions and loads eagerly', async ({ page }) => {
  await page.goto('/')
  const heroImage = page.getByTestId('public-hero').locator('img')

  await expect(heroImage).toHaveAttribute('width', '1920')
  await expect(heroImage).toHaveAttribute('height', '1080')
  await expect(heroImage).toHaveAttribute('loading', 'eager')
  await expect(heroImage).toHaveAttribute('fetchpriority', 'high')
  await expect(heroImage).toHaveAttribute('alt', /.+/)
})

for (const viewport of VIEWPORTS) {
  test(`no horizontal overflow at ${viewport.name} (grid and track)`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })

    for (const url of ['/', '/?featured=track']) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))

      expect(
        metrics.scrollWidth,
        `${url} should not overflow horizontally at ${viewport.name}`,
      ).toBeLessThanOrEqual(metrics.clientWidth + 1)
    }
  })
}

test('mobile nav manages focus, escape and aria state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const trigger = page.getByRole('button', { name: '打开导航' })
  const dialog = page.getByRole('dialog', { name: '站点导航' })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  // 开发模式水合需要时间；打开动作幂等，允许在水合完成前重试点击。
  await expect(async () => {
    await trigger.click()
    await expect(dialog).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 20_000 })

  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(dialog.getByRole('button', { name: '关闭导航' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('featured track scrolls with controls and keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?featured=track')

  const track = page.getByTestId('featured-track')
  await expect(track).toBeVisible()

  const rail = track.getByRole('group', { name: '精选作品横向轨道' })
  const nextButton = track.getByRole('button', { name: '下一批作品' })

  // 等待水合完成后，下一批按钮应把轨道推离起点。
  await expect(async () => {
    await nextButton.click()
    await page.waitForTimeout(500)
    const scrolled = await rail.evaluate(element => element.scrollLeft)
    expect(scrolled).toBeGreaterThan(0)
  }).toPass({ timeout: 20_000 })

  const scrolled = await rail.evaluate(element => element.scrollLeft)

  await rail.focus()
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(600)

  const returned = await rail.evaluate(element => element.scrollLeft)
  expect(returned).toBeLessThan(scrolled)
})

test('featured links are plain work links without autoplay', async ({ page }) => {
  await page.goto('/')

  const featured = page.getByTestId('featured-works')
  const links = featured.locator('a[href^="/works/"]')
  expect(await links.count()).toBe(6)

  const firstHref = await links.first().getAttribute('href')
  expect(firstHref).toMatch(/^\/works\/[a-z0-9-]+$/)
})

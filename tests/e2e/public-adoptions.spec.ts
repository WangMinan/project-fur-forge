import { expect, test } from '@playwright/test'
import { seedPublicCatalog } from './helpers/public-catalog'

const regularSlug = 'e2e-public-regular-adoption'

async function seedAdoptions(page: import('@playwright/test').Page) {
  await seedPublicCatalog(page, [
    {
      slug: regularSlug,
      characterName: '星糖',
      species: '边境牧羊犬',
      suitType: 'full',
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      priceMinorUnits: 1_280_000,
      featureTags: ['正侧背三视图', '蓝紫色板'],
      designSheet: {
        alt: '星糖完整横版设定图，含正面、侧面、背面与色板',
        width: 3200,
        height: 2000,
      },
      photos: [{ alt: '星糖正面出厂照', width: 2400, height: 3200 }],
    },
    {
      slug: 'e2e-public-event-adoption',
      characterName: '展会角色',
      purpose: 'adoption',
      adoptionMethod: 'event_drop',
      businessStatus: 'event_sale',
      eventName: '历史展会',
      eventTime: '历史展会时间',
      designSheet: { alt: '展会角色设定图' },
      photos: [{ alt: '展会角色出厂照' }],
    },
    {
      slug: 'e2e-public-commission-no-design',
      characterName: '委托角色',
      purpose: 'commission',
      photos: [{ alt: '委托角色出厂照' }],
    },
  ])
}

test.beforeEach(async ({ page }) => {
  await seedAdoptions(page)
})

test('只展示 regular adoption 的完整横版设定图、状态、属性和人民币价格', async ({ page }) => {
  await page.goto('/adoptions')

  await expect(page.getByRole('heading', { level: 1, name: '角色领养' })).toBeVisible()
  await expect(page.getByTestId('adoption-status')).toContainText('领养')
  await expect(page.getByRole('status')).toContainText('共 1 个可浏览角色')
  const card = page.locator(`[data-work-slug="${regularSlug}"]`)
  await expect(card).toContainText('星糖')
  await expect(card).toContainText('可领养')
  await expect(card).toContainText('正侧背三视图')
  await expect(card).toContainText('¥12,800')
  await expect(page.locator('[data-work-slug="e2e-public-event-adoption"]')).toHaveCount(0)
  await expect(page.locator('[data-work-slug="e2e-public-commission-no-design"]')).toHaveCount(0)

  const image = card.locator('img')
  await expect(image).toHaveJSProperty('complete', true)
  expect(await image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe('contain')
  const frame = await card.locator('.adoption-card__canvas').boundingBox()
  expect(frame).not.toBeNull()
  expect(frame!.width / frame!.height).toBeGreaterThan(1)
})

test('卡片进入统一详情并明确分开设定图与出厂照', async ({ page }) => {
  await page.goto('/adoptions')
  await page.locator(`[data-work-slug="${regularSlug}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/works/${regularSlug}$`, 'u'))

  await expect(page.getByRole('heading', { level: 2, name: '设定图' })).toBeVisible()
  await expect(page.getByTestId('public-design-sheet')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: '出厂照 / 作品图集' })).toBeVisible()
  await expect(page.getByTestId('work-gallery')).toBeVisible()
  expect(await page.getByTestId('public-design-sheet').locator('img').evaluate(
    node => getComputedStyle(node).objectFit,
  )).toBe('contain')
})

test('普通委托详情不渲染空设定图区', async ({ page }) => {
  await page.goto('/works/e2e-public-commission-no-design')
  await expect(page.getByTestId('public-design-sheet')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: '设定图' })).toHaveCount(0)
  await expect(page.getByTestId('work-gallery')).toBeVisible()
})

test('只有设定图的领养保留在领养页与统一详情，但不进入作品展示', async ({ page }) => {
  const slug = 'e2e-public-design-only-adoption'
  await seedPublicCatalog(page, [{
    slug,
    characterName: '纸飞机',
    purpose: 'adoption',
    adoptionMethod: 'regular',
    businessStatus: 'available',
    designSheet: { alt: '纸飞机完整横版设定图' },
    photos: [],
  }])

  await page.goto('/works')
  await expect(page.locator(`[data-work-slug="${slug}"]`)).toHaveCount(0)
  await page.goto('/adoptions')
  await expect(page.locator(`[data-work-slug="${slug}"]`)).toBeVisible()
  await page.goto(`/works/${slug}`)
  await expect(page.getByTestId('public-design-sheet')).toBeVisible()
  await expect(page.getByTestId('work-gallery')).toHaveCount(0)
})

test('没有已发布 regular adoption 时展示真实空状态', async ({ page }) => {
  await seedPublicCatalog(page, [])
  await page.goto('/adoptions')
  await expect(page.getByTestId('adoption-status')).toContainText('领养')
  const empty = page.getByTestId('public-empty-state')
  await expect(empty).toContainText('当前没有已发布的常规领养')
  await expect(empty).toContainText('浏览作品展示')
  await expect(empty).not.toContainText('功能开发中')
})

test('未公开价格时不渲染价格占位区', async ({ page }) => {
  await seedPublicCatalog(page, [{
    slug: 'e2e-public-adoption-no-price',
    characterName: '无公开价格角色',
    purpose: 'adoption',
    adoptionMethod: 'regular',
    businessStatus: 'available',
    designSheet: { alt: '无公开价格角色完整横版设定图' },
    photos: [{ alt: '无公开价格角色出厂照' }],
  }])
  await page.goto('/adoptions')

  const card = page.locator('[data-work-slug="e2e-public-adoption-no-price"]')
  await expect(card).toBeVisible()
  await expect(card.locator('.adoption-card__price')).toHaveCount(0)
  await expect(card).not.toContainText('价格未公开')
})

test('三视口图片解码、contain、无横向溢出且 DOM 无私有 Key', async ({ page }) => {
  for (const { width, height } of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width, height })
    for (const path of ['/adoptions', `/works/${regularSlug}`]) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const image = path === '/adoptions'
        ? page.locator(`[data-work-slug="${regularSlug}"] img`)
        : page.getByTestId('public-design-sheet').locator('img')
      await expect(image).toHaveJSProperty('complete', true)
      expect(await image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe('contain')
      expect(await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )).toBeLessThanOrEqual(1)
      const dom = await page.content()
      expect(dom).not.toContain('/original/')
      expect(dom).not.toContain('/processing/')
      expect(dom).not.toContain('Signature=')
      expect(dom).not.toContain('ownerContact')
    }
  }
})

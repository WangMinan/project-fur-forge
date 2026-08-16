import { expect, test } from '@playwright/test'
import { seedPublicCatalog } from './helpers/public-catalog'

const regularSlug = 'e2e-public-regular-adoption'

async function seedAdoptions(page: import('@playwright/test').Page) {
  await seedPublicCatalog(page, [
    {
      slug: regularSlug,
      characterName: '星糖',
      species: '边境牧羊犬',
      purpose: 'adoption',
      adoptionStatus: 'available',
      priceCnyMinor: 1_280_000,
      adoptionCover: {
        alt: '星糖独立横版领养封面',
        width: 3200,
        height: 1800,
      },
      designSheet: {
        alt: '星糖完整横版设定图，含正面、侧面、背面与色板',
        width: 3200,
        height: 2000,
      },
      photos: [{ alt: '星糖正面出厂照', width: 2400, height: 3200 }],
    },
    {
      slug: 'e2e-public-event-adoption',
      characterName: '已领养角色',
      species: '龙',
      purpose: 'adoption',
      adoptionStatus: 'adopted',
      priceCnyMinor: 2_500_000,
      adoptionCover: { alt: '已领养角色独立横版封面', width: 1920, height: 1080 },
      designSheet: { alt: '已领养角色设定图' },
      photos: [{ alt: '已领养角色出厂照' }],
    },
    {
      slug: 'e2e-public-second-row-a',
      characterName: '第二行角色甲',
      purpose: 'adoption',
      adoptionStatus: 'available',
      adoptionCover: { alt: '第二行角色甲独立横版封面', width: 1920, height: 1080 },
      designSheet: { alt: '第二行角色甲设定图' },
      photos: [{ alt: '第二行角色甲出厂照' }],
    },
    {
      slug: 'e2e-public-second-row-b',
      characterName: '第二行角色乙',
      purpose: 'adoption',
      adoptionStatus: 'available',
      adoptionCover: { alt: '第二行角色乙独立横版封面', width: 1920, height: 1080 },
      designSheet: { alt: '第二行角色乙设定图' },
      photos: [{ alt: '第二行角色乙出厂照' }],
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

test('默认展示全部领养，并只保留状态、价格、物种与独立封面', async ({ page }) => {
  await page.goto('/adoptions')

  await expect(page).toHaveTitle(/设定领养 · 有点小狗工作室/)
  await expect(page.getByRole('heading', { level: 1, name: '设定领养' })).toBeVisible()
  await expect(page.getByTestId('adoption-status')).toContainText('领养')
  const pagination = page.getByRole('navigation', { name: '设定领养分页' })
  await expect(pagination).toBeVisible()
  await expect(pagination.getByLabel('第 1 页，当前页')).toBeVisible()
  await expect(pagination.locator('[aria-disabled="true"]')).toHaveCount(2)
  const card = page.locator(`[data-work-slug="${regularSlug}"]`)
  await expect(card.locator('.work-identity')).toHaveText('星糖 · 边境牧羊犬')
  await expect(card).toContainText('可领养')
  await expect(card).toContainText('¥12,800')
  const eventCard = page.locator('[data-work-slug="e2e-public-event-adoption"]')
  await expect(eventCard.locator('.work-identity')).toHaveText('已领养角色 · 龙')
  await expect(eventCard).toContainText('已领养')
  await expect(eventCard).not.toContainText(/展会|领养方式/u)
  await expect(card.locator('.adoption-card__status')).toHaveCSS('color', 'rgb(47, 123, 92)')
  await expect(eventCard.locator('.adoption-card__status')).toHaveCSS('color', 'rgb(98, 106, 117)')
  await expect(page.locator('[data-work-slug="e2e-public-commission-no-design"]')).toHaveCount(0)

  const image = card.locator('img')
  await expect(image).toHaveJSProperty('complete', true)
  expect(await image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe('cover')
  const frame = await card.locator('.adoption-card__canvas').boundingBox()
  expect(frame).not.toBeNull()
  expect(frame!.width / frame!.height).toBeGreaterThan(1)
})

test('状态与价格收敛为紧凑信息带，不放大两行图片间距', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/adoptions')

  const firstCard = page.locator(`[data-work-slug="${regularSlug}"]`)
  const eventCard = page.locator('[data-work-slug="e2e-public-event-adoption"]')
  const nextRowCard = page.locator('[data-work-slug="e2e-public-second-row-a"]')
  const firstCanvas = await firstCard.locator('.adoption-card__canvas').boundingBox()
  const nextCanvas = await nextRowCard.locator('.adoption-card__canvas').boundingBox()
  const details = eventCard.locator('.adoption-card__details')

  expect(firstCanvas).not.toBeNull()
  expect(nextCanvas).not.toBeNull()
  await expect(details).toContainText('¥25,000')
  expect(nextCanvas!.y - (firstCanvas!.y + firstCanvas!.height)).toBeLessThanOrEqual(180)
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

test('设定图可选：没有设定图的领养仍有独立封面和出厂照', async ({ page }) => {
  const slug = 'e2e-public-no-design-adoption'
  await seedPublicCatalog(page, [{
    slug,
    characterName: '纸飞机',
    purpose: 'adoption',
    adoptionStatus: 'available',
    adoptionCover: { alt: '纸飞机独立横版领养封面', width: 1920, height: 1080 },
    photos: [{ alt: '纸飞机出厂照' }],
  }])

  await page.goto('/works')
  await expect(page.locator(`[data-work-slug="${slug}"]`)).toBeVisible()
  await page.goto('/adoptions')
  await expect(page.locator(`[data-work-slug="${slug}"]`)).toBeVisible()
  await page.goto(`/works/${slug}`)
  await expect(page.getByTestId('public-design-sheet')).toHaveCount(0)
  await expect(page.getByTestId('work-gallery')).toBeVisible()
})

test('没有已发布领养时展示真实空状态', async ({ page }) => {
  await seedPublicCatalog(page, [])
  await page.goto('/adoptions')
  await expect(page.getByTestId('adoption-status')).toContainText('领养')
  const empty = page.getByTestId('public-empty-state')
  await expect(empty).toContainText('当前没有可领养的角色')
  await expect(empty).toContainText('浏览作品展示')
  await expect(empty).not.toContainText('功能开发中')
})

test('未公开价格时不渲染价格占位区', async ({ page }) => {
  await seedPublicCatalog(page, [{
    slug: 'e2e-public-adoption-no-price',
    characterName: '无公开价格角色',
    purpose: 'adoption',
    adoptionStatus: 'available',
    adoptionCover: { alt: '无公开价格角色独立横版封面', width: 1920, height: 1080 },
    designSheet: { alt: '无公开价格角色完整横版设定图' },
    photos: [{ alt: '无公开价格角色出厂照' }],
  }])
  await page.goto('/adoptions')

  const card = page.locator('[data-work-slug="e2e-public-adoption-no-price"]')
  await expect(card).toBeVisible()
  await expect(card.locator('.adoption-card__price')).toHaveCount(0)
  await expect(card).not.toContainText('价格未公开')
})

test('固定 8 个分页保留名称搜索并在三视口无溢出', async ({ page, request }) => {
  test.setTimeout(120_000)
  await seedPublicCatalog(page, Array.from({ length: 9 }, (_, index) => ({
    slug: `e2e-public-adoption-page-${index + 1}`,
    characterName: `分页领养 ${index + 1}`,
    purpose: 'adoption' as const,
    adoptionStatus: 'available' as const,
    adoptionCover: { alt: `分页领养 ${index + 1} 独立横版封面`, width: 1920, height: 1080 },
    designSheet: { alt: `分页领养 ${index + 1} 设定图` },
    photos: [{ alt: `分页领养 ${index + 1} 出厂照` }],
  })))

  const api = await request.get('/api/public/v1/adoptions?page=2')
  expect(api.status()).toBe(200)
  expect((await api.json()).data).toMatchObject({
    page: 2,
    pageCount: 2,
    pageSize: 8,
    resultCount: 9,
  })

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/adoptions')
    const pagination = page.getByRole('navigation', { name: '设定领养分页' })
    await expect(pagination).toBeVisible()
    await expect(page.locator('[data-work-slug]')).toHaveCount(8)
    await expect(pagination.getByRole('link', { name: '下一页' }))
      .toHaveAttribute('href', '/adoptions?page=2')
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }

  await page.getByRole('navigation', { name: '设定领养分页' })
    .getByRole('link', { name: '下一页' }).click()
  await expect(page).toHaveURL(/page=2$/u)
  await expect(page.locator('[data-work-slug]')).toHaveCount(1)

  await page.goto('/adoptions?page=99')
  await expect(page.getByText('这一页没有可领养角色')).toBeVisible()
  await expect(page.getByRole('link', { name: '回到第一页' }))
    .toHaveAttribute('href', '/adoptions')
})

test('三视口图片解码、contain、无横向溢出且 DOM 无私有 Key', async ({ page }) => {
  for (const { width, height } of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width, height })
    for (const path of ['/adoptions', `/works/${regularSlug}`]) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      const image = path === '/adoptions'
        ? page.locator(`[data-work-slug="${regularSlug}"] img`)
        : page.getByTestId('public-design-sheet').locator('img')
      await expect(image).toHaveJSProperty('complete', true)
      expect(await image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe(
        path === '/adoptions' ? 'cover' : 'contain',
      )
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

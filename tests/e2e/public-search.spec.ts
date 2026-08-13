import { expect, test } from '@playwright/test'
import {
  seedPublicCatalog,
  seedPublicReturns,
} from './helpers/public-catalog'

const search = (page: import('@playwright/test').Page) => page.getByRole('search')

test('作品搜索使用 GET，筛选与分页保留 q，新搜索回到第一页', async ({ page }) => {
  await seedPublicCatalog(page, Array.from({ length: 13 }, (_, index) => ({
    slug: `e2e-public-search-work-${index + 1}`,
    characterName: index === 12 ? 'Mochi 特别版' : `Mochi ${index + 1}`,
    purpose: index === 12 ? 'showcase' as const : 'commission' as const,
    suitType: index % 2 === 0 ? 'full' as const : 'partial' as const,
    photos: [{ alt: `Mochi ${index + 1} 出厂照` }],
  })))

  await page.goto('/works?page=2')
  const input = search(page).getByRole('searchbox', { name: '按设定名称搜索' })
  await input.fill('  moCHI  ')
  await search(page).getByRole('button', { name: '搜索' }).click()
  await expect(page).toHaveURL(/\/works\?q=(?:%20|\+){2}moCHI(?:%20|\+){2}$/u)
  await expect(page.locator('[data-work-slug]')).toHaveCount(12)
  await expect(input).toHaveValue('moCHI')

  const pagination = page.getByRole('navigation', { name: '作品展示分页' })
  await expect(pagination.getByRole('link', { name: '下一页' }))
    .toHaveAttribute('href', '/works?q=moCHI&page=2')
  await expect(page.getByRole('group', { name: '按用途筛选' })
    .getByRole('link', { name: '委托', exact: true }))
    .toHaveAttribute('href', '/works?purpose=commission&q=moCHI')

  await page.getByRole('group', { name: '按用途筛选' })
    .getByRole('link', { name: '展示', exact: true }).click()
  await expect(page).toHaveURL('/works?purpose=showcase&q=moCHI')
  await expect(page.locator('[data-work-slug]')).toHaveCount(1)
  await expect(search(page).getByRole('link', { name: '清除' }))
    .toHaveAttribute('href', '/works?purpose=showcase')
})

test('领养搜索与方式筛选组合，并提供无匹配和清除入口', async ({ page }) => {
  await seedPublicCatalog(page, [
    {
      slug: 'e2e-public-search-regular',
      characterName: '星糖',
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      designSheet: { alt: '星糖设定图' },
      photos: [{ alt: '星糖出厂照' }],
    },
    {
      slug: 'e2e-public-search-event',
      characterName: '星糖展会版',
      purpose: 'adoption',
      adoptionMethod: 'event_drop',
      businessStatus: 'available',
      eventName: '搜索测试展',
      eventTime: '2026 年 8 月',
      designSheet: { alt: '星糖展会版设定图' },
      photos: [{ alt: '星糖展会版出厂照' }],
    },
  ])

  await page.goto('/adoptions?method=regular&page=2')
  await search(page).getByRole('searchbox', { name: '按设定名称搜索' }).fill('星糖')
  await search(page).getByRole('button', { name: '搜索' }).click()
  await expect(page).toHaveURL(`/adoptions?q=${encodeURIComponent('星糖')}&method=regular`)
  await expect(page.locator('[data-work-slug]')).toHaveCount(1)
  await expect(page.getByRole('link', { name: '展会掉落' }))
    .toHaveAttribute('href', `/adoptions?method=event_drop&q=${encodeURIComponent('星糖')}`)

  await page.getByRole('link', { name: '展会掉落' }).click()
  await expect(page.locator('[data-work-slug="e2e-public-search-event"]')).toBeVisible()
  await search(page).getByRole('searchbox', { name: '按设定名称搜索' }).fill('不存在')
  await search(page).getByRole('button', { name: '搜索' }).click()
  await expect(page.getByText('没有找到这个设定')).toBeVisible()
  await expect(page.getByRole('link', { name: '清除搜索' }))
    .toHaveAttribute('href', '/adoptions?method=event_drop')
})

test('返图按设定名称命中全部照片，过滤后保留 seed 分页', async ({ page, request }) => {
  test.setTimeout(120_000)
  await seedPublicReturns(page, [
    {
      name: 'Mochi 云朵',
      slug: 'e2e-search-mochi',
      photos: Array.from({ length: 25 }, (_, index) => ({
        alt: `Mochi 云朵返图 ${index + 1}`,
      })),
    },
    {
      name: '芝麻',
      slug: 'e2e-search-sesame',
      photos: [{ alt: '芝麻返图' }],
    },
  ])

  const first = await request.get('/api/public/v1/returns?q=moCHI')
  expect(first.status()).toBe(200)
  const firstData = (await first.json()).data as {
    items: Array<{ character: { name: string } }>
    pageCount: number
    resultCount: number
    seed: string
  }
  expect(firstData).toMatchObject({ pageCount: 2, resultCount: 25 })
  expect(firstData.items).toHaveLength(24)
  expect(firstData.items.every(item => item.character.name === 'Mochi 云朵')).toBe(true)

  await page.goto(`/returns?q=moCHI&seed=${firstData.seed}`)
  const pagination = page.getByRole('navigation', { name: '返图墙分页' })
  await expect(pagination.getByRole('link', { name: '下一页' })).toHaveAttribute(
    'href',
    `/returns?q=moCHI&seed=${firstData.seed}&page=2`,
  )
  await expect(search(page).getByRole('searchbox', { name: '按设定名称搜索' }))
    .toHaveValue('moCHI')

  await search(page).getByRole('searchbox', { name: '按设定名称搜索' }).fill('芝麻')
  await search(page).getByRole('button', { name: '搜索' }).click()
  await expect(page).toHaveURL(`/returns?q=${encodeURIComponent('芝麻')}`)
  const next = await request.get(`/api/public/v1/returns?q=${encodeURIComponent('芝麻')}`)
  expect(next.status()).toBe(200)
  expect(((await next.json()).data as { seed: string }).seed).not.toBe(firstData.seed)
  await expect(page.locator('[data-return-id]')).toHaveCount(1)
})

test('非法与超长 q 返回受控空态，三个视口键盘可用且无溢出', async ({ page }) => {
  await seedPublicCatalog(page, [{
    slug: 'e2e-public-search-viewport',
    characterName: '视口搜索',
    purpose: 'showcase',
    photos: [{ alt: '视口搜索出厂照' }],
  }])

  for (const path of [
    '/works?q=视口搜索&q=重复',
    `/adoptions?q=${'犬'.repeat(101)}`,
    '/returns?q=视口&q=重复',
  ]) {
    await page.goto(path)
    await expect(page.getByText('搜索条件无效')).toBeVisible()
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/works')
    const input = search(page).getByRole('searchbox', { name: '按设定名称搜索' })
    await input.focus()
    await expect(input).toBeFocused()
    await expect(page.getByText('按设定名称搜索', { exact: true })).toHaveCount(0)
    await expect(input).toHaveAttribute('aria-label', '按设定名称搜索')
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)

    if (viewport.width === 1440) {
      const searchBox = await search(page).boundingBox()
      const filterBox = await page.getByRole('group', { name: '按用途筛选' }).boundingBox()
      expect(searchBox).not.toBeNull()
      expect(filterBox).not.toBeNull()
      expect(Math.abs(searchBox!.y - filterBox!.y)).toBeLessThanOrEqual(2)

      await page.goto('/adoptions')
      const adoptionSearchBox = await search(page).boundingBox()
      const adoptionFilterBox = await page.getByRole('group', { name: '领养方式筛选' })
        .boundingBox()
      expect(adoptionSearchBox).not.toBeNull()
      expect(adoptionFilterBox).not.toBeNull()
      expect(Math.abs(adoptionSearchBox!.y - adoptionFilterBox!.y)).toBeLessThanOrEqual(2)
    }
  }
})

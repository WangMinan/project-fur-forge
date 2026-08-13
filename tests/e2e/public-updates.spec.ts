import { expect, test } from '@playwright/test'
import { publicBaseURL } from './helpers/auth'
import { seedPublicUpdates } from './helpers/public-updates'

test('公开动态只显示 published，按发布时间倒序并以纯文本呈现', async ({ page }) => {
  const now = Date.now()
  await seedPublicUpdates(page, [
    {
      type: 'event',
      title: 'E2E 公开动态较早',
      content: '较早正文',
      publishedAt: now,
    },
    {
      type: 'drop',
      title: 'E2E 公开动态最新',
      content: '第一行\n第二行 & 不作为 HTML',
      publishedAt: now + 1000,
    },
    {
      type: 'other',
      title: 'E2E 公开动态草稿',
      content: '不应公开',
      publicationStatus: 'draft',
    },
    {
      type: 'commission_open',
      title: 'E2E 公开动态下架',
      content: '不应公开',
      publicationStatus: 'unpublished',
      publishedAt: now + 2000,
    },
  ])

  await page.goto('/updates')
  const items = page.locator('[data-update-id]')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText('E2E 公开动态最新')
  await expect(items.nth(1)).toContainText('E2E 公开动态较早')
  await expect(page.getByText('E2E 公开动态草稿')).toHaveCount(0)
  await expect(page.getByText('E2E 公开动态下架')).toHaveCount(0)
  await expect(items.nth(0).locator('.update-list__content'))
    .toHaveCSS('white-space', 'pre-wrap')
  await expect(items.nth(0).locator('.public-update-card'))
    .toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${publicBaseURL}/updates`,
  )
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /参展资讯/u,
  )
})

test('公开动态按固定类型筛选，并以文字和不同颜色圆点共同区分类型', async ({ page }) => {
  await seedPublicUpdates(page, [
    { type: 'event', title: 'E2E 公开动态参展资讯筛选', content: '参展正文' },
    { type: 'drop', title: 'E2E 公开动态掉落预告筛选', content: '掉落正文' },
    { type: 'commission_open', title: 'E2E 公开动态开单通知筛选', content: '开单正文' },
    { type: 'other', title: 'E2E 公开动态其它筛选', content: '其它正文' },
  ])

  await page.goto('/updates')
  const filter = page.getByRole('group', { name: '资讯类型筛选' })
  await expect(filter.getByRole('link')).toHaveCount(5)
  await expect(page.locator('[data-update-id]')).toHaveCount(4)

  const dotColors = await page.locator('.public-update-card__dot').evaluateAll(dots => (
    dots.map(dot => getComputedStyle(dot).backgroundColor)
  ))
  expect(new Set(dotColors).size).toBe(4)

  await filter.getByRole('link', { name: '参展资讯' }).click()
  await expect(page).toHaveURL('/updates?type=event')
  await expect(page.locator('[data-update-id]')).toHaveCount(1)
  await expect(page.getByText('E2E 公开动态参展资讯筛选')).toBeVisible()
  await expect(page.getByText('E2E 公开动态掉落预告筛选')).toHaveCount(0)

  await page.reload()
  await expect(filter.getByRole('link', { name: '参展资讯' }))
    .toHaveAttribute('aria-current', 'true')
  await filter.getByRole('link', { name: '全部' }).click()
  await expect(page).toHaveURL('/updates')
  await expect(page.locator('[data-update-id]')).toHaveCount(4)
})

test('公开动态空态和 API 失败态受控显示', async ({ page }) => {
  await seedPublicUpdates(page, [])
  await page.goto('/updates')
  await expect(page.getByTestId('public-empty-state'))
    .toContainText('暂时没有公开动态')

  await page.route('**/api/public/v1/updates', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({
      error: { code: 'INTERNAL_ERROR', message: 'unavailable' },
    }),
  }))
  await page.evaluate(() => {
    const root = document.querySelector('#__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $router: { push(path: string): void } } } }
    }
    root.__vue_app__.config.globalProperties.$router.push('/about')
  })
  await page.waitForURL('**/about')
  await page.evaluate(() => {
    const root = document.querySelector('#__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $router: { push(path: string): void } } } }
    }
    root.__vue_app__.config.globalProperties.$router.push('/updates')
  })
  await page.waitForURL('**/updates')
  await expect(page.getByTestId('public-empty-state'))
    .toContainText('最新动态暂时无法显示')
})

test('公开动态三视口无横向溢出且时间语义可读', async ({ page }) => {
  await seedPublicUpdates(page, [{
    type: 'commission_open',
    title: 'E2E 公开动态超长但可换行标题'.repeat(4),
    content: '包含很长的连续内容也必须换行：abcdefghijklmnopqrstuvwxyz0123456789'.repeat(5),
  }])
  await page.goto('/updates')

  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    await expect(page.getByTestId('public-update-list')).toBeVisible()
    await expect(page.locator('time[datetime]')).toBeVisible()
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }
})

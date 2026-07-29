import { expect, test } from '@playwright/test'

const card = (page: import('@playwright/test').Page, slug: string) =>
  page.locator(`[data-work-slug="${slug}"]`)

test.describe('T06 作品列表页', () => {
  test('默认展示 6 件作品、结果数与筛选入口', async ({ page }) => {
    await page.goto('/works')

    await expect(page).toHaveTitle(/作品展示 · 有点小狗工作室/)
    await expect(page.getByRole('heading', { level: 1, name: '作品展示' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('共 6 件作品')

    await expect(page.getByRole('link', { name: '全部用途' })).toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('link', { name: '全部装型' })).toHaveAttribute('aria-current', 'true')

    for (const slug of ['blueberry', 'zhima', 'doudou', 'keke', 'lizi', 'naigai']) {
      await expect(card(page, slug)).toBeVisible()
    }
  })

  test('用途筛选：领养 → 只剩蓝莓，URL 与状态同步', async ({ page }) => {
    await page.goto('/works')
    await page.getByRole('link', { name: '领养', exact: true }).click()

    await expect(page).toHaveURL(/purpose=adoption/)
    await expect(page.getByRole('status')).toContainText('共 1 件作品')
    await expect(card(page, 'blueberry')).toBeVisible()
    await expect(card(page, 'zhima')).toHaveCount(0)
    await expect(page.getByRole('link', { name: '领养', exact: true })).toHaveAttribute('aria-current', 'true')
  })

  test('装型筛选：半装 → 豆豆与栗子', async ({ page }) => {
    await page.goto('/works?suit=partial')
    await expect(page.getByRole('status')).toContainText('共 2 件作品')
    await expect(card(page, 'doudou')).toBeVisible()
    await expect(card(page, 'lizi')).toBeVisible()
  })

  test('交集为空时展示空状态与清除筛选链接', async ({ page }) => {
    await page.goto('/works?purpose=adoption&suit=partial')
    await expect(page.getByRole('status')).toContainText('共 0 件作品')
    await expect(page.getByText('没有符合条件的作品')).toBeVisible()
    const clear = page.getByRole('link', { name: '清除筛选，查看全部作品' })
    await expect(clear).toBeVisible()
    await clear.click()
    await expect(page.getByRole('status')).toContainText('共 6 件作品')
  })

  test('非法筛选参数被忽略并按未筛选处理', async ({ page }) => {
    await page.goto('/works?purpose=bogus&suit=nope')
    await expect(page.getByRole('status')).toContainText('共 6 件作品')
  })

  test('页面无横向溢出', async ({ page }) => {
    await page.goto('/works')
    const overflow = await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('SSR 直出包含列表内容', async ({ request }) => {
    const response = await request.get('/works')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('作品展示')
    expect(html).toContain('共 6 件作品')
    expect(html).toContain('/works/blueberry')
  })
})

test.describe('T06 作品详情页', () => {
  test('从列表进入奶盖详情：主图、图集、事实与短属性齐备', async ({ page }) => {
    await page.goto('/works')
    await card(page, 'naigai').click()

    await expect(page).toHaveURL(/\/works\/naigai$/)
    await expect(page).toHaveTitle(/奶盖 · 作品展示/)
    await expect(page.getByRole('heading', { level: 1, name: '奶盖' })).toBeVisible()
    await expect(page.getByText('布偶猫 · 全装 · 展示作品')).toBeVisible()
    // dev 下 SSR 页面需等待 chunk 加载完成、Vue 水合后才能响应点击。
    await page.waitForLoadState('networkidle')

    const thumbs = page.getByRole('button', { name: /查看第 \d 张，共 4 张/ })
    await expect(thumbs).toHaveCount(4)
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'true')
    await thumbs.nth(1).click()
    await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'false')

    await expect(page.getByText('蓬松尾')).toBeVisible()
    await expect(page.getByText('可拆围脖')).toBeVisible()
    await expect(page.getByRole('heading', { name: '继续浏览' })).toBeVisible()
  })

  test('蓝莓（领养）：展示领养事实与 CNY 价格，含免责声明', async ({ page }) => {
    await page.goto('/works/blueberry')
    await expect(page.getByText('展会掉落')).toBeVisible()
    await expect(page.getByText('可领养')).toBeVisible()
    await expect(page.getByRole('heading', { name: '掉落价格' })).toBeVisible()
    await expect(page.getByText('¥15,600')).toBeVisible()
    await expect(page.getByText(/网站不接受登记、定金或付款/)).toBeVisible()
  })

  // T08 F2：PC 端纵向主图限高，一屏内完整可见、不裁切（2026-07-30 用户反馈）。
  test('PC 端纵向主图限高在一屏可用空间内', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/works/naigai')
    await page.waitForLoadState('networkidle')

    const box = await page.locator('.work-gallery__image').boundingBox()
    expect(box).not.toBeNull()
    // clamp(20rem, 100vh - 15rem, 46rem)：1440×900 下为 900 - 240 = 660px
    expect(box!.height).toBeLessThanOrEqual(661)
  })

  test('未知 slug 返回完整的 HTML 404 页面', async ({ page }) => {
    const response = await page.goto('/works/not-exist')

    expect(response?.status()).toBe(404)
    expect(response?.headers()['content-type']).toContain('text/html')
    await expect(page).toHaveTitle(/404 · 页面未找到/)
    await expect(page.getByRole('heading', {
      level: 1,
      name: '页面未找到',
    })).toBeVisible()
    await expect(page.getByText(
      '访问的页面不存在、尚未发布或已经下架。',
    )).toBeVisible()
  })

  test('页面异常返回完整的 HTML 500 页面且不回显内部异常', async ({
    page,
  }) => {
    const response = await page.goto('/__test__/page-error')

    expect(response?.status()).toBe(500)
    expect(response?.headers()['content-type']).toContain('text/html')
    await expect(page).toHaveTitle(/500 · 页面暂时无法显示/)
    await expect(page.getByRole('heading', {
      level: 1,
      name: '页面暂时无法显示',
    })).toBeVisible()
    await expect(page.getByText(
      '服务器暂时无法完成请求，请稍后重试。',
    )).toBeVisible()
    expect(await page.content()).not.toContain('test-contact@example.invalid')
  })

  test('SSR 直出包含详情内容与 SEO 描述', async ({ request }) => {
    const response = await request.get('/works/blueberry')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('蓝莓')
    expect(html).toContain('¥15,600')
    expect(html).toContain('og:title')
  })
})

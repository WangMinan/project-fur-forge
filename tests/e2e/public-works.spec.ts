import { expect, test } from '@playwright/test'
import type { SeedWork } from './helpers/public-catalog'
import { seedPublicCatalog } from './helpers/public-catalog'
import { createWorkViaApi } from './helpers/admin-work'
import { loginAsAdmin } from './helpers/auth'
import { capture } from './helpers/screenshots'

const SCREENSHOT_DIR =
  'agent_docs/需求1-兽装工作室主页/implementation/notes/t19-t22/t19-t20/screenshots'

/**
 * T19/T20 公开作品页：真实已发布投影（种子经控制面直写 SQLite + fake OSS），
 * 覆盖 SSR、筛选、空态、非法参数、图集、相关浏览、404/500 与泄漏检查。
 */

const card = (page: import('@playwright/test').Page, slug: string) =>
  page.locator(`[data-work-slug="${slug}"]`)

const CATALOG: SeedWork[] = [
  {
    slug: 'e2e-public-lanmei',
    characterName: '蓝湄',
    species: '北极狐',
    suitType: 'full',
    purpose: 'adoption',
    adoptionMethod: 'event_drop',
    businessStatus: 'available',
    priceMinorUnits: 1_560_000,
    featureTags: ['纯海绵头', '内置风扇'],
    featured: true,
    sortOrder: 0,
    photos: [
      { alt: '蓝湄坐在草地上的出厂照', width: 3200, height: 2400 },
      { alt: '蓝湄站立侧身出厂照', width: 2400, height: 3200 },
    ],
  },
  {
    slug: 'e2e-public-zhima',
    characterName: '芝麻',
    species: '哈士奇',
    suitType: 'full',
    purpose: 'commission',
    ownerDisplay: '阿灰',
    featureTags: ['可动颚'],
    featured: true,
    sortOrder: 1,
    photos: [{ alt: '芝麻的出厂照' }],
  },
  {
    slug: 'e2e-public-doudou',
    characterName: '豆豆',
    species: '柴犬',
    suitType: 'partial',
    purpose: 'commission',
    sortOrder: 2,
    photos: [{ alt: '豆豆的出厂照' }],
  },
  {
    slug: 'e2e-public-lizi',
    characterName: '栗子',
    species: '小熊',
    suitType: 'partial',
    purpose: 'showcase',
    featured: true,
    sortOrder: 3,
    photos: [{ alt: '栗子的出厂照' }],
  },
]

async function seedCatalog(page: import('@playwright/test').Page) {
  await seedPublicCatalog(page, CATALOG)
}

test.describe('T20 作品列表页', () => {
  test('默认按人工顺序展示已发布作品、结果数与筛选入口', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works')

    await expect(page).toHaveTitle(/作品展示 · 有点小狗工作室/)
    await expect(page.getByRole('heading', { level: 1, name: '作品展示' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('共 4 件作品')

    await expect(page.getByRole('link', { name: '全部用途' })).toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('link', { name: '全部装型' })).toHaveAttribute('aria-current', 'true')

    const filterAppearance = await page.getByRole('group', { name: '按用途筛选' }).evaluate((group) => {
      const active = group.querySelector<HTMLElement>('[aria-current="true"]')!
      const groupStyle = getComputedStyle(group)
      const activeStyle = getComputedStyle(active)
      return {
        groupBorderStyle: groupStyle.borderStyle,
        groupShadow: groupStyle.boxShadow,
        activeBackground: activeStyle.backgroundColor,
        activeBorderStyle: activeStyle.borderStyle,
        activeShadow: activeStyle.boxShadow,
      }
    })
    expect(filterAppearance.groupBorderStyle).toBe('solid')
    expect(filterAppearance.groupShadow).not.toBe('none')
    expect(filterAppearance.activeBackground).not.toBe('rgba(0, 0, 0, 0)')
    expect(filterAppearance.activeBorderStyle).toBe('solid')
    expect(filterAppearance.activeShadow).not.toBe('none')

    const slugs = await page.locator('[data-work-slug]').evaluateAll(
      cards => cards.map(card => card.getAttribute('data-work-slug')),
    )
    expect(slugs).toEqual([
      'e2e-public-lanmei',
      'e2e-public-zhima',
      'e2e-public-doudou',
      'e2e-public-lizi',
    ])
  })

  test('卡片为普通作品链接且图片框保持 3:4', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works')

    const first = card(page, 'e2e-public-lanmei')
    await expect(first).toHaveAttribute('href', '/works/e2e-public-lanmei')

    const frame = first.locator('.work-card__frame')
    const box = await frame.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height / box!.width).toBeCloseTo(4 / 3, 2)
  })

  test('用途筛选：commission 只剩两件，URL 与选中态同步', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works')
    await page.getByRole('link', { name: '委托', exact: true }).click()

    await expect(page).toHaveURL(/purpose=commission/)
    await expect(page.getByRole('status')).toContainText('共 2 件作品')
    await expect(card(page, 'e2e-public-zhima')).toBeVisible()
    await expect(card(page, 'e2e-public-doudou')).toBeVisible()
    await expect(card(page, 'e2e-public-lanmei')).toHaveCount(0)
    await expect(page.getByRole('link', { name: '委托', exact: true })).toHaveAttribute('aria-current', 'true')
  })

  test('装型筛选：suitType=partial 只剩豆豆与栗子', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works?suitType=partial')
    await expect(page.getByRole('status')).toContainText('共 2 件作品')
    await expect(card(page, 'e2e-public-doudou')).toBeVisible()
    await expect(card(page, 'e2e-public-lizi')).toBeVisible()
    await expect(page.getByRole('link', { name: '半装', exact: true })).toHaveAttribute('aria-current', 'true')
  })

  test('交集为空时展示空状态与清除筛选链接', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works?purpose=adoption&suitType=partial')
    await expect(page.getByRole('status')).toContainText('共 0 件作品')
    await expect(page.getByText('没有符合条件的作品')).toBeVisible()
    const clear = page.getByRole('link', { name: '清除筛选' })
    await expect(clear).toBeVisible()
    await clear.click()
    await expect(page.getByRole('status')).toContainText('共 4 件作品')
  })

  test('非法筛选参数返回空结果并复位筛选选中态', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works?purpose=bogus&suitType=nope')
    await expect(page.getByRole('status')).toContainText('共 0 件作品')
    await expect(page.getByText('没有符合条件的作品')).toBeVisible()
    await expect(page.getByText(/当前筛选条件无效/)).toBeVisible()
    await expect(page.getByRole('link', { name: '全部用途' })).toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('link', { name: '全部装型' })).toHaveAttribute('aria-current', 'true')
  })

  test('没有任何已发布作品时展示整理中空态', async ({ page }) => {
    await seedPublicCatalog(page, [])
    await page.goto('/works')
    await expect(page.getByText('作品正在整理中，请稍后再来。')).toBeVisible()
    await expect(page.getByRole('status')).toContainText('共 0 件作品')
  })

  test('页面无横向溢出', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works')
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('三视口图片真实解码、无横向溢出并留存列表与详情证据', async ({ page }) => {
    test.setTimeout(120_000)
    await seedCatalog(page)
    for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height })
      for (const [path, name] of [
        ['/works', `works-${width}x${height}`],
        ['/works/e2e-public-lanmei', `work-detail-${width}x${height}`],
      ] as const) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const coreImage = path === '/works'
          ? page.locator('[data-work-slug="e2e-public-lanmei"] img')
          : page.locator('.work-gallery__stage img')
        await expect(coreImage).toHaveJSProperty('complete', true)
        expect(await coreImage.evaluate(
          (node: HTMLImageElement) => node.naturalWidth,
        )).toBeGreaterThan(0)
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBeLessThanOrEqual(1)
        await page.evaluate(() => window.scrollTo(0, 0))
        await capture(page, name, SCREENSHOT_DIR)
      }
    }
  })

  test('SSR 直出包含列表内容且不含私有字段', async ({ page, request }) => {
    await seedCatalog(page)
    const response = await request.get('/works')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('作品展示')
    expect(html).toContain('共 4 件作品')
    for (const work of CATALOG) {
      expect(html).toContain(`href="/works/${work.slug}"`)
    }
    // 卡片图片为公开衍生图 srcset，不含私有对象键或签名 URL
    expect(html).toContain('http://127.0.0.2:')
    expect(html).not.toContain('test/e2e-public/original')
    expect(html).not.toContain('private-download.test')
    expect(html).not.toContain('e2e-private-contact')
    expect(html).toContain('mailto:3114559925@qq.com')
    expect(html).toContain('QQ 3114559925')
  })
})

test.describe('T19 作品详情页', () => {
  test('核心内容齐备：事实、短属性、图集切换与相关浏览', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works')
    await card(page, 'e2e-public-lanmei').click()

    await expect(page).toHaveURL(/\/works\/e2e-public-lanmei$/)
    await expect(page).toHaveTitle(/蓝湄 · 作品展示 · 有点小狗工作室/)
    await expect(page.getByRole('heading', { level: 1, name: '蓝湄' })).toBeVisible()
    await expect(page.getByText('北极狐 · 全装 · 领养作品')).toBeVisible()

    const facts = page.getByTestId('work-facts')
    await expect(facts).toContainText('物种')
    await expect(facts).toContainText('北极狐')
    await expect(facts).toContainText('装型')
    await expect(facts).toContainText('全装')
    await expect(facts).toContainText('角色主人')
    await expect(facts).toContainText('不公开')
    await expect(facts).toContainText('领养方式')
    await expect(facts).toContainText('展会掉落')
    await expect(facts).toContainText('业务状态')
    await expect(facts).toContainText('可领养')

    await expect(page.getByText('纯海绵头')).toBeVisible()
    await expect(page.getByText('内置风扇')).toBeVisible()

    const price = page.getByTestId('work-price')
    await expect(price).toContainText('掉落价格')
    await expect(price).toContainText('¥15,600')
    await expect(price).toContainText(/网站不接受登记、定金或付款/)

    // 领养作品图集处于“出厂照”结构分区内
    await expect(page.locator('section[aria-label="出厂照"] [data-testid="work-gallery"]')).toBeVisible()

    const thumbs = page.getByRole('button', { name: /查看第 \d 张，共 2 张/ })
    await expect(thumbs).toHaveCount(2)
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'true')
    await thumbs.nth(1).click()
    await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'false')

    // 相关浏览：不含自身，同用途优先
    const related = page.locator('.work-detail__related-grid a[href^="/works/"]')
    expect(await related.count()).toBeGreaterThanOrEqual(1)
    await expect(page.locator('.work-detail__related-grid a[href="/works/e2e-public-lanmei"]')).toHaveCount(0)

    // 返回链接
    await expect(page.getByRole('link', { name: '返回作品展示' })).toHaveAttribute('href', '/works')
  })

  test('委托作品展示主人公开值，无价格区', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works/e2e-public-zhima')
    await expect(page.getByTestId('work-facts')).toContainText('阿灰')
    await expect(page.getByTestId('work-price')).toHaveCount(0)
    await expect(page.getByText('可动颚')).toBeVisible()
  })

  test('SSR 直出包含详情内容、公开 srcset 与 SEO 描述', async ({ page, request }) => {
    await seedCatalog(page)
    const response = await request.get('/works/e2e-public-lanmei')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('蓝湄')
    expect(html).toContain('¥15,600')
    expect(html).toContain('og:title')
    expect(html).toContain('蓝湄坐在草地上的出厂照')
    // detail 衍生图宽度描述符
    expect(html).toContain('960w')
    expect(html).toContain('2400w')
    // 相关浏览链接 SSR 直出
    expect(html).toContain('href="/works/e2e-public-zhima"')
  })

  test('详情页不泄漏联系人、私有键、签名 URL 与草稿对象', async ({ page, request }) => {
    await seedCatalog(page)
    await loginAsAdmin(page)
    const draft = await createWorkViaApi(page, {
      characterName: '草稿角色',
      slug: `e2e-public-draft-${Date.now().toString(36)}`,
    })

    const response = await request.get('/works/e2e-public-lanmei')
    const html = await response.text()
    expect(html).not.toContain('e2e-private-contact')
    expect(html).not.toContain('ownerContact')
    expect(html).not.toContain('test/e2e-public/original')
    expect(html).not.toContain('private-download.test')
    expect(html).not.toContain(draft.slug)
    expect(html).not.toContain('草稿角色')

    // 草稿详情对公开侧为 404
    const draftResponse = await request.get(`/works/${draft.slug}`)
    expect(draftResponse.status()).toBe(404)
  })

  test('未知 slug 返回完整的 HTML 404 页面', async ({ page }) => {
    await seedCatalog(page)
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

  // T08 F2：PC 端纵向主图限高，一屏内完整可见、不裁切（2026-07-30 用户反馈）。
  test('PC 端纵向主图限高在一屏可用空间内', async ({ page }) => {
    await seedPublicCatalog(page, [{
      slug: 'e2e-public-tall',
      characterName: '高挑',
      species: '犬科',
      suitType: 'full',
      purpose: 'showcase',
      sortOrder: 0,
      photos: [{ alt: '高挑的纵向出厂照', width: 2400, height: 3200 }],
    }])
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/works/e2e-public-tall')
    await page.waitForLoadState('networkidle')

    const box = await page.locator('.work-gallery__image').boundingBox()
    expect(box).not.toBeNull()
    // clamp(20rem, 100vh - 15rem, 46rem)：1440×900 下为 900 - 240 = 660px
    expect(box!.height).toBeLessThanOrEqual(661)
  })
})

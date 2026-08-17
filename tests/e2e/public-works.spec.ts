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
    purpose: 'adoption',
    adoptionStatus: 'available',
    priceCnyMinor: 1_560_000,
    adoptionCover: { alt: '蓝湄独立横版领养封面', width: 1920, height: 1080 },
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
    purpose: 'commission',
    featured: true,
    sortOrder: 1,
    photos: [{ alt: '芝麻的出厂照' }],
  },
  {
    slug: 'e2e-public-doudou',
    characterName: '豆豆',
    species: '柴犬',
    purpose: 'commission',
    sortOrder: 2,
    photos: [{ alt: '豆豆的出厂照' }],
  },
  {
    slug: 'e2e-public-lizi',
    characterName: '栗子',
    species: '小熊',
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
  test('默认按发布时间倒序展示已发布作品与名称搜索，不显示结果总数', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works')

    await expect(page).toHaveTitle(/作品展示 · 有点小狗工作室/)
    await expect(page.getByRole('heading', { level: 1, name: '作品展示' })).toBeVisible()
    await expect(page.getByText(/^共 \d+ 件作品$/u)).toHaveCount(0)
    const pagination = page.getByRole('navigation', { name: '作品展示分页' })
    await expect(pagination).toBeVisible()
    await expect(pagination.getByLabel('第 1 页，当前页')).toBeVisible()
    await expect(pagination.locator('[aria-disabled="true"]')).toHaveCount(2)

    await expect(page.getByRole('group', { name: /按用途筛选|按装型筛选/u })).toHaveCount(0)

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport)
      const titleBox = await page.getByRole('heading', {
        level: 1,
        name: '作品展示',
      }).boundingBox()
      const searchBox = await page.getByRole('search').boundingBox()
      expect(titleBox).not.toBeNull()
      expect(searchBox).not.toBeNull()
      expect(searchBox!.y - (titleBox!.y + titleBox!.height))
        .toBeLessThanOrEqual(32)
    }

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

  test('卡片为普通作品链接且竖版图片框保持 3:4', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works')

    const first = card(page, 'e2e-public-lanmei')
    await expect(first).toHaveAttribute('href', '/works/e2e-public-lanmei')
    await expect(first.locator('.work-identity')).toHaveText('蓝湄 · 北极狐')

    const frame = first.locator('.work-card__frame')
    await expect(frame).toHaveAttribute('data-orientation', 'portrait')
    const box = await frame.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height / box!.width).toBeCloseTo(4 / 3, 2)
  })

  test('FU-17：横竖卡片等高铺满，横版更宽且右边缘对齐', async ({ page }) => {
    // 第一件只做了单头（只有横版领养封面），其余是竖版出厂照，构成混排。
    await seedPublicCatalog(page, [
      {
        slug: 'e2e-public-headonly',
        characterName: '小绿狗',
        species: '狗',
        purpose: 'adoption',
        adoptionStatus: 'available',
        adoptionCover: { alt: '小绿狗横版领养封面', width: 1920, height: 1080 },
        featured: true,
        sortOrder: 0,
        photos: [],
      },
      {
        slug: 'e2e-public-mixed-a',
        characterName: '竖版甲',
        purpose: 'commission',
        featured: true,
        sortOrder: 1,
        photos: [{ alt: '竖版甲出厂照', width: 2400, height: 3200 }],
      },
      {
        slug: 'e2e-public-mixed-b',
        characterName: '竖版乙',
        purpose: 'commission',
        featured: true,
        sortOrder: 2,
        photos: [{ alt: '竖版乙出厂照', width: 2400, height: 3200 }],
      },
    ])

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/works')
    const headOnly = card(page, 'e2e-public-headonly')
    await expect(headOnly).toBeVisible()
    await expect(headOnly.locator('.work-identity')).toHaveText('小绿狗 · 狗')
    await expect(headOnly.locator('.work-card__frame'))
      .toHaveAttribute('data-orientation', 'landscape')

    const layout = await page.locator('.works-grid').evaluate((grid) => {
      const frames = Array.from(grid.querySelectorAll('.work-card__frame'))
        .map(frame => frame.getBoundingClientRect())
      const gridBox = grid.getBoundingClientRect()
      // 只比较第一行：取 top 与首张一致的卡片。
      const firstRow = frames.filter(box => Math.abs(box.top - frames[0]!.top) < 2)
      return {
        rowCount: firstRow.length,
        heights: firstRow.map(box => Math.round(box.height)),
        ratios: firstRow.map(box => +(box.width / box.height).toFixed(2)),
        rightGap: Math.round(gridBox.right - firstRow.at(-1)!.right),
      }
    })

    // 等高：同一行内高度完全一致。
    expect(layout.rowCount).toBe(3)
    expect(new Set(layout.heights).size).toBe(1)
    // 横版明显更宽，且两种比例都未被压缩。
    expect(layout.ratios[0]).toBeCloseTo(16 / 9, 1)
    expect(layout.ratios[1]).toBeCloseTo(3 / 4, 1)
    // 铺满：行尾与容器右边缘对齐，不留大面积空白。
    expect(layout.rightGap).toBeLessThanOrEqual(2)
    expect(await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )).toBeLessThanOrEqual(1)

    // 首页精选轨道同样等高。
    await page.goto('/')
    const trackHeights = await page.getByTestId('featured-track').evaluate(track =>
      Array.from(track.querySelectorAll('.work-card__frame'))
        .map(frame => Math.round(frame.getBoundingClientRect().height)),
    )
    expect(trackHeights.length).toBeGreaterThanOrEqual(2)
    expect(new Set(trackHeights).size).toBe(1)

    // 详情在唯一的图集区展示领养封面；只有一张时不出现缩略图行。
    await page.goto('/works/e2e-public-headonly')
    const stage = page.locator('[data-testid="work-gallery"] .work-gallery__stage img')
    await expect(stage).toHaveAttribute('alt', '小绿狗横版领养封面')
    await expect(page.getByRole('button', { name: /查看第/u })).toHaveCount(0)
    await expect(page.getByTestId('work-detail-adoption-cover')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 2, name: '领养封面' })).toHaveCount(0)

    // /adoptions 卡片仍固定横版进入。
    await page.goto('/adoptions')
    await expect(card(page, 'e2e-public-headonly')).toBeVisible()
  })

  test('内部用途不进入公开列表筛选或卡片', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works')
    await expect(card(page, 'e2e-public-zhima')).toBeVisible()
    await expect(card(page, 'e2e-public-doudou')).toBeVisible()
    await expect(card(page, 'e2e-public-lanmei')).toBeVisible()
    await expect(page.getByRole('group', { name: '按用途筛选' })).toHaveCount(0)
    await expect(page.getByText(/委托作品|领养作品|展示作品/u)).toHaveCount(0)
  })

  test('名称搜索只返回匹配作品', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works?q=豆豆')
    await expect(card(page, 'e2e-public-doudou')).toBeVisible()
    await expect(card(page, 'e2e-public-lizi')).toHaveCount(0)
    await expect(card(page, 'e2e-public-lanmei')).toHaveCount(0)
  })

  test('搜索无匹配时展示空状态与清除搜索链接', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works?q=不存在')
    await expect(page.getByText('没有找到这个设定')).toBeVisible()
    const clear = page.getByRole('link', { name: '清除搜索' })
    await expect(clear).toBeVisible()
    await clear.click()
    await expect(page.getByText(/^共 \d+ 件作品$/u)).toHaveCount(0)
  })

  test('已退役筛选参数不改变公开目录结果', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works?purpose=bogus&suitType=nope')
    await expect(page.locator('[data-work-slug]')).toHaveCount(4)
    await expect(page.getByRole('group', { name: /按用途筛选|按装型筛选/u })).toHaveCount(0)
  })

  test('没有任何已发布作品时展示整理中空态', async ({ page }) => {
    await seedPublicCatalog(page, [])
    await page.goto('/works')
    await expect(page.getByText('作品正在整理中。')).toBeVisible()
  })

  test('页面无横向溢出', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works')
    await expect(card(page, 'e2e-public-lanmei')).toBeVisible()
    const overflow = await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('固定 12 件分页保留搜索，支持键盘、三视口、非法与越界页码', async ({ page, request }) => {
    test.setTimeout(120_000)
    const pagedWorks: SeedWork[] = Array.from({ length: 13 }, (_, index) => ({
      slug: `e2e-public-pagination-${index + 1}`,
      characterName: `分页作品 ${index + 1}`,
      purpose: 'commission',
      photos: [{ alt: `分页作品 ${index + 1} 出厂照` }],
    }))
    await seedPublicCatalog(page, pagedWorks)

    const api = await request.get('/api/public/v1/works?page=2')
    expect(api.status()).toBe(200)
    expect((await api.json()).data).toMatchObject({
      page: 2,
      pageCount: 2,
      pageSize: 12,
      resultCount: 13,
    })

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/works')
      const pagination = page.getByRole('navigation', { name: '作品展示分页' })
      await expect(pagination).toBeVisible()
      await expect(page.locator('[data-work-slug]')).toHaveCount(12)
      await expect(pagination.getByRole('link', { name: '下一页' }))
        .toHaveAttribute('href', '/works?page=2')
      await pagination.getByRole('link', { name: '下一页' }).focus()
      await expect(pagination.getByRole('link', { name: '下一页' })).toBeFocused()
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ))).toBeLessThanOrEqual(1)
    }

    // 分页是「同 path 只改 query」：Nuxt 默认 scrollBehavior 对这一支保持滚动位置，
    // 翻页后必须自己回到页顶，否则第 2 页一进来就停在上一页列表底部。
    await page.getByRole('navigation', { name: '作品展示分页' })
      .getByRole('link', { name: '下一页' }).scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await page.getByRole('navigation', { name: '作品展示分页' })
      .getByRole('link', { name: '下一页' }).click()
    await expect(page).toHaveURL(/page=2$/u)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await expect(page.locator('[data-work-slug]')).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: '作品展示分页' })
      .getByRole('link', { name: '上一页' }))
      .toHaveAttribute('href', '/works')

    await page.goto('/works?page=bad')
    await expect(page.locator('[data-work-slug]')).toHaveCount(12)
    const currentPage = page.getByRole('navigation', { name: '作品展示分页' })
      .locator('[aria-current="page"]')
    await expect(currentPage).toHaveCount(1)
    await expect(currentPage).toContainText('1')

    await page.goto('/works?page=99')
    await expect(page.getByText('这一页没有作品')).toBeVisible()
    await expect(page.getByRole('link', { name: '回到第一页' }))
      .toHaveAttribute('href', '/works')
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
    expect(html).not.toContain('共 4 件作品')
    for (const work of CATALOG) {
      expect(html).toContain(`href="/works/${work.slug}"`)
    }
    // 卡片图片为公开衍生图 srcset，不含私有对象键或签名 URL
    expect(html).toContain('http://127.0.0.2:')
    expect(html).not.toContain('test/e2e-public/original')
    expect(html).not.toContain('private-download.test')
    expect(html).not.toContain('e2e-private-contact')
    expect(html).not.toContain('mailto:3114559925@qq.com')
    expect(html).not.toContain('QQ 3114559925')
  })
})

test.describe('T19 作品详情页', () => {
  test('详情无前后导航，领养旧路径永久跳到统一详情', async ({ page, request }) => {
    await seedCatalog(page)
    await page.goto('/works/e2e-public-zhima')

    // FU-15：上一件/下一件已删除，避免切换后返回目标退化。
    await expect(page.getByTestId('work-detail-navigation')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /上一件|下一件/u })).toHaveCount(0)

    const redirected = await request.get('/adoptions/e2e-public-lanmei', {
      maxRedirects: 0,
    })
    expect(redirected.status()).toBe(301)
    expect(redirected.headers().location).toBe('/works/e2e-public-lanmei')
  })

  test('核心内容齐备：名称、物种、图集切换与相关浏览', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works')
    await card(page, 'e2e-public-lanmei').click()

    await expect(page).toHaveURL(/\/works\/e2e-public-lanmei$/)
    await expect(page).toHaveTitle(/蓝湄 · 作品展示 · 有点小狗工作室/)
    await expect(page.getByRole('heading', { level: 1, name: '蓝湄' })).toBeVisible()
    await expect(page.getByText('北极狐')).toBeVisible()
    await expect(page.getByTestId('work-facts')).toHaveCount(0)
    await expect(page.getByTestId('work-price')).toHaveCount(0)
    await expect(page.getByText(/装型|角色主人|领养方式|业务状态|展会/u)).toHaveCount(0)

    // FU-18：单一媒体区。两张出厂照 + 领养封面合成同一个图集，封面排在最后。
    await expect(page.locator('section[aria-label="作品图集"] [data-testid="work-gallery"]')).toBeVisible()
    await expect(page.getByTestId('work-detail-adoption-cover')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 2, name: '领养封面' })).toHaveCount(0)

    const thumbs = page.getByRole('button', { name: /查看第 \d 张，共 3 张/ })
    await expect(thumbs).toHaveCount(3)
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'true')
    await thumbs.nth(1).click()
    await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'false')

    // 最后一张是领养封面。
    await thumbs.nth(2).click()
    await expect(page.locator('[data-testid="work-gallery"] .work-gallery__stage img'))
      .toHaveAttribute('alt', '蓝湄独立横版领养封面')

    // FU-19：不再提供「继续浏览」。
    await expect(page.locator('.work-detail__related-grid')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 2, name: '继续浏览' })).toHaveCount(0)

    // 返回链接
    await expect(page.getByRole('link', { name: '返回作品展示' })).toHaveAttribute('href', '/works')
  })

  test('FU-18：主图与缩略图成组居中，切换作品后选中索引复位', async ({ page }) => {
    await seedCatalog(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/works/e2e-public-lanmei')

    const gallery = page.getByTestId('work-gallery')
    const stage = gallery.locator('.work-gallery__stage')
    await expect(stage).toHaveAttribute('data-orientation', 'landscape')

    const thumbs = page.getByRole('button', { name: /查看第 \d 张，共 3 张/ })
    await thumbs.nth(1).click()
    await expect(stage).toHaveAttribute('data-orientation', 'portrait')

    // 缩略图紧贴主图右侧，不被推到远处；主图不铺满整栏。
    const galleryBox = (await gallery.boundingBox())!
    const imageBox = (await stage.locator('img').boundingBox())!
    const thumbsBox = (await gallery.locator('.work-gallery__thumbs').boundingBox())!
    expect(thumbsBox.x - (imageBox.x + imageBox.width)).toBeLessThanOrEqual(24)
    expect(imageBox.width).toBeLessThan(galleryBox.width * 0.9)
    expect(imageBox.height).toBeGreaterThan(0)

    // 同组件实例内经列表跳到只有 1 张图的作品：选中索引必须复位，
    // 不带着索引 1 越界。
    await page.goto('/works')
    await card(page, 'e2e-public-zhima').click()
    await expect(page).toHaveURL(/\/works\/e2e-public-zhima$/u)
    await expect(page.getByRole('button', { name: /查看第/u })).toHaveCount(0)
    const nextStage = page.locator('[data-testid="work-gallery"] .work-gallery__stage img')
    await expect(nextStage).toHaveJSProperty('complete', true)
  })

  test('委托作品只展示名称与物种，无主人、标签或价格区', async ({ page }) => {
    await seedCatalog(page)
    await page.goto('/works/e2e-public-zhima')
    await expect(page.getByText('哈士奇')).toBeVisible()
    await expect(page.getByTestId('work-facts')).toHaveCount(0)
    await expect(page.getByTestId('work-price')).toHaveCount(0)
    await expect(page.getByText(/角色主人|可动颚/u)).toHaveCount(0)
  })

  test('SSR 直出包含详情内容、公开 srcset 与 SEO 描述', async ({ page, request }) => {
    await seedCatalog(page)
    const response = await request.get('/works/e2e-public-lanmei')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('蓝湄')
    expect(html).toContain('og:title')
    expect(html).toContain('蓝湄坐在草地上的出厂照')
    // detail 衍生图宽度描述符
    expect(html).toContain('960w')
    expect(html).toContain('2400w')
    // FU-19：不再直出「继续浏览」的其它作品链接。
    expect(html).not.toContain('href="/works/e2e-public-zhima"')
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
      purpose: 'showcase',
      sortOrder: 0,
      photos: [{ alt: '高挑的纵向出厂照', width: 2400, height: 3200 }],
    }])
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/works/e2e-public-tall')

    const image = page.locator('.work-gallery__image img')
    await expect(image).toHaveJSProperty('complete', true)
    const box = await image.boundingBox()
    expect(box).not.toBeNull()
    // clamp(20rem, 100vh - 15rem, 46rem)：1440×900 下为 900 - 240 = 660px
    expect(box!.height).toBeLessThanOrEqual(661)
  })
})

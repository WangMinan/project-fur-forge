import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { capture } from './helpers/screenshots'
import {
  seedHeroCollections,
  seedHomeSlides,
  seedPublicCatalog,
} from './helpers/public-catalog'
import type { SeedHomeSlide, SeedHomeSettings, SeedWork } from './helpers/public-catalog'

/**
 * T20 首页：双源轮播 + 精选轨道，全部消费真实公开投影。
 * 轮播图片 URL 路径含 usage（home-hero-landscape / home-hero-portrait），
 * 用于断言方向性请求与“隐藏项不下载”。
 */

const WORKS: SeedWork[] = [
  {
    slug: 'e2e-public-home-naigai',
    characterName: '奶盖',
    species: '布偶猫',
    suitType: 'full',
    purpose: 'showcase',
    featured: true,
    sortOrder: 0,
    photos: [{ alt: '奶盖的出厂照' }],
  },
  {
    slug: 'e2e-public-home-lanmei',
    characterName: '蓝湄',
    species: '北极狐',
    suitType: 'full',
    purpose: 'adoption',
    adoptionMethod: 'event_drop',
    businessStatus: 'available',
    eventName: '有点小狗夏日展',
    eventTime: '2026 年 8 月 15 日',
    priceMinorUnits: 1_560_000,
    featured: true,
    sortOrder: 1,
    photos: [{ alt: '蓝湄的出厂照' }],
  },
  {
    slug: 'e2e-public-home-zhima',
    characterName: '芝麻',
    species: '哈士奇',
    suitType: 'full',
    purpose: 'commission',
    featured: true,
    sortOrder: 2,
    photos: [{ alt: '芝麻的出厂照' }],
  },
  {
    slug: 'e2e-public-home-doudou',
    characterName: '豆豆',
    species: '柴犬',
    suitType: 'partial',
    purpose: 'commission',
    featured: false,
    sortOrder: 3,
    photos: [{ alt: '豆豆的出厂照' }],
  },
]

const SLIDES: SeedHomeSlide[] = [
  {
    alt: '奶盖的首页展示照',
    sortOrder: 0,
    enabled: true,
    linkedWorkSlug: 'e2e-public-home-naigai',
  },
  {
    alt: '蓝湄的首页展示照',
    sortOrder: 1,
    enabled: true,
    linkedWorkSlug: 'e2e-public-home-lanmei',
  },
  {
    alt: '芝麻的首页展示照',
    sortOrder: 2,
    enabled: true,
    linkedWorkSlug: null,
  },
]

const SCREENSHOT_DIR =
  'agent_docs/需求1-兽装工作室主页/implementation/notes/t19-t22/t19-t20/screenshots'
const T28_SCREENSHOT_DIR =
  'agent_docs/需求1-兽装工作室主页/implementation/notes/t28-t34/screenshots'
async function seedHome(
  page: Page,
  settings?: SeedHomeSettings,
  slides: SeedHomeSlide[] = SLIDES,
) {
  await seedPublicCatalog(page, WORKS)
  await seedHomeSlides(page, slides, settings)
}

async function seedCompleteMotionHome(page: Page, settings?: SeedHomeSettings) {
  await seedPublicCatalog(page, [
    ...WORKS,
    {
      slug: 'e2e-public-home-motion-adoption',
      characterName: '动效领养验证',
      species: '犬',
      suitType: 'partial',
      purpose: 'adoption',
      adoptionMethod: 'regular',
      businessStatus: 'available',
      sortOrder: 4,
      designSheet: { alt: '动效领养验证设定图' },
      photos: [],
    },
  ])
  await seedHomeSlides(page, SLIDES, settings)
  await seedHomeSlides(page, [
    { alt: '动效验证委托页大图', sortOrder: 0, enabled: true },
  ], undefined, 'commission')
}

/** 记录公开媒体请求；test-only 同源 fake OSS 返回真实可解码图片。 */
function observeMediaRequests(page: Page) {
  const requested: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('127.0.0.2:')) {
      requested.push(request.url())
    }
  })
  return requested
}

const hero = (page: Page) => page.getByTestId('public-hero')
const liveStatus = (page: Page) => hero(page).getByRole('status')

test.describe('T20 首页双源轮播', () => {
  test('SSR 直出首项：首屏 HTML 含第一张的横竖 srcset 与口号，不含后续项图片', async ({
    page,
    request,
  }) => {
    await seedHome(page, { tagline: '不只做小狗毛（测试）' })
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    // 只断言渲染标记：__NUXT_DATA__ 负载含全部轮播数据属正常，不代表图片下载。
    const markup = html.split('<script type="application/json"')[0]!

    expect(markup).toContain('不只做小狗毛（测试）')
    expect(markup).toContain('奶盖的首页展示照')
    // 首项横竖双源均 SSR 直出
    expect(markup).toContain('home-hero-landscape')
    expect(markup).toContain('home-hero-portrait')
    expect(markup).toContain('(orientation: portrait)')
    // 首项高优先级
    expect(markup).toContain('fetchpriority="high"')
    expect(markup).toContain('loading="eager"')
    // 后续项不渲染图片标记（隐藏项不下载由方向性请求用例覆盖）
    expect(markup).not.toContain('蓝湄的首页展示照')
    expect(markup).not.toContain('芝麻的首页展示照')
    // R3-C Hero 不再输出 action 或 linked work。
    expect(markup).not.toContain('查看这套作品')
    expect(markup).not.toContain('浏览作品展示')
    expect(markup).not.toContain('mailto:3114559925@qq.com')
    expect(markup).not.toContain('QQ 3114559925')
    expect(markup).not.toContain('e2e-private-contact')
    expect(markup).not.toContain('/fixtures/')
  })

  test('横屏视口只请求横版图片', async ({ page }) => {
    await seedHome(page)
    const requested = observeMediaRequests(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const image = hero(page).getByRole('img', { name: '奶盖的首页展示照' })
    await expect(image).toHaveJSProperty('complete', true)
    expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0)

    const heroRequests = requested.filter(url => url.includes('home-hero'))
    expect(heroRequests.length).toBeGreaterThan(0)
    expect(heroRequests.every(url => url.includes('home-hero-landscape'))).toBe(true)
    expect(heroRequests.some(url => url.includes('home-hero-portrait'))).toBe(false)
    const portraitSource = hero(page)
      .locator('source[media="(orientation: portrait)"]')
      .first()
    await expect(portraitSource).toHaveAttribute('width', '1080')
    await expect(portraitSource).toHaveAttribute('height', '1920')
  })

  test('竖屏视口只请求竖版图片', async ({ page }) => {
    await seedHome(page)
    const requested = observeMediaRequests(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const image = hero(page).getByRole('img', { name: '奶盖的首页展示照' })
    await expect(image).toHaveJSProperty('complete', true)
    expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0)

    const heroRequests = requested.filter(url => url.includes('home-hero'))
    expect(heroRequests.length).toBeGreaterThan(0)
    expect(heroRequests.every(url => url.includes('home-hero-portrait'))).toBe(true)
    expect(heroRequests.some(url => url.includes('home-hero-landscape'))).toBe(false)
  })

  test('隐藏轮播项不下载，切换到第二张后按需加载', async ({ page }) => {
    await seedHome(page)
    const requested = observeMediaRequests(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(hero(page).getByRole('img', { name: '奶盖的首页展示照' }))
      .toHaveJSProperty('complete', true)

    const firstSlideUrls = requested.filter(url => url.includes('home-hero'))
    const firstAssetIds = new Set(
      firstSlideUrls.map(url => url.match(/\/web\/([0-9a-f-]{36})\//)?.[1]),
    )
    expect(firstAssetIds.size).toBe(1)

    await hero(page).getByRole('button', { name: '下一张' }).click()
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')
    const secondImage = hero(page).getByRole('img', { name: '蓝湄的首页展示照' })
    await expect(secondImage)
      .toHaveAttribute('loading', 'lazy')
    await expect(secondImage).toHaveJSProperty('complete', true)
    expect(await secondImage.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0)

    const secondSlideUrls = requested
      .filter(url => url.includes('home-hero'))
      .filter(url => !firstAssetIds.has(url.match(/\/web\/([0-9a-f-]{36})\//)?.[1]))
    expect(secondSlideUrls.length).toBeGreaterThan(0)
  })

  test('手动轮播：箭头回绕、圆点直达、键盘方向键', async ({ page }) => {
    await seedHome(page)
    await page.goto('/')

    const next = hero(page).getByRole('button', { name: '下一张' })
    const prev = hero(page).getByRole('button', { name: '上一张' })
    const firstDot = hero(page).getByRole('button', { name: '第 1 张，共 3 张' })
    const dotBox = await firstDot.boundingBox()
    expect(dotBox?.width).toBeGreaterThanOrEqual(24)
    expect(dotBox?.height).toBeGreaterThanOrEqual(24)

    await next.click()
    // 切换期间同时保留离场/进场项，并以非零 transform/opacity 过渡；
    // 结束后重新收敛为唯一当前项，不常驻下载隐藏图片。
    await expect(hero(page).locator('.home-hero__slide')).toHaveCount(2)
    expect(await hero(page).locator('.home-hero__slide').evaluateAll(slides => (
      slides.every(slide => getComputedStyle(slide).transitionDuration.includes('0.68s'))
    ))).toBe(true)
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')
    await expect(hero(page).getByRole('img', { name: '蓝湄的首页展示照' })).toBeVisible()
    await expect(hero(page).locator('.home-hero__slide')).toHaveCount(1)
    await prev.click()
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')

    // 回绕：第一张上一张 → 最后一张
    await prev.click()
    await expect(liveStatus(page)).toHaveText('第 3 张，共 3 张')
    // 圆点直达
    await hero(page).getByRole('button', { name: '第 1 张，共 3 张' }).click()
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')
    await expect(
      hero(page).getByRole('button', { name: '第 1 张，共 3 张' }),
    ).toHaveAttribute('aria-current', 'true')

    // 键盘：焦点在轮播内时方向键切换
    await next.focus()
    await page.keyboard.press('ArrowRight')
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')
    await page.keyboard.press('ArrowLeft')
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')
  })

  test('触控滑动切换轮播项', async ({ page }) => {
    await seedHome(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(hero(page).getByRole('img', { name: '奶盖的首页展示照' }))
      .toHaveJSProperty('complete', true)

    const viewport = hero(page).locator('.home-hero__viewport')
    const box = await viewport.boundingBox()
    expect(box).not.toBeNull()
    // 避开随当前轮播项变化的作品链接和底部分页控件，固定从纯媒体区发起手势。
    const y = box!.y + box!.height * 0.25
    const startX = box!.x + box!.width * 0.8

    // 向左滑 → 下一张
    await page.mouse.move(startX, y)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width * 0.2, y, { steps: 8 })
    await page.mouse.up()
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')

    // 向右滑 → 上一张
    await page.mouse.move(box!.x + box!.width * 0.2, y)
    await page.mouse.down()
    await page.mouse.move(startX, y, { steps: 8 })
    await page.mouse.up()
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')
  })

  test('旧设置关闭时仍按固定规则开启自动轮播', async ({ page }) => {
    await seedHome(page, { autoRotate: false, autoRotateIntervalMs: 6_000 })
    await page.clock.install()
    await page.goto('/')

    await expect(hero(page).getByRole('button', { name: '暂停自动轮播' })).toBeVisible()
    await page.clock.fastForward(10_100)
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')
  })

  test('固定十秒自动轮播：鼠标停留和控件聚焦不隐式暂停，可见按钮可暂停', async ({ page }) => {
    await seedHome(page, { autoRotate: true, autoRotateIntervalMs: 6_000 })
    await page.clock.install()
    await page.goto('/')

    const pause = hero(page).getByRole('button', { name: '暂停自动轮播' })
    await expect(pause).toBeVisible()

    // 鼠标停留在大面积 Hero 上仍自动切换，避免桌面端看起来“卡住”。
    await hero(page).hover()
    await page.clock.fastForward(10_100)
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')

    // 控件获得焦点也不成为隐式暂停；键盘用户用同一可见按钮显式暂停。
    await hero(page).getByRole('button', { name: '下一张' }).focus()
    await page.clock.fastForward(10_100)
    await expect(liveStatus(page)).toHaveText('第 3 张，共 3 张')

    // 可见暂停：点击后不再自动切换
    await pause.click()
    await expect(hero(page).getByRole('button', { name: '继续自动轮播' }))
      .toHaveAttribute('aria-pressed', 'true')
    await page.clock.fastForward(10_100)
    await expect(liveStatus(page)).toHaveText('第 3 张，共 3 张')
  })

  test('reduced-motion 下自动轮播不启动', async ({ page }) => {
    await seedHome(page, { autoRotate: true, autoRotateIntervalMs: 6_000 })
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    await page.clock.install()

    await page.goto('/')
    await page.clock.fastForward(10_100)
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')
  })

  test('横竖序列数量与顺序可不同，方向变化后只切换当前集合', async ({ page }) => {
    const hydrationErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydration/iu.test(message.text())) {
        hydrationErrors.push(message.text())
      }
    })
    await seedHeroCollections(page, {
      landscape: [
        { alt: '横版 A', sortOrder: 0, enabled: true },
        { alt: '横版 B', sortOrder: 1, enabled: true },
        { alt: '横版 C', sortOrder: 2, enabled: true },
      ],
      portrait: [
        { alt: '竖版首页', sortOrder: 0, enabled: true },
        { alt: '竖版次页', sortOrder: 1, enabled: true },
      ],
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')
    await expect(hero(page).getByRole('img', { name: '横版 A' })).toBeVisible()
    await hero(page).getByRole('button', { name: '下一张' }).click()
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(liveStatus(page)).toHaveText('第 1 张，共 2 张')
    await expect(hero(page).getByRole('img', { name: '竖版首页' })).toBeVisible()
    expect(hydrationErrors).toEqual([])
  })

  test('无 JS 时第一项完整可用', async ({ browser, page }) => {
    await seedCompleteMotionHome(page, { tagline: '不只做小狗毛（测试）' })
    const context = await browser.newContext({ javaScriptEnabled: false })
    const plainPage = await context.newPage()
    try {
      await plainPage.goto('/')
      const img = plainPage.getByRole('img', { name: '奶盖的首页展示照' })
      await expect(img).toBeVisible()
      await expect(plainPage.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(plainPage.getByText('不只做小狗毛（测试）')).toBeVisible()
      await expect(plainPage.getByText('浏览作品展示')).toHaveCount(0)
      await expect(plainPage.getByTestId('featured-works')).toBeVisible()
      await expect(plainPage.getByTestId('home-business-entries')).toBeVisible()
      await expect(plainPage.getByTestId('home-current-adoptions')).toBeVisible()
      for (const reveal of [
        'home-featured-reveal',
        'home-entries-reveal',
        'home-adoptions-reveal',
      ]) {
        await expect(plainPage.getByTestId(reveal)).toHaveAttribute('data-reveal-state', 'static')
        await expect(plainPage.getByTestId(reveal)).toHaveCSS('opacity', '1')
      }
    }
    finally {
      await context.close()
    }
  })

  test('横版集合暂空时 SSR 仍直出竖版首项作为受控回退', async ({ page, request }) => {
    await seedHeroCollections(page, {
      landscape: [],
      portrait: [{ alt: '仅有竖版的首项', sortOrder: 0, enabled: true }],
    })
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const markup = (await response.text()).split('<script type="application/json"')[0]!
    expect(markup).toContain('仅有竖版的首项')
    expect(markup).toContain('home-hero-portrait')
  })

  test('无启用轮播项时首屏退化为文字区，不出控件', async ({ page }) => {
    await seedHome(page, { tagline: '安静的工作室' }, [])
    await page.goto('/')

    await expect(hero(page).getByRole('heading', { level: 1, name: '有点小狗工作室' }))
      .toBeVisible()
    await expect(hero(page).getByText('安静的工作室')).toBeVisible()
    await expect(hero(page).getByRole('button', { name: '下一张' })).toHaveCount(0)
    await expect(hero(page).locator('img')).toHaveCount(0)
    await expect(page.getByTestId('public-header')).toHaveClass(/public-header--overlay/u)
  })

  test('首页 CLS < 0.1', async ({ page }) => {
    await seedHome(page)
    await page.goto('/')
    const cls = await page.evaluate(() => new Promise<number>((resolve) => {
      let value = 0
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean, value?: number }
          if (!shift.hadRecentInput && typeof shift.value === 'number') {
            value += shift.value
          }
        }
      })
      observer.observe({ type: 'layout-shift', buffered: true })
      window.setTimeout(() => {
        observer.disconnect()
        resolve(value)
      }, 2_500)
    }))
    expect(cls).toBeLessThan(0.1)
  })

  test('五视口图片真实解码、无横向溢出并留存首页证据', async ({ page }) => {
    test.setTimeout(90_000)
    await seedHome(page)
    for (const [width, height] of [
      [390, 844],
      [768, 1024],
      [1023, 900],
      [1024, 900],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      const image = hero(page).getByRole('img', { name: '奶盖的首页展示照' })
      await expect(image).toHaveJSProperty('complete', true)
      expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth))
        .toBeGreaterThan(0)
      await hero(page).locator('.home-hero__controls').evaluate(async (controls) => {
        await Promise.all(controls.getAnimations().map(animation => animation.finished))
      })
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
      const spacing = await hero(page).evaluate((node) => {
        const content = node.querySelector<HTMLElement>('.home-hero__content')!
        const title = node.querySelector<HTMLElement>('.home-hero__title')!
        const controls = node.querySelector<HTMLElement>('.home-hero__controls')!
        const heroRect = node.getBoundingClientRect()
        const titleRect = title.getBoundingClientRect()
        const controlsRect = controls.getBoundingClientRect()
        return {
          contentPaddingLeft: Number.parseFloat(getComputedStyle(content).paddingLeft),
          controlsBottomGap: heroRect.bottom - controlsRect.bottom,
          heroHeight: heroRect.height,
          titleCenterDelta: Math.abs(
            titleRect.left + titleRect.width / 2 - window.innerWidth / 2,
          ),
        }
      })
      expect(spacing.contentPaddingLeft).toBeGreaterThanOrEqual(16)
      expect(spacing.controlsBottomGap).toBeGreaterThanOrEqual(12)
      expect(spacing.heroHeight).toBeGreaterThanOrEqual(height - 1)
      if (width >= 1024) {
        expect(spacing.titleCenterDelta).toBeLessThanOrEqual(2)
      }
      await capture(page, `home-${width}x${height}`, SCREENSHOT_DIR)
    }
  })
})

test.describe('T28 首页完整内容顺序', () => {
  test('只用真实数据依次显示图片入口、营业状态和当前领养', async ({ page }) => {
    await seedPublicCatalog(page, [
      ...WORKS,
      {
        slug: 'e2e-public-home-adoption',
        characterName: '云朵',
        species: '萨摩耶',
        suitType: 'partial',
        purpose: 'adoption',
        adoptionMethod: 'regular',
        businessStatus: 'available',
        sortOrder: 4,
        designSheet: { alt: '云朵的完整设定图' },
        photos: [],
      },
    ])
    await seedHomeSlides(page, SLIDES)
    await seedHomeSlides(page, [
      { alt: '委托页独立代表作品', sortOrder: 0, enabled: true },
    ], undefined, 'commission')
    await page.goto('/')

    // T34-F2：入口与状态合并为统一业务入口卡，不再有独立状态区。
    // 顺序与公开站 IA 一致：Hero → 精选作品 → 统一业务入口 → 当前领养 → 页脚。
    const order = await page.locator([
      '[data-testid="public-hero"]',
      '[data-testid="featured-works"]',
      '[data-testid="home-business-entries"]',
      '[data-testid="home-current-adoptions"]',
      '[data-testid="public-footer"]',
    ].join(',')).evaluateAll(elements => elements.map(element =>
      element.getAttribute('data-testid'),
    ))
    expect(order).toEqual([
      'public-hero',
      'featured-works',
      'home-business-entries',
      'home-current-adoptions',
      'public-footer',
    ])

    await expect(page.getByTestId('home-business-statuses')).toHaveCount(0)

    const entries = page.getByTestId('home-business-entries')
    await expect(entries.getByRole('heading', { level: 2 }))
      .toHaveText('委托与领养')
    const commission = entries.getByTestId('home-business-entry')
      .filter({ has: page.locator('[data-entry-kind="commission"]') })
      .or(entries.locator('[data-entry-kind="commission"]'))
    const adoption = entries.locator('[data-entry-kind="adoption"]')
    await expect(commission).toHaveAttribute('href', '/commission')
    await expect(adoption).toHaveAttribute('href', '/adoptions')

    // 每张卡内部同时包含标题、状态和单一行动入口，且整卡是唯一链接。
    for (const card of [commission, adoption]) {
      await expect(card.locator('.home-entry__name')).toBeVisible()
      await expect(card.locator('.home-entry__status')).toBeVisible()
      await expect(card.locator('.home-entry__action')).toBeVisible()
      expect(await card.locator('a').count()).toBe(0)
    }
    await expect(page.getByTestId('home-current-adoptions')).toContainText('云朵')

    for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      const imageEntries = page.getByTestId('home-business-entries')
      await imageEntries.scrollIntoViewIfNeeded()
      await expect(imageEntries.getByRole('img')).toHaveCount(2)
      // 两卡视觉对称：同一断点下宽高一致。
      const boxes = await imageEntries.locator('[data-testid="home-business-entry"]')
        .evaluateAll(cards => cards.map((card) => {
          const rect = card.getBoundingClientRect()
          return [Math.round(rect.width), Math.round(rect.height)]
        }))
      expect(boxes).toHaveLength(2)
      expect(boxes[0]![0]).toEqual(boxes[1]![0])
      // 两卡同宽同比例；≥768px 为两列布局，网格默认拉伸使高度一致。
      // <768px 单列堆叠时，两张卡各自按真实文案长度自适应高度，不强制相等。
      if (width >= 768) {
        expect(boxes[0]).toEqual(boxes[1])
      }
      expect(await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )).toBeLessThanOrEqual(1)
      await capture(page, `t34-f2-home-entries-${width}x${height}`, T28_SCREENSHOT_DIR)
    }
  })

  test('没有真实图片或领养时不渲染对应模块', async ({ page }) => {
    await seedHome(page)
    await seedHomeSlides(page, [], undefined, 'commission')
    await page.goto('/')

    // 无可用入口图时整个业务入口区受控隐藏，不回退到作品水印图。
    await expect(page.getByTestId('home-business-entries')).toHaveCount(0)
    await expect(page.getByTestId('home-current-adoptions')).toHaveCount(0)
    await expect(page.getByTestId('public-hero')).toBeVisible()
  })

  test('只有一个真实图片入口时在桌面占满整行', async ({ page }) => {
    await seedHome(page)
    await seedHomeSlides(page, [
      { alt: '委托页独立代表作品', sortOrder: 0, enabled: true },
    ], undefined, 'commission')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const widths = await page.getByTestId('home-business-entries').evaluate((section) => {
      const list = section.querySelector('ul')!
      const entry = section.querySelector('a')!
      return [list.getBoundingClientRect().width, entry.getBoundingClientRect().width]
    })
    expect(Math.abs(widths[0]! - widths[1]!)).toBeLessThanOrEqual(1)
    await expect(
      page.getByTestId('home-business-entries').getByRole('link'),
    ).toHaveCount(1)
  })
})

test.describe('T20 首页精选轨道', () => {
  test('真实精选按人工顺序展示，非精选不出现，不自动播放', async ({ page }) => {
    await seedHome(page)
    await page.goto('/')

    const track = page.getByTestId('featured-track')
    await expect(track).toBeVisible()

    const slugs = await track.locator('[data-work-slug]').evaluateAll(
      cards => cards.map(card => card.getAttribute('data-work-slug')),
    )
    expect(slugs).toEqual([
      'e2e-public-home-naigai',
      'e2e-public-home-lanmei',
      'e2e-public-home-zhima',
    ])

    // 不自动播放：无交互时滚动位置保持为 0
    await page.waitForTimeout(1_500)
    const scrollLeft = await track.locator('.featured-track__rail').evaluate(
      rail => rail.scrollLeft,
    )
    expect(scrollLeft).toBe(0)

    // 箭头与键盘可用（T08 交互保留）
    await expect(track.getByRole('button', { name: '上一批作品' })).toBeVisible()
    await expect(track.getByRole('button', { name: '下一批作品' })).toBeVisible()
  })

  test('无精选作品时整个精选区隐藏', async ({ page }) => {
    await seedPublicCatalog(page, WORKS.map(work => ({ ...work, featured: false })))
    await seedHomeSlides(page, SLIDES)
    await page.goto('/')

    await expect(page.getByTestId('featured-works')).toHaveCount(0)
    await expect(page.getByTestId('featured-track')).toHaveCount(0)
  })

  test('首页最多展示前 12 件，第 7–12 件可横向访问且图片保持懒加载', async ({ page }) => {
    const works: SeedWork[] = Array.from({ length: 13 }, (_, index) => ({
      slug: `e2e-public-featured-limit-${index}` as `e2e-public-${string}`,
      characterName: `精选上限 ${index + 1}`,
      species: '犬',
      suitType: 'full',
      purpose: 'showcase',
      featured: true,
      sortOrder: index,
      photos: [{ alt: `精选上限 ${index + 1} 出厂照` }],
    }))
    await seedPublicCatalog(page, works)
    await seedHomeSlides(page, [{
      alt: '精选上限首页展示照',
      sortOrder: 0,
      enabled: true,
      linkedWorkSlug: 'e2e-public-featured-limit-0',
    }])
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const track = page.getByTestId('featured-track')
    const cards = track.locator('[data-work-slug]')
    await expect(cards).toHaveCount(12)
    await expect(cards.nth(6)).toContainText('精选上限 7')
    await expect(cards.nth(11)).toContainText('精选上限 12')
    await expect(track.getByText('精选上限 13')).toHaveCount(0)
    for (const image of await cards.locator('img').all()) {
      await expect(image).toHaveAttribute('loading', 'lazy')
    }

    const rail = track.locator('.featured-track__rail')
    const next = track.getByRole('button', { name: '下一批作品' })
    const previous = track.getByRole('button', { name: '上一批作品' })
    await expect(previous).toBeDisabled()
    await expect(next).toBeEnabled()
    await next.click()
    await expect.poll(() => rail.evaluate(element => element.scrollLeft))
      .toBeGreaterThan(0)

    await rail.evaluate((element) => {
      element.scrollLeft = element.scrollWidth
      element.dispatchEvent(new Event('scroll'))
    })
    await expect(next).toBeDisabled()
    await expect(previous).toBeEnabled()
    await expect(cards.nth(11)).toBeInViewport()
  })
})

test.describe('R3-A 首页退役动态摘要', () => {
  test('首页和两端导航不再提供返图/动态入口', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-latest-updates')).toHaveCount(0)
    const desktopNav = page.getByRole('navigation', { name: '主导航' })
    await expect(desktopNav.getByRole('link', { name: '最新动态' })).toHaveCount(0)
    await expect(desktopNav.getByRole('link', { name: '返图墙' })).toHaveCount(0)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: '打开导航' }).click()
    const mobileNav = page.getByTestId('public-mobile-nav')
    await expect(mobileNav.getByRole('link', { name: '最新动态' })).toHaveCount(0)
    await expect(mobileNav.getByRole('link', { name: '返图墙' })).toHaveCount(0)
  })
})

test.describe('R3-C 导航与公开主内容切换', () => {
  test('桌面导航 hover/focus 胶囊、阴影、轻移与下拉反馈等价', async ({ page }) => {
    await seedCompleteMotionHome(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const works = page.getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '作品展示' })
    await works.hover()
    await expect.poll(() => works.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        background: style.backgroundColor,
        shadow: style.boxShadow,
        transform: style.transform,
      }
    })).toMatchObject({
      background: expect.not.stringMatching(/^rgba\(0, 0, 0, 0\)$/u),
      shadow: expect.not.stringMatching(/^none$/u),
      transform: expect.not.stringMatching(/^none$/u),
    })

    await works.focus()
    await expect(works).toBeFocused()
    await expect.poll(() => works.evaluate(element => getComputedStyle(element).transform))
      .not.toBe('none')

    const about = page.getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '关于我们', exact: true })
      .first()
    await about.hover()
    await expect(page.getByRole('navigation', { name: '关于我们二级导航' }))
      .toBeVisible()
    await expect.poll(() => about.locator('svg')
      .evaluate(element => getComputedStyle(element).transform))
      .not.toBe('none')
  })

  test('仅 main 切换，Header/Footer 稳定，离场禁用指针且前进后退归还焦点', async ({ page }) => {
    await seedCompleteMotionHome(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const header = page.getByTestId('public-header')
    const footer = page.getByTestId('public-footer')
    await header.evaluate(element => element.setAttribute('data-stable-node', 'header'))
    await footer.evaluate(element => element.setAttribute('data-stable-node', 'footer'))

    await page.getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '作品展示' }).click()
    const leaving = page.locator('.public-main-leave-active')
    await expect(leaving).toHaveCSS('pointer-events', 'none')
    await expect(page).toHaveURL(/\/works$/u)
    await expect(page.locator('#main-content')).toBeFocused()
    await expect(header).toHaveAttribute('data-stable-node', 'header')
    await expect(footer).toHaveAttribute('data-stable-node', 'footer')
    await expect(page.getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '作品展示' }))
      .toHaveAttribute('aria-current', 'page')

    await page.goBack()
    await expect(page).toHaveURL(/\/$/u)
    await expect(page.locator('#main-content')).toBeFocused()
    await page.goForward()
    await expect(page).toHaveURL(/\/works$/u)
    await expect(page.locator('#main-content')).toBeFocused()
  })

  test('锚点与错误页可恢复，reduced-motion 不产生位移', async ({ page }) => {
    await seedCompleteMotionHome(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const skip = page.getByRole('link', { name: '跳到主要内容' })
    await skip.focus()
    await skip.click()
    await expect(page).toHaveURL(/#main-content$/u)
    await expect(page.locator('#main-content')).toBeFocused()

    const works = page.getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '作品展示' })
    await works.hover()
    await expect(works).toHaveCSS('transform', 'none')

    const response = await page.goto('/r3-c-missing-page')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1, name: '页面未找到' })).toBeVisible()
    await page.getByRole('link', { name: '返回首页' }).click()
    await expect(page).toHaveURL(/\/$/u)
    await expect(hero(page)).toBeVisible()
  })
})

test.describe('T51-F9 首页明显式动效', () => {
  test('Hero 内容按顺序首次进场，轮播切换不重建内容层', async ({ page }) => {
    await seedCompleteMotionHome(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const publicHero = hero(page)
    await expect(publicHero).toHaveClass(/home-hero--motion-ready/u)
    const animated = [
      publicHero.locator('.home-hero__eyebrow'),
      publicHero.locator('.home-hero__title'),
      publicHero.locator('.home-hero__tagline'),
      publicHero.locator('.home-hero__controls'),
    ]
    const delays: number[] = []
    for (const locator of animated) {
      await expect(locator).toHaveCSS('animation-name', /^home-hero-content-in-/u)
      delays.push(await locator.evaluate(element => (
        Number.parseFloat(getComputedStyle(element).animationDelay) * 1000
      )))
    }
    expect(delays).toEqual([...delays].sort((left, right) => left - right))
    expect(new Set(delays).size).toBe(delays.length)

    const title = publicHero.locator('.home-hero__title')
    await title.evaluate(element => element.setAttribute('data-motion-node', 'stable'))
    await publicHero.getByRole('button', { name: '下一张' }).click()
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')
    await expect(title).toHaveAttribute('data-motion-node', 'stable')
  })

  test('内容区只在首次入屏揭示，三个可点击卡片均抬升', async ({ page }) => {
    await seedCompleteMotionHome(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    for (const testId of [
      'home-featured-reveal',
      'home-entries-reveal',
      'home-adoptions-reveal',
    ]) {
      const reveal = page.getByTestId(testId)
      await reveal.scrollIntoViewIfNeeded()
      await expect(reveal).toHaveAttribute('data-reveal-state', 'visible')
    }

    await page.evaluate(() => window.scrollTo(0, 0))
    for (const testId of [
      'home-featured-reveal',
      'home-entries-reveal',
      'home-adoptions-reveal',
    ]) {
      await expect(page.getByTestId(testId)).toHaveAttribute('data-reveal-state', 'visible')
    }

    const workCard = page.locator('.work-card').first()
    await workCard.hover()
    await expect.poll(() => workCard.evaluate(element => getComputedStyle(element).transform))
      .not.toBe('none')
    await expect.poll(() => workCard.locator('.work-card__frame')
      .evaluate(element => getComputedStyle(element).boxShadow))
      .not.toBe('none')

    const businessEntry = page.getByTestId('home-business-entry').first()
    await businessEntry.hover()
    await expect.poll(() => businessEntry.evaluate(element => getComputedStyle(element).transform))
      .not.toBe('none')

    const adoptionCard = page.locator('.adoption-card').first()
    await adoptionCard.hover()
    await expect.poll(() => adoptionCard.evaluate(element => getComputedStyle(element).transform))
      .not.toBe('none')

  })

  test('reduced-motion 取消 Hero、入屏和悬浮位移', async ({ page }) => {
    await seedCompleteMotionHome(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    await expect(hero(page).locator('.home-hero__title')).toHaveCSS('animation-name', 'none')
    const reveal = page.getByTestId('home-featured-reveal')
    await reveal.scrollIntoViewIfNeeded()
    await expect(reveal).toHaveCSS('opacity', '1')
    await expect(reveal).toHaveCSS('transform', 'none')
    expect(await reveal.evaluate(element => (
      Math.max(...getComputedStyle(element).transitionDuration.split(',').map(value => (
        Number.parseFloat(value) * 1000
      )))
    ))).toBeLessThanOrEqual(0.02)

    const workCard = page.locator('.work-card').first()
    await workCard.hover()
    await expect(workCard).toHaveCSS('transform', 'none')
  })
})

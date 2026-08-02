import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { capture } from './helpers/screenshots'
import { seedHomeSlides, seedPublicCatalog } from './helpers/public-catalog'
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
  'agent_docs/需求1-兽装工作室主页/implementation/notes/t19-t20/screenshots'

async function seedHome(
  page: Page,
  settings?: SeedHomeSettings,
  slides: SeedHomeSlide[] = SLIDES,
) {
  await seedPublicCatalog(page, WORKS)
  await seedHomeSlides(page, slides, settings)
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
    // 后续项不渲染图片标记（隐藏项不下载由方向性请求用例覆盖）
    expect(markup).not.toContain('蓝湄的首页展示照')
    expect(markup).not.toContain('芝麻的首页展示照')
    // 关联作品链接只信 linkedWorkHref
    expect(markup).toContain('href="/works/e2e-public-home-naigai"')
    expect(markup).not.toContain('mailto:')
    expect(markup).not.toContain('3114559925')
    expect(markup).not.toContain('/fixtures/')
  })

  test('横屏视口只请求横版图片', async ({ page }) => {
    await seedHome(page)
    const requested = observeMediaRequests(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const heroRequests = requested.filter(url => url.includes('home-hero'))
    expect(heroRequests.length).toBeGreaterThan(0)
    expect(heroRequests.every(url => url.includes('home-hero-landscape'))).toBe(true)
    expect(heroRequests.some(url => url.includes('home-hero-portrait'))).toBe(false)
    const image = hero(page).getByRole('img', { name: '奶盖的首页展示照' })
    await expect(image).toHaveJSProperty('complete', true)
    expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0)
  })

  test('竖屏视口只请求竖版图片', async ({ page }) => {
    await seedHome(page)
    const requested = observeMediaRequests(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const heroRequests = requested.filter(url => url.includes('home-hero'))
    expect(heroRequests.length).toBeGreaterThan(0)
    expect(heroRequests.every(url => url.includes('home-hero-portrait'))).toBe(true)
    expect(heroRequests.some(url => url.includes('home-hero-landscape'))).toBe(false)
    const image = hero(page).getByRole('img', { name: '奶盖的首页展示照' })
    await expect(image).toHaveJSProperty('complete', true)
    expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0)
  })

  test('隐藏轮播项不下载，切换到第二张后按需加载', async ({ page }) => {
    await seedHome(page)
    const requested = observeMediaRequests(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const firstSlideUrls = requested.filter(url => url.includes('home-hero'))
    const firstAssetIds = new Set(
      firstSlideUrls.map(url => url.match(/\/web\/([0-9a-f-]{36})\//)?.[1]),
    )
    expect(firstAssetIds.size).toBe(1)

    await hero(page).getByRole('button', { name: '下一张' }).click()
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')
    await page.waitForLoadState('networkidle')

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

    await next.click()
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')
    await expect(hero(page).getByRole('img', { name: '蓝湄的首页展示照' })).toBeVisible()
    // 关联作品链接随当前项切换
    await expect(hero(page).getByRole('link', { name: '查看这套作品' }))
      .toHaveAttribute('href', '/works/e2e-public-home-lanmei')

    await prev.click()
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')

    // 回绕：第一张上一张 → 最后一张
    await prev.click()
    await expect(liveStatus(page)).toHaveText('第 3 张，共 3 张')
    // 第三张无关联作品：行动回退到作品列表
    await expect(hero(page).getByRole('link', { name: '浏览作品展示' }))
      .toHaveAttribute('href', '/works')

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
    await page.waitForLoadState('networkidle')

    const viewport = hero(page).locator('.home-hero__viewport')
    const box = await viewport.boundingBox()
    expect(box).not.toBeNull()
    const y = box!.y + box!.height / 2
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

  test('自动轮播默认关闭：无暂停按钮且停留首项', async ({ page }) => {
    await seedHome(page, { autoRotate: false, autoRotateIntervalMs: 6_000 })
    await page.goto('/')

    await expect(hero(page).getByRole('button', { name: /自动轮播/ })).toHaveCount(0)
    await page.waitForTimeout(2_000)
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')
  })

  test('自动轮播开启：按间隔切换、可见暂停、悬停与焦点暂停', async ({ page }) => {
    test.setTimeout(60_000)
    await seedHome(page, { autoRotate: true, autoRotateIntervalMs: 6_000 })
    await page.goto('/')

    const pause = hero(page).getByRole('button', { name: '暂停自动轮播' })
    await expect(pause).toBeVisible()

    // 悬停暂停：停留在第一张
    await hero(page).hover()
    await page.waitForTimeout(7_000)
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')

    // 移开但焦点仍在轮播内：继续暂停
    await page.mouse.move(10, 10)
    await hero(page).getByRole('button', { name: '下一张' }).focus()
    await page.waitForTimeout(7_000)
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')

    // 焦点离开后按间隔自动切换
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张', {
      timeout: 8_000,
    })

    // 可见暂停：点击后不再自动切换
    await pause.click()
    await expect(hero(page).getByRole('button', { name: '继续自动轮播' }))
      .toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(7_000)
    await expect(liveStatus(page)).toHaveText('第 2 张，共 3 张')
  })

  test('reduced-motion 下自动轮播不启动', async ({ page }) => {
    await seedHome(page, { autoRotate: true, autoRotateIntervalMs: 6_000 })
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })

    await page.goto('/')
    await page.waitForTimeout(7_000)
    await expect(liveStatus(page)).toHaveText('第 1 张，共 3 张')
  })

  test('无 JS 时第一项完整可用', async ({ browser, page }) => {
    await seedHome(page, { tagline: '不只做小狗毛（测试）' })
    const context = await browser.newContext({ javaScriptEnabled: false })
    const plainPage = await context.newPage()
    try {
      await plainPage.goto('/')
      const img = plainPage.getByRole('img', { name: '奶盖的首页展示照' })
      await expect(img).toBeVisible()
      await expect(plainPage.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(plainPage.getByText('不只做小狗毛（测试）')).toBeVisible()
      await expect(
        plainPage.getByRole('link', { name: '查看这套作品' }),
      ).toHaveAttribute('href', '/works/e2e-public-home-naigai')
    }
    finally {
      await context.close()
    }
  })

  test('无启用轮播项时首屏退化为文字区，不出控件', async ({ page }) => {
    await seedHome(page, { tagline: '安静的工作室' }, [])
    await page.goto('/')

    await expect(hero(page).getByRole('heading', { level: 1, name: '有点小狗工作室' }))
      .toBeVisible()
    await expect(hero(page).getByText('安静的工作室')).toBeVisible()
    await expect(hero(page).getByRole('button', { name: '下一张' })).toHaveCount(0)
    await expect(hero(page).locator('img')).toHaveCount(0)
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

  test('三视口图片真实解码、无横向溢出并留存首页证据', async ({ page }) => {
    test.setTimeout(90_000)
    await seedHome(page)
    for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const image = hero(page).getByRole('img', { name: '奶盖的首页展示照' })
      expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth))
        .toBeGreaterThan(0)
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
      await capture(page, `home-${width}x${height}`, SCREENSHOT_DIR)
    }
  })
})

test.describe('T20 首页精选轨道', () => {
  test('真实精选按人工顺序展示，非精选不出现，不自动播放', async ({ page }) => {
    await seedHome(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

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
})

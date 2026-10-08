import { expect, test } from '@playwright/test'
import { createWorkViaApi } from '../e2e/helpers/admin-work'
import {
  adminBaseURL,
  E2E_ADMIN,
  E2E_DATABASE_FILE,
  loginAsAdmin,
  publicBaseURL,
} from '../e2e/helpers/auth'
import { openFixtureDatabase } from '../e2e/helpers/fixture-db'
import {
  fakeMediaState,
  publishableStudioPng,
  resetFakeMedia,
  smallStudioPng,
} from '../e2e/helpers/fake-media'
import {
  seedHeroCollections,
  seedPublicCatalog,
} from '../e2e/helpers/public-catalog'

async function seedSmokeCatalog(page: import('@playwright/test').Page) {
  await seedPublicCatalog(page, [
    {
      slug: 'e2e-public-smoke-work',
      characterName: '烟火',
      species: '赤狐',
      purpose: 'showcase',
      featured: true,
      sortOrder: 0,
      photos: [{ alt: '烟火出厂照' }],
    },
    {
      slug: 'e2e-public-smoke-available',
      characterName: '云雀',
      species: '犬科',
      purpose: 'adoption',
      adoptionStatus: 'available',
      featured: false,
      sortOrder: 1,
      adoptionCover: { alt: '云雀横版领养封面', width: 1920, height: 1080 },
      photos: [],
    },
    {
      slug: 'e2e-public-smoke-adopted',
      characterName: '月桂',
      species: '龙',
      purpose: 'adoption',
      adoptionStatus: 'adopted',
      featured: true,
      sortOrder: 2,
      adoptionCover: { alt: '月桂横版领养封面', width: 1920, height: 1080 },
      photos: [],
    },
  ])
}

async function swipeTouch(
  page: import('@playwright/test').Page,
  target: import('@playwright/test').Locator,
  deltaX: number,
  deltaY: number,
) {
  const box = await target.boundingBox()
  if (!box) throw new Error('Swipe target is not visible.')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const session = await page.context().newCDPSession(page)
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  })
  for (let step = 1; step <= 6; step += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{
        x: x + deltaX * step / 6,
        y: y + deltaY * step / 6,
      }],
    })
    await page.waitForTimeout(25)
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await session.detach()
  await page.waitForTimeout(500)
}

test('代表作品左对齐与七张详情图的横竖屏触控和溢出', async ({ browser }) => {
  const page = await browser.newPage({ hasTouch: true, reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await seedPublicCatalog(page, [{
    slug: 'e2e-public-seven-images', characterName: '七张图预览', species: '犬科',
    purpose: 'adoption', adoptionStatus: 'available', featured: true,
    photos: Array.from({ length: 5 }, (_, index) => ({ alt: `出厂照 ${index + 1}` })),
    adoptionCover: { alt: '横版封面', width: 3200, height: 1800 },
    designSheet: { alt: '设定图' },
  }])
  for (const [width, height] of [[320, 740], [390, 844], [667, 375], [844, 390], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width: width!, height: height! })
    await page.goto(`${publicBaseURL}/`)
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    const aligned = await page.locator('.featured-works').evaluate(element => {
      const selectors = ['.featured-works__title', '.featured-works__species', '.featured-works__action']
      const lefts = selectors.map(selector => element.querySelector(selector)!.getBoundingClientRect().left)
      return Math.max(...lefts) - Math.min(...lefts)
    })
    expect(aligned).toBeLessThan(1)

    await page.goto(`${publicBaseURL}/works/e2e-public-seven-images`)
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    const thumbs = page.locator('.work-gallery__thumb')
    await expect(thumbs).toHaveCount(7)
    const strip = page.locator('.work-gallery__thumbs')
    const stage = page.locator('.work-gallery__stage')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    const dimensions = await strip.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight }))
    if (width! < 480) expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width)
    if (width! >= 768) expect(dimensions.height).toBeLessThanOrEqual((await stage.boundingBox())!.height + 1)
    const box = (await thumbs.first().boundingBox())!
    expect(Math.abs(box.width - box.height)).toBeLessThan(1)
    expect(box.width).toBeGreaterThanOrEqual(44)
    await stage.scrollIntoViewIfNeeded()
    await swipeTouch(page, stage, -110, 40)
    await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await swipeTouch(page, stage, 110, -40)
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'true')
    await swipeTouch(page, stage, 110, 30)
    await expect(thumbs.last()).toHaveAttribute('aria-pressed', 'true')
    expect(await thumbs.last().evaluate(el => {
      const item = el.getBoundingClientRect()
      const parent = el.parentElement!.getBoundingClientRect()
      return item.left >= parent.left - 1 && item.right <= parent.right + 1 && item.top >= parent.top - 1 && item.bottom <= parent.bottom + 1
    })).toBe(true)
    await swipeTouch(page, stage, 15, -100)
    await expect(thumbs.last()).toHaveAttribute('aria-pressed', 'true')
    await thumbs.first().focus()
    await page.keyboard.press('Enter')
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'true')
    expect(await page.locator('.work-gallery img').evaluateAll(async images => Promise.all(images.map(async image => {
      try { await (image as HTMLImageElement).decode(); return true }
      catch { return false }
    })))).not.toContain(false)
  }
  await page.goto(`${publicBaseURL}/works/e2e-public-seven-images?from=adoptions`)
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
  await expect(page.locator('.work-gallery__thumb[aria-pressed="true"]')).toBeInViewport()
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.locator('.work-gallery__thumb[aria-pressed="true"]').evaluate(el => {
      const item = el.getBoundingClientRect()
      const strip = el.parentElement!.getBoundingClientRect()
      return item.left >= strip.left - 1 && item.right <= strip.right + 1 && item.top >= strip.top - 1 && item.bottom <= strip.bottom + 1
    })).toBe(true)
  }
  expect(errors).toEqual([])
  await page.close()
})

async function fillCommission(
  page: import('@playwright/test').Page,
  input: { nickname: string, phone: string },
) {
  await page.goto(`${publicBaseURL}/commission/apply`)
  await expect(page.getByRole('heading', { level: 1, name: '提交委托申请' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.getByLabel(/称呼/u).fill(input.nickname)
  await page.getByLabel(/物种/u).fill('犬科')
  await page.getByLabel(/中国大陆手机号/u).fill(input.phone)
  await page.getByLabel(/^QQ/u).fill('999999')
  await page.getByLabel(/身高/u).fill('170')
  await page.getByLabel(/体重/u).fill('60.5')
  await expect(page.getByLabel(/称呼/u)).toHaveValue(input.nickname)
  await page.getByRole('button', { name: '设定图', exact: true }).setInputFiles({
    name: 'smoke-design-reference.png',
    mimeType: 'image/png',
    buffer: smallStudioPng(),
  })
  await expect(page.getByAltText('所选设定图预览')).toBeVisible()
}

async function confirmCommission(page: import('@playwright/test').Page) {
  await page.getByLabel(/已年满 18 周岁/u).check()
  await page.getByLabel(/已阅读《隐私政策》/u).check()
}

test('首页 SSR head 输出分享与站点验证元数据', async ({ request }) => {
  const response = await request.get('/')
  expect(response.ok()).toBe(true)

  const html = await response.text()
  const title = '有点小狗工作室 · 兽装作品主页'
  const description = '有点小狗工作室（DITE DOG）的兽装作品主页：我们不只做小狗毛，但是只做手削海绵头！欢迎在本站浏览代表作品、提交自设委托或者领养申请。'

  expect(html).toMatch(/<html\b(?=[^>]*\blang="zh-CN")[^>]*>/u)
  expect(html).toContain(`<meta name="baidu-site-verification" content="codeva-zXVT7kIEMT">`)
  expect(html).toContain(`<meta property="og:title" content="${title}">`)
  expect(html).toContain(`<meta property="og:description" content="${description}">`)
  expect(html).toContain('<meta property="og:type" content="website">')
  expect(html).toContain('<meta property="og:locale" content="zh_CN">')
  expect(html).toContain('<meta property="og:image:alt" content="有点小狗工作室品牌标志">')
  expect(html).toContain(`<meta itemprop="name" content="${title}">`)
  expect(html).toContain(`<meta itemprop="description" content="${description}">`)
  expect(html).toMatch(/<meta itemprop="image" content="http:\/\/127\.0\.0\.1:\d+\/brand\/og-default\.c34fe375\.png">/u)

  const sharingImage = await request.get('/brand/og-default.c34fe375.png')
  expect(sharingImage.ok()).toBe(true)
  expect(sharingImage.headers()['content-type']).toBe('image/png')
  expect((await request.get('/brand/og-default.png')).status()).toBe(404)
})

test('首页加载、主要入口与单项开放领养在六种视口可达', async ({ page }) => {
  await seedSmokeCatalog(page)
  await seedHeroCollections(page, {
    landscape: [{ alt: 'Smoke 首页横版', sortOrder: 0, enabled: true }],
    portrait: [{ alt: 'Smoke 首页竖版', sortOrder: 0, enabled: true }],
  })
  await seedHeroCollections(page, {
    placement: 'commission',
    landscape: [{ alt: 'Smoke 委托横版', sortOrder: 0, enabled: true }],
    portrait: [{ alt: 'Smoke 委托竖版', sortOrder: 0, enabled: true }],
  })

  for (const viewport of [
    { width: 375, height: 734 },
    { width: 390, height: 844 },
    { width: 767, height: 1024 },
    { width: 768, height: 1024 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByTestId('public-home')).toBeVisible()
    // SSR 内容会先可见；wheel 行为必须等 Vue 挂载、onMounted 监听器就绪。
    await page.waitForFunction(() => Boolean(
      (document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })
        ?.__vue_app__,
    ))
    await expect(page.getByTestId('featured-works')
      .locator('a[href^="/works/e2e-public-smoke-work"]')).toBeVisible()
    await expect(page.getByTestId('featured-works')
      .getByRole('link', { name: '浏览作品展示' })).toBeVisible()
    await expect(page.getByRole('link', { name: /提交委托申请/u }).first()).toBeVisible()
    const current = page.getByTestId('home-current-adoptions')
    await expect(current).toBeVisible()
    await expect(current.getByRole('article')).toHaveCount(1)
    await expect(current).toContainText('云雀')
    await expect(current).not.toContainText('月桂')
    const typography = await page.evaluate(() => {
      const read = (selector: string) => {
        const style = getComputedStyle(document.querySelector(selector)!)
        return {
          color: style.color,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight,
        }
      }
      return {
        featuredName: read('.featured-works__title'),
        adoptionName: read('.home-adoption-poster__identity h3'),
        featuredSpecies: read('.featured-works__species'),
        adoptionSpecies: read('.home-adoption-poster__species'),
      }
    })
    expect(typography.featuredName).toEqual(typography.adoptionName)
    expect(typography.featuredSpecies).toEqual(typography.adoptionSpecies)
    const identityAlignment = await page.evaluate(() => {
      const left = (selector: string) => (
        document.querySelector(selector)!.getBoundingClientRect().left
      )
      return {
        adoption: Math.abs(
          left('.home-adoption-poster__identity')
          - left('.home-adoption-poster__species'),
        ),
        featured: Math.abs(
          left('.featured-works__title') - left('.featured-works__species'),
        ),
        factsBorderTopWidth: getComputedStyle(
          document.querySelector('.home-adoption-poster__facts')!,
        ).borderTopWidth,
        speciesLabelDisplay: getComputedStyle(
          document.querySelector('.home-adoption-poster__species-label')!,
        ).display,
        folioDisplay: getComputedStyle(
          document.querySelector('.home-adoption-poster__folio')!,
        ).display,
        mediaCaptionGap: Math.round(
          document.querySelector('.home-adoption-poster__caption')!.getBoundingClientRect().top
          - document.querySelector('.home-adoption-poster__media')!.getBoundingClientRect().bottom,
        ),
        nameSpeciesGap: {
          adoption: Math.round(
            document.querySelector('.home-adoption-poster__species')!.getBoundingClientRect().top
            - document.querySelector('.home-adoption-poster__identity h3')!.getBoundingClientRect().bottom,
          ),
          featured: Math.round(
            document.querySelector('.featured-works__species')!.getBoundingClientRect().top
            - document.querySelector('.featured-works__title')!.getBoundingClientRect().bottom,
          ),
        },
      }
    })
    expect(identityAlignment.adoption).toBeLessThanOrEqual(1)
    expect(identityAlignment.featured).toBeLessThanOrEqual(1)
    expect(identityAlignment.factsBorderTopWidth === '0px')
      .toBe(viewport.width <= 1024)
    expect(identityAlignment.speciesLabelDisplay === 'none')
      .toBe(viewport.width <= 1024)
    expect(identityAlignment.folioDisplay === 'none')
      .toBe(viewport.width <= 1024)
    if (viewport.width <= 1024) {
      expect(identityAlignment.nameSpeciesGap.adoption)
        .toBe(identityAlignment.nameSpeciesGap.featured)
    }
    if (viewport.width >= 768 && viewport.width <= 1024)
      expect(identityAlignment.mediaCaptionGap).toBeGreaterThanOrEqual(23)
    if (viewport.width <= 480) {
      const layout = await current.evaluate((element) => {
        const facts = element.querySelector<HTMLElement>('.home-adoption-poster__facts')!
        const actions = element.querySelector<HTMLElement>('.home-adoption-poster__actions')!
        const factsRect = facts.getBoundingClientRect()
        const actionsRect = actions.getBoundingClientRect()
        return {
          factsOverflow: facts.scrollWidth - facts.clientWidth,
          overlap: factsRect.left < actionsRect.right
            && factsRect.right > actionsRect.left
            && factsRect.top < actionsRect.bottom
            && factsRect.bottom > actionsRect.top,
        }
      })
      expect(layout.factsOverflow).toBeLessThanOrEqual(1)
      expect(layout.overlap).toBe(false)
    }
    if (viewport.width >= 768) {
      const title = page.getByTestId('featured-works')
        .locator('.featured-works__title-text')
      expect(await title.evaluate(element => (
        element.scrollHeight - element.clientHeight
      ))).toBeLessThanOrEqual(1)
    }
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.mouse.wheel(0, 800)
  await page.waitForTimeout(700)
  await page.mouse.wheel(0, 800)
  await expect.poll(() => page.evaluate(() => {
    const scenes = [...document.querySelectorAll<HTMLElement>('[data-home-scroll-scene]')]
    return scenes.reduce((closest, scene, index) => (
      Math.abs(scene.getBoundingClientRect().top)
        < Math.abs(scenes[closest]!.getBoundingClientRect().top)
        ? index
        : closest
    ), 0)
  })).toBe(2)

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(700)
  await page.mouse.wheel(0, 800)
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)))
    .toBeGreaterThan(0)
  await page.waitForTimeout(700)
  await page.mouse.wheel(0, -800)
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)))
    .toBe(0)

  await page.getByTestId('featured-works').evaluate(element => (
    element.scrollIntoView({ block: 'start', behavior: 'instant' })
  ))
  await page.evaluate(() => {
    const featured = document.querySelector<HTMLElement>('[data-testid="featured-works"]')
    const initialTop = featured?.getBoundingClientRect().top ?? 0
    const probe = { initialTop, maxShift: 0 }
    ;(window as typeof window & { __homeExitLayoutProbe?: typeof probe })
      .__homeExitLayoutProbe = probe

    const measure = () => {
      const current = document.querySelector<HTMLElement>('[data-testid="featured-works"]')
      if (!current) {
        return
      }
      probe.maxShift = Math.max(
        probe.maxShift,
        Math.abs(current.getBoundingClientRect().top - probe.initialTop),
      )
      requestAnimationFrame(measure)
    }
    requestAnimationFrame(measure)
  })
  await page.getByTestId('featured-works')
    .getByRole('link', { name: '浏览作品展示' })
    .click()
  expect(await page.evaluate(() => (
    (window as typeof window & {
      __homeExitLayoutProbe?: { maxShift: number }
    }).__homeExitLayoutProbe?.maxShift ?? Number.POSITIVE_INFINITY
  ))).toBeLessThanOrEqual(1)

  await page.goto('/')
  await page.getByTestId('featured-works')
    .locator('a[href^="/works/e2e-public-smoke-work"]')
    .click()
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)))
    .toBe(0)
  await expect(page.getByRole('link', { name: '返回作品展示' }))
    .toHaveAttribute('href', '/works')

  await page.goto('/')
  await page.getByTestId('home-current-adoptions')
    .getByTestId('home-adoption-media-link')
    .click()
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)))
    .toBe(0)
  await expect(page.getByRole('link', { name: '返回设定领养' }))
    .toHaveAttribute('href', '/adoptions')
})

test('旧联系页保持 301 跳转到关于页联系区', async ({ request }) => {
  const response = await request.get(`${publicBaseURL}/contact`, {
    maxRedirects: 0,
  })
  expect(response.status()).toBe(301)
  expect(response.headers().location).toBe('/about#contact')
})

test('首页滚出 Hero 后移动导航仍覆盖完整视口', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForFunction(() => Boolean(
    (document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })
      ?.__vue_app__,
  ))
  await page.evaluate(() => window.scrollTo(0, 900))
  await expect(page.getByTestId('public-header')).toHaveClass(/public-header--scrolled/u)

  await page.getByRole('button', { name: '打开导航' }).click()
  const panel = page.getByTestId('public-mobile-nav')
  await expect(panel).toBeVisible()
  await expect.poll(() => panel.evaluate(element => (
    Math.round(element.getBoundingClientRect().height)
  ))).toBe(844)
})

test('1024px 触控 Header 首次点击展开关于我们二级菜单', async ({ browser }) => {
  const page = await browser.newPage({
    hasTouch: true,
    viewport: { width: 1024, height: 900 },
  })
  await page.goto(`${publicBaseURL}/`)
  await page.waitForFunction(() => Boolean(
    (document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })
      ?.__vue_app__,
  ))
  await page.waitForTimeout(500)

  const trigger = page.getByRole('button', { name: '关于我们' })
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.tap()

  await expect(page).toHaveURL(`${publicBaseURL}/`)
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const subnav = page.getByRole('navigation', { name: '关于我们二级导航' })
  await expect(subnav).toBeVisible()
  await subnav.getByRole('link', { name: '关于我们', exact: true }).tap()
  await expect(page).toHaveURL(`${publicBaseURL}/about`)

  await page.close()
})

test('手机可在首页整幕和代表作品图片上斜向滑动切换', async ({ browser }) => {
  const page = await browser.newPage({
    hasTouch: true,
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
  })
  await seedPublicCatalog(page, [
    {
      slug: 'e2e-public-touch-one',
      characterName: '触控一号',
      species: '犬科',
      purpose: 'showcase',
      featured: true,
      sortOrder: 0,
      photos: [{ alt: '触控一号出厂照', width: 2400, height: 3200 }],
    },
    {
      slug: 'e2e-public-touch-two',
      characterName: '触控二号',
      species: '狐',
      purpose: 'showcase',
      featured: true,
      sortOrder: 1,
      photos: [{ alt: '触控二号出厂照', width: 2400, height: 3200 }],
    },
  ])
  await seedHeroCollections(page, {
    landscape: [
      { alt: '触控首页横版一', sortOrder: 0, enabled: true },
      { alt: '触控首页横版二', sortOrder: 1, enabled: true },
    ],
    portrait: [
      { alt: '触控首页竖版一', sortOrder: 0, enabled: true },
      { alt: '触控首页竖版二', sortOrder: 1, enabled: true },
    ],
  })
  await page.goto(`${publicBaseURL}/`)
  await page.waitForFunction(() => Boolean(
    (document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })
      ?.__vue_app__,
  ))
  await page.waitForTimeout(500)

  const hero = page.getByTestId('public-hero')
  await swipeTouch(page, hero, -140, 18)
  await expect(hero.locator('.home-hero__dot').nth(1)).toHaveAttribute('aria-current', 'true')
  await swipeTouch(page, hero, 30, 140)
  await expect(hero.locator('.home-hero__dot').nth(1)).toHaveAttribute('aria-current', 'true')
  await expect(hero.getByRole('button', { name: '上一张' })).toHaveCSS('opacity', '1')

  const featured = page.getByTestId('featured-works')
  await featured.scrollIntoViewIfNeeded()
  const media = featured.locator('.featured-works__media')
  await expect(media).toHaveAttribute('data-work-slug', 'e2e-public-touch-one')
  await swipeTouch(page, media, -120, 14)
  await expect(media).toHaveAttribute('data-work-slug', 'e2e-public-touch-two')
  await expect(page).toHaveURL(`${publicBaseURL}/`)
  await expect(featured.getByRole('button', { name: '上一项代表作品' })).toHaveCSS('opacity', '1')

  await media.tap()
  await expect(page).toHaveURL(`${publicBaseURL}/works/e2e-public-touch-two`)
  await page.close()
})

test('首页领养图片支持斜向触屏切换且轻点仍进入详情', async ({ browser }) => {
  const page = await browser.newPage({ hasTouch: true, reducedMotion: 'reduce' })
  const works = [1, 2, 3].map(index => ({
    slug: `e2e-public-adoption-touch-${index}` as const,
    characterName: `领养${index}`,
    purpose: 'adoption' as const,
    adoptionStatus: 'available' as const,
    adoptionCover: { alt: `领养封面${index}`, width: 3200, height: 1800 },
    photos: [],
  }))
  await seedPublicCatalog(page, works)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport)
    await page.goto(`${publicBaseURL}/`)
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    const scene = page.getByTestId('home-current-adoptions')
    const poster = scene.locator('.home-adoption-poster')
    const media = page.getByTestId('home-adoption-media-link')
    const slugs = await scene.locator('.home-adoption-poster__selector-item').evaluateAll(items => items.map(item => item.getAttribute('data-work-slug')!))
    await media.scrollIntoViewIfNeeded()
    await expect(poster).toHaveAttribute('data-work-slug', slugs[0]!)
    await swipeTouch(page, media, -110, 35)
    await expect(poster).toHaveAttribute('data-work-slug', slugs[1]!)
    await expect(page).toHaveURL(`${publicBaseURL}/`)
    await swipeTouch(page, media, 110, -35)
    await expect(poster).toHaveAttribute('data-work-slug', slugs[0]!)
    await swipeTouch(page, media, 110, 25)
    await expect(poster).toHaveAttribute('data-work-slug', slugs[2]!)
    await swipeTouch(page, media, 20, -90)
    await expect(poster).toHaveAttribute('data-work-slug', slugs[2]!)
    await expect(page).toHaveURL(`${publicBaseURL}/`)
    await media.scrollIntoViewIfNeeded()
    await media.tap()
    await expect(page).toHaveURL(`${publicBaseURL}/works/${slugs[2]}?from=adoptions`)
  }
  await seedPublicCatalog(page, [works[0]!])
  await page.goto(`${publicBaseURL}/`)
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
  const media = page.getByTestId('home-adoption-media-link')
  await media.scrollIntoViewIfNeeded()
  await swipeTouch(page, media, -110, 35)
  await expect(page.locator('.home-adoption-poster')).toHaveAttribute('data-work-slug', works[0]!.slug)
  await media.tap()
  await expect(page).toHaveURL(`${publicBaseURL}/works/${works[0]!.slug}?from=adoptions`)
  expect(errors).toEqual([])
  await page.close()
})

test('作品目录与作品详情可达', async ({ page }, testInfo) => {
  await seedSmokeCatalog(page)
  await page.goto('/works')
  await expect(page.getByRole('heading', { level: 1, name: '作品展示' })).toBeVisible()
  await page.locator('[data-work-slug="e2e-public-smoke-work"]').click()
  await expect(page).toHaveURL(/\/works\/e2e-public-smoke-work$/u)
  await expect(page.getByRole('heading', { level: 1, name: '烟火' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const heading = await page.getByRole('heading', { level: 1, name: '烟火' }).boundingBox()
  const media = await page.locator('.work-detail__media').boundingBox()
  const facts = await page.locator('.work-detail__identity-ledger').boundingBox()
  expect(heading && media && facts && heading.y < media.y && media.y < facts.y).toBeTruthy()
  await page.screenshot({ path: testInfo.outputPath('detail-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: testInfo.outputPath('detail-desktop.png'), fullPage: true })
})

test('低高度屏幕仍显示代表作品，横屏菜单可滚动到最后入口', async ({ page }, testInfo) => {
  await seedSmokeCatalog(page)
  await page.setViewportSize({ width: 667, height: 375 })
  await page.goto('/')
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
  const media = page.getByTestId('featured-works').locator('.featured-works__media')
  await media.scrollIntoViewIfNeeded()
  const box = await media.boundingBox()
  expect(box && box.width > 0 && box.height > 0).toBeTruthy()
  await page.screenshot({ path: testInfo.outputPath('featured-low-height.png') })
  await page.setViewportSize({ width: 844, height: 390 })
  await page.getByRole('button', { name: '打开导航' }).click()
  const menu = page.getByRole('dialog', { name: '站点导航' })
  await menu.getByRole('link', { name: '隐私政策', exact: true }).scrollIntoViewIfNeeded()
  await expect(menu.getByRole('link', { name: '隐私政策', exact: true })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('nav-landscape.png') })
  await menu.getByRole('link', { name: '隐私政策', exact: true }).click()
  await expect(page).toHaveURL(/\/privacy$/u)
})

test('目录刷新失败显示可恢复错误，无领养内容时突出浏览作品', async ({ page }, testInfo) => {
  await seedSmokeCatalog(page)
  for (const path of ['/works', '/adoptions']) {
    await page.goto(`${path}?q=no-matching-review-name`)
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    const endpoint = `**/api/public/v1${path}*`
    await page.route(endpoint, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
    await page.getByRole('link', { name: '清除', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('角色列表加载失败')
    await expect(page.getByText('作品正在整理中。')).toHaveCount(0)
    await expect(page.getByText('当前没有可领养的角色')).toHaveCount(0)
    await page.unroute(endpoint)
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await expect(page.locator('[data-work-slug]').first()).toBeVisible()
  }
  await seedPublicCatalog(page, [])
  await page.goto('/adoptions')
  await expect(page.getByRole('search')).toHaveCount(0)
  await expect(page.getByTestId('adoption-contact-action')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '浏览作品展示', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '联系我们', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath('adoptions-empty-mobile.png'), fullPage: true })
})

test('领养目录只公开 available 并可进入统一详情', async ({ page }) => {
  await seedSmokeCatalog(page)
  await page.goto('/adoptions')
  const cards = page.locator('.adoptions-page__grid [data-work-slug]')
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('云雀')
  await expect(page.locator('.adoptions-page__grid')).not.toContainText('月桂')
  await cards.first().click()
  await expect(page).toHaveURL(/\/works\/e2e-public-smoke-available\?from=adoptions$/u)
  await expect(page.getByRole('link', { name: '返回设定领养' }))
    .toHaveAttribute('href', '/adoptions')
  await expect(page.getByTestId('adoption-detail-status')).toHaveText('可领养')
  await expect(page.getByTestId('adoption-contact-action'))
    .toHaveAttribute('href', '/about#contact')

  await page.goto('/works/e2e-public-smoke-adopted')
  await expect(page.getByTestId('adoption-detail-status')).toHaveText('已领养')
  await expect(page.getByRole('button', { name: '已被领养' })).toBeDisabled()
  await expect(page.getByRole('link', { name: '联系咨询领养' })).toHaveCount(0)
})

test('委托申请成功并且私有设定图不生成公开对象', async ({ page }) => {
  await resetFakeMedia(page)
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto(`${publicBaseURL}/commission/apply`)
    await expect(page.getByLabel(/已年满 18 周岁/u)).not.toBeChecked()
    await expect(page.getByLabel(/已阅读《隐私政策》/u)).not.toBeChecked()
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }
  await fillCommission(page, {
    nickname: 'Smoke 成功申请',
    phone: '19900000001',
  })
  await expect(page.getByLabel(/已年满 18 周岁/u)).not.toBeChecked()
  await expect(page.getByLabel(/已阅读《隐私政策》/u)).not.toBeChecked()
  await page.getByRole('button', { name: '确认提交' }).click()
  const validationSummary = page.getByRole('alert')
    .filter({ hasText: '请检查下方 2 项信息后再提交' })
  await expect(validationSummary).toContainText('请检查下方 2 项信息后再提交')
  await expect(validationSummary).toBeFocused()
  await expect(page.getByText('请确认已年满 18 周岁')).toBeVisible()
  await expect(page.getByText('请阅读隐私政策并确认')).toBeVisible()
  await expect(page.getByAltText('所选设定图预览')).toBeVisible()
  expect((await fakeMediaState(page)).putRecords).toHaveLength(0)
  await page.getByLabel(/已年满 18 周岁/u).focus()
  await page.keyboard.press('Space')
  await page.getByLabel(/已阅读《隐私政策》/u).focus()
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('申请已收到')).toBeVisible()
})

test('同手机号待处理申请拒绝重复提交并保留所选图片', async ({ page }) => {
  await resetFakeMedia(page)
  await fillCommission(page, {
    nickname: 'Smoke 首次申请',
    phone: '19900000002',
  })
  await confirmCommission(page)
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('申请已收到')).toBeVisible()

  await fillCommission(page, {
    nickname: 'Smoke 重复申请',
    phone: '19900000002',
  })
  await confirmCommission(page)
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('该手机号已有待处理的委托申请')).toBeVisible()
  await page.getByLabel(/中国大陆手机号/u).focus()
  await page.getByLabel(/中国大陆手机号/u).press('Tab')
  await expect(page.getByText('该手机号已有待处理的委托申请')).toBeVisible()
  await expect(page.getByAltText('所选设定图预览')).toBeVisible()
})

test('申请已写入但响应丢失时保留输入且不重复提交', async ({ page }) => {
  await resetFakeMedia(page)
  const nickname = 'Smoke 回执响应丢失'
  await fillCommission(page, { nickname, phone: '19900000004' })
  await confirmCommission(page)
  let submissions = 0
  await page.route('**/api/public/v1/commission-submissions', async (route) => {
    submissions += 1
    const response = await route.fetch()
    expect(response.status()).toBe(201)
    await route.abort('failed')
  })
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByRole('alert')).toContainText('尚未确认本次申请是否提交成功')
  await expect(page.getByRole('button', { name: '确认提交' })).toBeDisabled()
  await expect(page.getByLabel(/中国大陆手机号/u)).toBeDisabled()
  const submitButton = page.getByRole('button', { name: '确认提交' })
  const disabledBackground = await submitButton.evaluate(el => getComputedStyle(el).backgroundColor)
  await submitButton.hover()
  expect(await submitButton.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(disabledBackground)
  await expect(page.getByLabel(/称呼/u)).toHaveValue(nickname)
  await expect(page.getByAltText('所选设定图预览')).toBeVisible()
  await expect(page.getByRole('link', { name: '在新窗口联系工作室核对' })).toHaveAttribute('target', '_blank')
  await page.locator('.commission-apply__form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(submissions).toBe(1)
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
  try {
    expect(sqlite.prepare('SELECT count(*) FROM commission_submissions WHERE nickname = ?').pluck().get(nickname)).toBe(1)
  }
  finally {
    sqlite.close()
  }
})

test('管理端对已拒绝申请先脱敏 dry-run，再单条删除', async ({ page, request }) => {
  await resetFakeMedia(page)
  const nickname = `Smoke 删除-${Date.now().toString(36)}`
  const phone = '19900000003'
  const qq = '999999'
  await fillCommission(page, { nickname, phone })
  await confirmCommission(page)
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('申请已收到')).toBeVisible()

  await loginAsAdmin(page)
  await page.goto(`${adminBaseURL}/admin/commissions`)
  await page.locator('.commission-inbox__item:visible').filter({ hasText: nickname }).click()
  await expect(page).toHaveURL(/\/admin\/commissions\/[0-9a-f-]+$/u)
  await page.getByRole('combobox', { name: '状态', exact: true }).click()
  await page.getByRole('option', { name: '已拒绝', exact: true }).click()
  await page.getByRole('button', { name: '保存处理结果' }).click()
  await expect(page.getByRole('region', { name: '处理', exact: true }).getByRole('status')).toContainText('处理结果已保存')
  const submissionId = new URL(page.url()).pathname.split('/').at(-1)!

  await page.goto(`${adminBaseURL}/admin/commissions?status=rejected`)
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto(`${adminBaseURL}/admin/commissions?status=rejected`)
    const row = page.locator('.commission-inbox__row:visible').filter({ hasText: nickname })
    await expect(row.getByRole('button', { name: '删除申请数据' })).toBeVisible()
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }
  const rejectedRow = page.locator('.commission-inbox__row:visible').filter({ hasText: nickname })
  await rejectedRow.locator('.commission-inbox__item:visible').click()
  await expect(page.getByRole('heading', { name: '删除申请数据' })).toBeVisible()

  const unauthenticated = await request.post(
    `${adminBaseURL}/api/admin/v1/commissions/${submissionId}/deletion`,
    {
      data: { execute: false },
      headers: { origin: adminBaseURL },
    },
  )
  expect(unauthenticated.status()).toBe(401)

  await page.getByRole('button', { name: '删除申请数据' }).click()
  const dialog = page.getByRole('dialog', { name: '确认删除这一条申请？' })
  await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: '确认永久删除' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: '删除申请数据' })).toBeFocused()
  await page.getByRole('button', { name: '删除申请数据' }).click()
  await expect(dialog).toContainText('dry-run')
  await expect(dialog).toContainText('数据库直接关联行')
  await expect(dialog).toContainText('私有对象 Key：1')
  await expect(dialog).not.toContainText(phone)
  await expect(dialog).not.toContainText(qq)
  await expect(dialog).not.toContainText('test/commission')

  let executeRequests = 0
  let releaseExecute!: () => void
  const executeGate = new Promise<void>((resolve) => {
    releaseExecute = resolve
  })
  await page.route('**/api/admin/v1/commissions/*/deletion', async (route) => {
    executeRequests += 1
    await executeGate
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'synthetic deletion failure' },
      }),
    })
  }, { times: 1 })
  const confirm = dialog.locator('[data-confirm]')
  await confirm.evaluate((button) => {
    button.click()
    button.click()
  })
  await expect(confirm).toBeDisabled()
  await expect.poll(() => executeRequests).toBe(1)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await dialog.evaluate((element) => {
    element.click()
  })
  await expect(dialog).toBeVisible()
  releaseExecute()

  await expect(dialog).toContainText('删除失败，数据库关系已保留或可安全重入')
  await expect(confirm).toBeEnabled()
  await confirm.click()

  await expect(page).toHaveURL(/\/admin\/commissions\?status=rejected$/u)
  await expect(page.locator('.commission-inbox__row:visible').filter({ hasText: nickname })).toHaveCount(0)
  expect((await fakeMediaState(page)).objects.some(key => key.includes('/commission/'))).toBe(false)
})

test('管理员可通过登录表单进入后台', async ({ page }) => {
  await page.goto(`${adminBaseURL}/admin/login`)
  await page.getByLabel('用户名').fill(E2E_ADMIN.username)
  await page.getByLabel('密码', { exact: true }).fill(E2E_ADMIN.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/\/admin\/works/u)
  await expect(page.getByTestId('admin-shell')).toBeVisible()

  await page.goto(`${adminBaseURL}/admin/site/content`)
  await expect(page.getByTestId('content-admin')).toBeVisible()
  await page.getByRole('button', { name: '营业与联系', exact: true }).click()
  await expect(page.getByRole('heading', { name: '联系方式', exact: true })).toBeVisible()
  await expect(page.getByText('防诈骗')).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const navTrigger = page.getByRole('button', { name: '打开管理导航' })
  for (const width of [320, 390, 430, 768, 1023]) {
    await page.setViewportSize({ width, height: 844 })
    const brand = await page.getByText('有点小狗工作室', { exact: true }).boundingBox()
    const trigger = await navTrigger.boundingBox()
    expect(brand).not.toBeNull()
    expect(trigger).not.toBeNull()
    expect(brand!.x + brand!.width).toBeLessThan(trigger!.x)
    expect(Math.abs(brand!.y + brand!.height / 2 - trigger!.y - trigger!.height / 2)).toBeLessThan(8)
    expect(trigger!.width).toBeGreaterThanOrEqual(44)
    expect(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await navTrigger.click()
  const nav = page.getByRole('dialog', { name: '管理导航' })
  await expect(nav.getByRole('link')).toHaveCount(6)
  await expect(nav).not.toContainText('→')
  await expect(nav.getByRole('link', { name: '站点配置', exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(nav.getByRole('button', { name: '关闭管理导航' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(nav.getByRole('button', { name: '退出登录' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(nav).toBeHidden()
  await expect(navTrigger).toBeFocused()
  expect(await page.locator('main').evaluate(el => (el as HTMLElement).inert)).toBe(false)

  await navTrigger.click()
  await nav.getByRole('link', { name: '站点配置', exact: true }).click()
  await expect(nav).toBeHidden()
  await expect(navTrigger).toBeFocused()
  for (const width of [1024, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(navTrigger).toBeHidden()
    await expect(page.getByRole('navigation', { name: '管理导航', exact: true })).toBeVisible()
  }
})

test('作品上传显示真实 XHR determinate 进度，并可发布和下架', async ({ page }) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await loginAsAdmin(page)
  await resetFakeMedia(page)
  const work = await createWorkViaApi(page, { characterName: 'Smoke 发布作品' })
  await page.clock.install()
  await page.goto(`${adminBaseURL}/admin/works/${work.id}`)

  let releasePut!: () => void
  let markPutSeen!: () => void
  let markPutHandled!: () => void
  const putGate = new Promise<void>((resolve) => {
    releasePut = resolve
  })
  const putSeen = new Promise<void>((resolve) => {
    markPutSeen = resolve
  })
  const putHandled = new Promise<void>((resolve) => {
    markPutHandled = resolve
  })
  await page.route('**/api/e2e-fake-oss/**', async (route) => {
    if (route.request().method() === 'PUT') {
      markPutSeen()
      await putGate
    }
    await route.continue()
    if (route.request().method() === 'PUT') {
      markPutHandled()
    }
  })

  await page.getByLabel('选择出厂照文件').setInputFiles({
    name: 'smoke-upload.png',
    mimeType: 'image/png',
    buffer: publishableStudioPng(),
  })
  await page.getByRole('button', { name: '上传出厂照' }).click()
  await putSeen
  const uploadProgress = page.getByTestId('admin-task-progress')
    .filter({ hasText: 'smoke-upload.png' })
  await expect(uploadProgress).toBeVisible()
  const nativeProgress = uploadProgress.locator('progress')
  await expect(nativeProgress).toBeVisible()
  await expect(nativeProgress).toHaveAttribute('max', '1')
  await expect(nativeProgress).toHaveAttribute('value')
  releasePut()
  await putHandled
  await page.unroute('**/api/e2e-fake-oss/**')

  const photo = page.locator('article.photo-card').first()
  await expect(photo).toBeVisible()
  await photo.getByLabel(/图片说明/u).fill('Smoke 发布图')
  await page.getByRole('button', { name: '保存出厂照' }).click()
  await expect(page.getByText('出厂照已保存。')).toBeVisible()
  await expect(page.getByLabel('设为代表作品')).toBeDisabled()

  const panel = page.getByTestId('publication-panel')
  await panel.getByRole('button', { name: '发布', exact: true }).click()
  await expect(panel.getByTestId('admin-task-progress')).toContainText('作品发布')
  await expect(panel).toContainText('发布成功', { timeout: 60_000 })

  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000))
  await page.clock.fastForward(150_000)
  let releaseUnpublish!: () => void
  const unpublishGate = new Promise<void>((resolve) => { releaseUnpublish = resolve })
  await page.route('**/unpublish', async (route) => {
    await unpublishGate
    await route.continue()
  })
  await panel.getByRole('button', { name: '下架', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认下架' }).click()
  const elapsed = panel.locator('.admin-task-progress__elapsed')
  await expect(elapsed).toHaveText('已等待 0 秒')
  await page.clock.runFor(3_000)
  await expect(elapsed).toHaveText('已等待 3 秒')
  releaseUnpublish()
  await expect(panel.getByTestId('admin-task-progress')).toHaveAttribute('data-status', 'success')
  await expect(panel.getByRole('button', { name: '发布', exact: true })).toBeEnabled()
  await page.unroute('**/unpublish')

  await page.clock.fastForward(150_000)
  let releasePublish!: () => void
  const publishGate = new Promise<void>((resolve) => { releasePublish = resolve })
  await page.route('**/publish', async (route) => {
    await publishGate
    await route.continue()
  })
  await panel.getByRole('button', { name: '发布', exact: true }).click()
  await expect(elapsed).toHaveText('已等待 0 秒')
  await page.clock.runFor(2_000)
  await expect(elapsed).toHaveText('已等待 2 秒')
  releasePublish()
  await expect(panel).toContainText('发布成功', { timeout: 60_000 })
  await page.unroute('**/publish')

  await page.goto(`${adminBaseURL}/admin/works`)
  const workRow = page.locator('tbody tr').filter({ hasText: 'Smoke 发布作品' })
  await expect(workRow.getByLabel('设为代表作品')).toBeDisabled()
  await expect(workRow).toContainText('需先上传至少一张竖版出厂照')
})

test('隐私、服务条款和开源软件声明可读', async ({ page }) => {
  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]] as const) {
    await page.setViewportSize({ width, height })
    for (const [path, heading] of [
      ['/privacy', '隐私政策'],
      ['/service', '服务条款'],
      ['/licenses', '开源软件声明'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(page.locator('body')).not.toContainText('{{controller_name}}')
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ))).toBeLessThanOrEqual(1)
      if (path === '/privacy') {
        await expect(page.locator('body')).toContainText('个人信息处理者：有点小狗工作室')
        await expect(page.locator('body')).toContainText('隐私联系邮箱：765678159@qq.com')
        await expect(page.locator('body')).toContainText('称呼、物种、手机号码、QQ、身高、体重')
        await expect(page.locator('body')).not.toContainText('不提供访客账号')
      }
      if (path === '/licenses') {
        await expect(page.getByText(/当前生成环境的 production 安装快照/u)).toBeVisible()
        await expect(page.getByRole('link', { name: '下载完整 TXT 声明' }))
          .toHaveAttribute('href', '/THIRD_PARTY_NOTICES.txt')
        await expect(page.locator('body')).not.toContainText('gyan.dev')
        await expect(page.locator('body')).not.toContainText('e38092ef93')
        await expect(page.locator('body')).not.toContainText('以下组件以 MIT 或 Apache-2.0 发布')
      }
    }
  }
})

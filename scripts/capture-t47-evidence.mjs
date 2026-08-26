import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.T47_BASE_URL ?? 'http://127.0.0.1:3000/'
const verify = process.argv.includes('--verify')
const evidenceDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/T47',
)
const videoDirectory = resolve(evidenceDirectory, '.video-source')
await mkdir(videoDirectory, { recursive: true })

const executablePath = process.env.T47_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})

const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1023x900', width: 1023, height: 900 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
]

const audit = {
  capturedAt: new Date().toISOString(),
  baseURL,
  browser: executablePath ?? 'playwright-managed-chromium',
  viewports: {},
  autoplay: {},
  reducedMotion: {},
  input: {},
  preferences: {},
  performance: {},
  transitionRegression: {},
  manual: {
    realIOSOrAndroid: 'pending-user-device-check',
  },
  checks: {},
}

function href(path = '/') {
  return new URL(path, baseURL).href
}

async function settle(page, selector) {
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__))
  await page.locator(selector).first().waitFor({ timeout: 15_000 })
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 3000)),
    ])
  })
  await page.waitForTimeout(520)
}

async function scrollTo(page, selector) {
  await page.locator(selector).evaluate(element => (
    element.scrollIntoView({ block: 'start', behavior: 'instant' })
  ))
  await page.waitForTimeout(120)
}

async function pauseIfRunning(page, selector) {
  if (!selector) return
  const button = page.locator(selector)
  if (await button.isVisible().catch(() => false)) {
    await button.focus()
    await button.click()
  }
}

async function moveCarousel(page, config, direction) {
  if (config.directionInput === 'keyboard') {
    await page.locator(`${config.root} ${config.keyboardTarget}`).first().focus()
    await page.keyboard.press(direction === 'next' ? 'ArrowRight' : 'ArrowLeft')
    return
  }
  const button = page.locator(config[direction])
  await button.focus()
  await button.click()
}

async function homeState(page) {
  return page.evaluate(() => ({
    hero: document.querySelector('.home-hero__dot[aria-current="true"]')
      ?.getAttribute('aria-label') ?? null,
    featured: document.querySelector('.featured-works__media')
      ?.getAttribute('data-work-slug') ?? null,
    adoption: document.querySelector('.home-adoption-poster')
      ?.getAttribute('data-work-slug') ?? null,
  }))
}

function changed(before, after, key) {
  return before[key] !== null && after[key] !== null && before[key] !== after[key]
}

async function directionAndInterrupt(page, config) {
  await scrollTo(page, config.root)
  // 先让一次性 scene arrival 完成，再只采样 carousel directional motion。
  await page.waitForTimeout(760)
  await pauseIfRunning(page, config.pause)
  await page.waitForTimeout(760)
  const before = await page.locator(config.state).first().getAttribute(config.attribute)

  await moveCarousel(page, config, 'next')
  await page.waitForTimeout(55)
  const nextActive = await page.locator(config.nextActive).count() > 0
  const keyframes = await page.locator(config.root).evaluate((root, motionTargets) => (
    root.getAnimations({ subtree: true })
      .filter(animation => animation.effect?.target?.matches?.(motionTargets))
      .flatMap(animation => animation.effect?.getKeyframes?.() ?? [])
  ), config.motionTargets)

  await moveCarousel(page, config, 'previous')
  await page.waitForTimeout(55)
  const previousActive = await page.locator(config.previousActive).count() > 0
  await moveCarousel(page, config, 'next')
  await page.waitForTimeout(55)
  await moveCarousel(page, config, 'previous')
  await page.waitForTimeout(760)

  const terminal = await page.locator(config.state).first().getAttribute(config.attribute)
  const result = await page.locator(config.root).evaluate((root, selectors) => ({
    runningAnimations: root.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running').length,
    activeMediaCount: root.querySelectorAll(selectors.activeMedia).length,
    horizontalOverflow: document.documentElement.scrollWidth
      - document.documentElement.clientWidth,
  }), { activeMedia: config.activeMedia })

  const allowed = new Set([
    'offset',
    'easing',
    'composite',
    'computedOffset',
    'opacity',
    'transform',
  ])
  const animatedProperties = [...new Set(keyframes.flatMap(frame => Object.keys(frame)))]

  return {
    before,
    terminal,
    nextActive,
    previousActive,
    animatedProperties,
    compositorOnly: animatedProperties.every(property => allowed.has(property)),
    ...result,
  }
}

const carouselConfigs = {
  hero: {
    root: '[data-testid="public-hero"]',
    pause: '.home-hero__pause[aria-label="暂停自动轮播"]',
    next: '.home-hero__arrow[aria-label="下一张"]',
    previous: '.home-hero__arrow[aria-label="上一张"]',
    nextActive: '.home-hero-slide-next-enter-active',
    previousActive: '.home-hero-slide-prev-enter-active',
    state: '.home-hero__dot[aria-current="true"]',
    attribute: 'aria-label',
    activeMedia: '.home-hero__slide',
    motionTargets: '.home-hero__slide',
  },
  featured: {
    root: '[data-testid="featured-works"]',
    pause: '[data-featured-action="pause"][aria-label="暂停自动轮播"]',
    next: '[data-featured-action="next"]',
    previous: '[data-featured-action="previous"]',
    nextActive: '.featured-media-next-enter-active',
    previousActive: '.featured-media-prev-enter-active',
    state: '.featured-works__media',
    attribute: 'data-work-slug',
    activeMedia: '.featured-works__media-surface',
    motionTargets: '.featured-works__media-surface, .featured-works__title, .featured-works__species',
  },
  adoption: {
    root: '[data-testid="home-current-adoptions"]',
    pause: null,
    directionInput: 'keyboard',
    keyboardTarget: '.home-adoption-poster__selector-item[aria-current="true"]',
    nextActive: '.home-adoption-media-next-enter-active',
    previousActive: '.home-adoption-media-prev-enter-active',
    state: '.home-adoption-poster',
    attribute: 'data-work-slug',
    activeMedia: '.home-adoption-poster__media-surface',
    motionTargets: '.home-adoption-poster__media-surface, .home-adoption-poster__identity, .home-adoption-poster__facts, .home-adoption-poster__actions',
  },
}

async function inspectViewport(viewport) {
  const context = await browser.newContext({
    viewport,
    hasTouch: viewport.width <= 430,
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')

  const structure = await page.evaluate(() => {
    const visible = element => Boolean(element && getComputedStyle(element).display !== 'none')
    return {
      navVisible: visible(document.querySelector('.public-header__nav')),
      menuVisible: visible(document.querySelector('.public-header__menu')),
      scrollSnapType: getComputedStyle(document.documentElement).scrollSnapType,
      noHorizontalOverflow: document.documentElement.scrollWidth
        <= document.documentElement.clientWidth,
      viewportMeta: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
      adoptionSteppers: document.querySelectorAll('.home-adoption-poster__stepper').length,
      adoptionFolios: document.querySelectorAll('.home-adoption-poster__folio').length,
      adoptionSelectorItems: document.querySelectorAll(
        '.home-adoption-poster__selector-item',
      ).length,
      featuredControls: document.querySelectorAll('.featured-works__controls').length,
    }
  })

  const carousels = {}
  for (const [name, config] of Object.entries(carouselConfigs)) {
    carousels[name] = await directionAndInterrupt(page, config)
  }

  const selectorBefore = await homeState(page)
  await page.locator(
    '.home-adoption-poster__selector-item:not([aria-current="true"])',
  ).first().click()
  await page.waitForTimeout(80)
  const selectorAfter = await homeState(page)

  await scrollTo(page, carouselConfigs.hero.root)
  await page.locator(carouselConfigs.hero.next).focus()
  const keyboardBefore = await homeState(page)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(760)
  const keyboardAfter = await homeState(page)

  let scrolling
  if (viewport.width >= 1024) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(100)
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(720)
    const first = await closestScene(page)
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(720)
    const second = await closestScene(page)
    await page.mouse.wheel(0, -800)
    await page.waitForTimeout(720)
    const reverse = await closestScene(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(720)
    await page.mouse.wheel(0, 800)
    await page.mouse.wheel(0, 800)
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(720)
    const locked = await closestScene(page)
    scrolling = { first, second, reverse, locked }
  }
  else {
    await page.evaluate(() => window.scrollTo(0, 0))
    const before = await page.evaluate(() => scrollY)
    await page.mouse.wheel(0, 420)
    await page.waitForTimeout(180)
    const after = await page.evaluate(() => scrollY)
    scrolling = { before, after, nativeEscape: after > before }
  }

  if (viewport.name === '1023x900' || viewport.name === '1024x900') {
    await page.screenshot({
      path: resolve(evidenceDirectory, `home-boundary-${viewport.name}.png`),
      fullPage: true,
    })
  }

  await context.close()
  return {
    errors,
    structure,
    carousels,
    keyboard: {
      before: keyboardBefore.hero,
      after: keyboardAfter.hero,
      changed: changed(keyboardBefore, keyboardAfter, 'hero'),
    },
    adoptionSelector: {
      before: selectorBefore.adoption,
      after: selectorAfter.adoption,
      changed: changed(selectorBefore, selectorAfter, 'adoption'),
    },
    scrolling,
  }
}

async function closestScene(page) {
  return page.evaluate(() => {
    const scenes = [...document.querySelectorAll('[data-home-scroll-scene]')]
    return scenes.reduce((closest, scene, index) => (
      Math.abs(scene.getBoundingClientRect().top)
        < Math.abs(scenes[closest].getBoundingClientRect().top)
        ? index
        : closest
    ), 0)
  })
}

async function inspectAutoplay(viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  const initial = await homeState(page)
  await page.waitForTimeout(4600)
  const advanced = await homeState(page)
  await pauseIfRunning(page, carouselConfigs.hero.pause)
  await scrollTo(page, carouselConfigs.featured.root)
  await pauseIfRunning(page, carouselConfigs.featured.pause)
  await scrollTo(page, carouselConfigs.adoption.root)
  await pauseIfRunning(page, carouselConfigs.adoption.pause)
  const paused = await homeState(page)
  await page.waitForTimeout(4600)
  const remainedPaused = await homeState(page)
  await context.close()
  return { initial, advanced, paused, remainedPaused }
}

async function inspectReduced(viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  const initial = await homeState(page)
  await page.waitForTimeout(4400)
  const afterWait = await homeState(page)
  for (const config of Object.values(carouselConfigs)) {
    await scrollTo(page, config.root)
    await moveCarousel(page, config, 'next')
  }
  await page.waitForTimeout(240)
  const manual = await homeState(page)
  const state = await page.evaluate(() => ({
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    runningAnimations: document.getAnimations()
      .filter(animation => animation.playState === 'running').length,
    visiblePauseButtons: [...document.querySelectorAll(
      '.home-hero__pause, .featured-works__pause',
    )].filter(element => getComputedStyle(element).display !== 'none').length,
  }))
  if (viewport.width === 390) {
    await page.screenshot({
      path: resolve(evidenceDirectory, 'home-reduced-390x844.png'),
      fullPage: true,
    })
  }
  await context.close()
  return { initial, afterWait, manual, ...state }
}

async function inspectInput() {
  const keyboardContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const keyboardPage = await keyboardContext.newPage()
  await keyboardPage.goto(href('/works'), { waitUntil: 'domcontentloaded' })
  await settle(keyboardPage, '.works-page')
  await keyboardPage.keyboard.press('Tab')
  const firstFocus = await keyboardPage.evaluate(() => ({
    href: document.activeElement?.getAttribute('href') ?? '',
    focusVisible: document.activeElement?.matches(':focus-visible') ?? false,
  }))
  await keyboardPage.keyboard.press('Enter')
  const skipTarget = await keyboardPage.evaluate(() => (
    document.activeElement === document.querySelector('#main-content')
  ))
  await keyboardContext.close()

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(href('/works'), { waitUntil: 'domcontentloaded' })
  await settle(mobilePage, '.works-page')
  await mobilePage.locator('.public-header__menu').click()
  const panel = mobilePage.locator('[data-testid="public-mobile-nav"]')
  await panel.waitFor()
  const focusInside = await mobilePage.evaluate(() => Boolean(
    document.activeElement?.closest('[data-testid="public-mobile-nav"]'),
  ))
  for (let index = 0; index < 12; index += 1) await mobilePage.keyboard.press('Tab')
  const trapped = await mobilePage.evaluate(() => Boolean(
    document.activeElement?.closest('[data-testid="public-mobile-nav"]'),
  ))
  await mobilePage.keyboard.press('Escape')
  await panel.waitFor({ state: 'hidden' })
  const restored = await mobilePage.evaluate(() => (
    document.activeElement === document.querySelector('.public-header__menu')
  ))
  await mobileContext.close()

  const imeContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const imePage = await imeContext.newPage()
  await imePage.goto(href('/works'), { waitUntil: 'domcontentloaded' })
  await settle(imePage, '.works-page')
  const input = imePage.locator('.catalog-search__input')
  await input.focus()
  await input.evaluate((element, value) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: value,
      inputType: 'insertCompositionText',
      isComposing: true,
    }))
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: value }))
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: value,
      inputType: 'insertText',
    }))
  }, '虾片返图')
  await Promise.all([
    imePage.waitForURL(url => url.pathname === '/works' && url.searchParams.get('q') === '虾片返图'),
    imePage.locator('.catalog-search__submit').click(),
  ])
  const ime = {
    query: new URL(imePage.url()).searchParams.get('q'),
    value: await imePage.locator('.catalog-search__input').inputValue(),
  }
  await imeContext.close()

  return {
    keyboard: { firstFocus, skipTarget },
    mobileNav: { focusInside, trapped, restored },
    ime,
  }
}

async function inspectPreference(feature, value) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const session = await context.newCDPSession(page)
  await session.send('Emulation.setEmulatedMedia', { features: [{ name: feature, value }] })
  await page.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  const result = await page.evaluate(({ feature, value }) => ({
    matches: matchMedia(`(${feature}: ${value})`).matches,
    overlaySoft: getComputedStyle(document.documentElement)
      .getPropertyValue('--public-overlay-soft').trim(),
    borderPrimary: getComputedStyle(document.documentElement)
      .getPropertyValue('--public-border-primary').trim(),
  }), { feature, value })
  await context.close()
  return result
}

async function inspectPerformance() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__t47Vitals = { cls: 0, lcp: 0, longTasks: 0 }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__t47Vitals.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((list) => {
      window.__t47Vitals.lcp = list.getEntries().at(-1)?.startTime ?? 0
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((list) => {
      window.__t47Vitals.longTasks += list.getEntries().length
    }).observe({ type: 'longtask', buffered: true })
  })
  await page.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  for (const selector of [
    '[data-testid="featured-works"]',
    '[data-testid="home-business-entries"]',
    '[data-testid="home-current-adoptions"]',
  ]) {
    if (await page.locator(selector).count()) await scrollTo(page, selector)
  }
  await page.evaluate(async () => Promise.all([...document.images].map(image => (
    image.decode().catch(() => undefined)
  ))))
  await page.waitForTimeout(500)
  const result = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0]
    return {
      ...window.__t47Vitals,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? 0,
      loadEventMs: navigation?.loadEventEnd ?? 0,
      failedImages: [...document.images]
        .filter(image => !image.complete || image.naturalWidth === 0)
        .map(image => image.currentSrc || image.src),
      noHorizontalOverflow: document.documentElement.scrollWidth
        <= document.documentElement.clientWidth,
    }
  })
  await context.close()
  return result
}

async function inspectTransitionRegression() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  await scrollTo(page, '[data-testid="featured-works"]')
  await page.evaluate(() => {
    const featured = document.querySelector('[data-testid="featured-works"]')
    const initialTop = featured?.getBoundingClientRect().top ?? 0
    window.__t47ExitProbe = { initialTop, maxShift: 0, positions: [] }
    const measure = () => {
      const current = document.querySelector('[data-testid="featured-works"]')
      if (!current) return
      const top = current.getBoundingClientRect().top
      window.__t47ExitProbe.positions.push(top)
      window.__t47ExitProbe.maxShift = Math.max(
        window.__t47ExitProbe.maxShift,
        Math.abs(top - initialTop),
      )
      requestAnimationFrame(measure)
    }
    requestAnimationFrame(measure)
  })
  await page.getByTestId('featured-works')
    .getByRole('link', { name: '浏览作品展示' })
    .click()
  const result = await page.evaluate(() => window.__t47ExitProbe)
  await page.screenshot({
    path: resolve(evidenceDirectory, 'works-after-home-transition-1280x800.png'),
  })
  await context.close()
  return result
}

async function recordInterruptVideo(viewport) {
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: videoDirectory, size: viewport },
  })
  const page = await context.newPage()
  await page.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  for (const config of Object.values(carouselConfigs)) {
    await scrollTo(page, config.root)
    await pauseIfRunning(page, config.pause)
    await moveCarousel(page, config, 'next')
    await page.waitForTimeout(80)
    await moveCarousel(page, config, 'previous')
    await page.waitForTimeout(80)
    await moveCarousel(page, config, 'next')
    await page.waitForTimeout(760)
  }
  const video = page.video()
  await context.close()
  if (video) {
    await video.saveAs(resolve(evidenceDirectory, `interrupt-${viewport.width}x${viewport.height}.webm`))
    await video.delete()
  }
}

for (const viewport of viewports) {
  audit.viewports[viewport.name] = await inspectViewport(viewport)
  console.log(`[T47] viewport ${viewport.name}`)
}

for (const viewport of [viewports[0], viewports.at(-1)]) {
  audit.autoplay[viewport.name] = await inspectAutoplay(viewport)
  audit.reducedMotion[viewport.name] = await inspectReduced(viewport)
  await recordInterruptVideo(viewport)
  console.log(`[T47] motion ${viewport.name}`)
}

audit.input = await inspectInput()
audit.preferences.reducedTransparency = await inspectPreference(
  'prefers-reduced-transparency',
  'reduce',
)
audit.preferences.moreContrast = await inspectPreference('prefers-contrast', 'more')
audit.performance = await inspectPerformance()
audit.transitionRegression = await inspectTransitionRegression()

const viewportResults = Object.values(audit.viewports)
const carouselResults = viewportResults.flatMap(result => Object.values(result.carousels))
const desktopResults = viewports.filter(viewport => viewport.width >= 1024)
  .map(viewport => audit.viewports[viewport.name])
const nativeResults = viewports.filter(viewport => viewport.width < 1024)
  .map(viewport => audit.viewports[viewport.name])

audit.checks = {
  noRuntimeErrors: viewportResults.every(result => result.errors.length === 0),
  responsiveNavigation: viewports.every(viewport => {
    const structure = audit.viewports[viewport.name].structure
    return viewport.width >= 1024
      ? structure.navVisible && !structure.menuVisible
      : !structure.navVisible && structure.menuVisible
  }),
  noHorizontalOverflow: viewportResults.every(result => result.structure.noHorizontalOverflow),
  adoptionControlsRemoved: viewportResults.every(result => (
    result.structure.adoptionSteppers === 0
    && result.structure.adoptionFolios === 1
    && result.structure.adoptionSelectorItems > 1
    && result.structure.featuredControls === 1
    && result.adoptionSelector.changed
  )),
  safeAreaStrategy: viewportResults.every(result => (
    /width\s*=\s*device-width/iu.test(result.structure.viewportMeta)
    && !/viewport-fit\s*=\s*cover/iu.test(result.structure.viewportMeta)
  )),
  carouselDirectionInterrupt: carouselResults.every(result => (
    result.nextActive
    && result.previousActive
    && result.runningAnimations === 0
    && result.activeMediaCount === 1
    && result.horizontalOverflow <= 0
  )),
  compositorFriendlyMotion: carouselResults.every(result => result.compositorOnly),
  keyboardCarousel: viewportResults.every(result => result.keyboard.changed),
  desktopSceneSequenceReverseLock: desktopResults.every(result => (
    result.scrolling.first === 1
    && result.scrolling.second === 2
    && result.scrolling.reverse === 1
    && result.scrolling.locked === 1
  )),
  below1024NativeEscape: nativeResults.every(result => result.scrolling.nativeEscape),
  autoplayFourSecondsAndPause: Object.values(audit.autoplay).every(result => (
    ['hero', 'featured', 'adoption'].every(key => changed(result.initial, result.advanced, key))
    && ['hero', 'featured'].every(key => result.paused[key] === result.remainedPaused[key])
    && changed(result.paused, result.remainedPaused, 'adoption')
  )),
  reducedMotion: Object.values(audit.reducedMotion).every(result => (
    ['hero', 'featured', 'adoption'].every(key => result.initial[key] === result.afterWait[key])
    && ['hero', 'featured', 'adoption'].every(key => changed(result.initial, result.manual, key))
    && result.matches
    && result.runningAnimations === 0
    && result.visiblePauseButtons === 0
  )),
  keyboardAndFocus: audit.input.keyboard.firstFocus.href === '#main-content'
    && audit.input.keyboard.firstFocus.focusVisible
    && audit.input.keyboard.skipTarget,
  mobileNavFocus: audit.input.mobileNav.focusInside
    && audit.input.mobileNav.trapped
    && audit.input.mobileNav.restored,
  ime: audit.input.ime.query === '虾片返图' && audit.input.ime.value === '虾片返图',
  prefersTransparencyAndContrast: audit.preferences.reducedTransparency.matches
    && audit.preferences.moreContrast.matches,
  imagesDecoded: audit.performance.failedImages.length === 0,
  clsAcceptable: audit.performance.cls < 0.1,
  lcpObserved: audit.performance.lcp > 0,
  transitionFlashFixed: audit.transitionRegression.maxShift <= 1,
  realDeviceManual: audit.manual.realIOSOrAndroid === 'passed',
}

await writeFile(
  resolve(evidenceDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)
await rm(videoDirectory, { force: true, recursive: true })
await browser.close()

const failed = Object.entries(audit.checks).filter(([, value]) => value !== true)
console.log(`[T47] evidence complete; ${failed.length} checks pending/failed`)
if (failed.length) console.log(failed.map(([name]) => `- ${name}`).join('\n'))
if (verify && failed.some(([name]) => name !== 'realDeviceManual')) {
  throw new Error('T47 automated evidence checks failed.')
}

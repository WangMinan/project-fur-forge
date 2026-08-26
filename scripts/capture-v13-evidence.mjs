import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V13_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V13',
)
const videoDirectory = resolve(outputDirectory, '.video-source')
await mkdir(videoDirectory, { recursive: true })

const executablePath = process.env.V13_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})

const viewports = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'mobile-390x844', width: 390, height: 844 },
]
const scenarios = ['arrival', 'next', 'previous', 'reverse', 'interrupt', 'reduced']
const audit = {
  capturedAt: new Date().toISOString(),
  baseURL,
  motion: {},
  autoplay: {},
  publicPages: {},
  transitions: {},
  checks: {},
}

function href(path = '/') {
  return new URL(path, baseURL).href
}

async function settle(page, selector) {
  await page.locator(selector).first().waitFor()
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 3000))])
    await Promise.race([
      Promise.all([...document.images].map(image => (
        image.complete ? Promise.resolve() : image.decode().catch(() => undefined)
      ))),
      new Promise(resolve => setTimeout(resolve, 5000)),
    ])
  })
}

async function scrollTo(page, selector) {
  await page.locator(selector).evaluate(element => element.scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(120)
}

async function saveVideo(page, context, name) {
  const video = page.video()
  await context.close()
  if (video) {
    await video.saveAs(resolve(outputDirectory, `${name}.webm`))
    await video.delete()
  }
}

async function pauseCarousel(page, selector) {
  const pause = page.locator(selector)
  if (await pause.isVisible().catch(() => false)) {
    await pause.click({ force: true })
  }
}

async function performScenario(page, next, previous, scenario) {
  if (scenario === 'arrival') {
    await page.waitForTimeout(900)
    return
  }
  if (scenario === 'next' || scenario === 'reduced') {
    await page.locator(next).click({ force: true })
  }
  else if (scenario === 'previous') {
    await page.locator(previous).click({ force: true })
  }
  else if (scenario === 'reverse') {
    await page.locator(next).click({ force: true })
    await page.waitForTimeout(120)
    await page.locator(previous).click({ force: true })
  }
  else {
    await page.locator(next).click({ force: true })
    await page.waitForTimeout(70)
    await page.locator(next).click({ force: true })
    await page.waitForTimeout(70)
    await page.locator(previous).click({ force: true })
  }
  await page.waitForTimeout(scenario === 'reduced' ? 300 : 720)
}

async function recordMotion(viewport, scenario) {
  const reduced = scenario === 'reduced'
  const context = await browser.newContext({
    viewport,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    recordVideo: { dir: videoDirectory, size: viewport },
  })
  const page = await context.newPage()
  await page.goto(href(), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  if (!reduced && scenario !== 'arrival') {
    await pauseCarousel(page, '.home-hero__pause[aria-label="暂停自动轮播"]')
  }
  await performScenario(
    page,
    '.home-hero__arrow[aria-label="下一张"]',
    '.home-hero__arrow[aria-label="上一张"]',
    scenario,
  )
  await scrollTo(page, '[data-testid="featured-works"]')
  if (!reduced && scenario !== 'arrival') {
    await pauseCarousel(page, '[data-featured-action="pause"][aria-label="暂停自动轮播"]')
  }
  await performScenario(
    page,
    '[data-featured-action="next"]',
    '[data-featured-action="previous"]',
    scenario,
  )
  await scrollTo(page, '[data-testid="home-current-adoptions"]')
  if (!reduced && scenario !== 'arrival') {
    await pauseCarousel(page, '[data-testid="home-adoption-pause"][aria-label="暂停自动轮播"]')
  }
  await performScenario(
    page,
    '[aria-label="下一个领养角色"]',
    '[aria-label="上一个领养角色"]',
    scenario,
  )
  await saveVideo(page, context, `carousels-${viewport.name}-${scenario}`)
}

async function captureScreenshots(viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(href(), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  await page.waitForTimeout(820)
  await page.screenshot({
    path: resolve(outputDirectory, `hero-arrival-${viewport.name}.png`),
  })
  await scrollTo(page, '[data-testid="featured-works"]')
  await page.waitForTimeout(820)
  await page.screenshot({
    path: resolve(outputDirectory, `featured-arrival-${viewport.name}.png`),
  })
  await pauseCarousel(page, '[data-featured-action="pause"][aria-label="暂停自动轮播"]')
  await page.locator('[data-featured-action="next"]').click({ force: true })
  await page.waitForTimeout(720)
  await page.screenshot({
    path: resolve(outputDirectory, `featured-next-${viewport.name}.png`),
  })
  await scrollTo(page, '[data-testid="home-current-adoptions"]')
  await page.waitForTimeout(820)
  await page.screenshot({
    path: resolve(outputDirectory, `adoption-arrival-${viewport.name}.png`),
  })
  await pauseCarousel(page, '[data-testid="home-adoption-pause"][aria-label="暂停自动轮播"]')
  await page.locator('[aria-label="下一个领养角色"]').click({ force: true })
  await page.waitForTimeout(720)
  await page.screenshot({
    path: resolve(outputDirectory, `adoption-next-${viewport.name}.png`),
  })
  await context.close()
}

function near(a, b, tolerance = 0.75) {
  return Math.abs(a - b) <= tolerance
}

async function inspectMotion(viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(href(), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  await page.waitForTimeout(900)
  const heroBefore = await page.evaluate(() => {
    const title = document.querySelector('.home-hero__title')
    const rect = title.getBoundingClientRect()
    const style = getComputedStyle(title)
    return {
      text: title.textContent.trim(),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      entrance: style.animationName,
    }
  })
  await pauseCarousel(page, '.home-hero__pause[aria-label="暂停自动轮播"]')
  await page.locator('.home-hero__arrow[aria-label="下一张"]').click({ force: true })
  await page.waitForTimeout(30)
  const heroNext = await page.locator('.home-hero-slide-next-enter-active').count() > 0
  await page.waitForTimeout(620)
  await page.locator('.home-hero__arrow[aria-label="上一张"]').click({ force: true })
  await page.waitForTimeout(60)
  const heroPrevious = await page.locator('.home-hero-slide-prev-enter-active').count() > 0
  await page.waitForTimeout(620)
  await page.locator('.home-hero__arrow[aria-label="下一张"]').click({ force: true })
  await page.waitForTimeout(75)
  await page.locator('.home-hero__arrow[aria-label="上一张"]').click({ force: true })
  await page.waitForTimeout(75)
  await page.locator('.home-hero__arrow[aria-label="下一张"]').click({ force: true })
  await page.waitForTimeout(720)
  const heroAfter = await page.evaluate(() => {
    const title = document.querySelector('.home-hero__title')
    const rect = title.getBoundingClientRect()
    const style = getComputedStyle(title)
    return {
      text: title.textContent.trim(),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      slideCount: document.querySelectorAll('.home-hero__slide').length,
    }
  })

  await scrollTo(page, '[data-testid="featured-works"]')
  await page.waitForTimeout(700)
  await pauseCarousel(page, '[data-featured-action="pause"][aria-label="暂停自动轮播"]')
  const layers = await page.evaluate(() => ({
    media: 56,
    title: Number.parseFloat(getComputedStyle(document.querySelector('.featured-works__title'))
      .getPropertyValue('--featured-motion-distance')),
    species: Number.parseFloat(getComputedStyle(document.querySelector('.featured-works__species'))
      .getPropertyValue('--featured-motion-distance')),
    action: Number.parseFloat(getComputedStyle(document.querySelector('.featured-works__action-layer'))
      .getPropertyValue('--featured-motion-distance')),
  }))
  const layout = await page.evaluate(async () => {
    const root = document.querySelector('[data-testid="featured-works"]')
    const next = root.querySelector('[data-featured-action="next"]')
    const pause = root.querySelector('[data-featured-action="pause"]')
    if (root.dataset.paused !== 'true') pause.click()
    const read = () => {
      const slug = root.querySelector('.featured-works__media').dataset.workSlug
      const content = root.querySelector(`[data-featured-content="${CSS.escape(slug)}"]`)
      return {
        slug,
        title: content.querySelector('.featured-works__title').textContent.trim(),
        titleY: content.querySelector('[data-featured-layout="title"]').getBoundingClientRect().top,
        speciesY: content.querySelector('[data-featured-layout="species"]').getBoundingClientRect().top,
        actionY: root.querySelector('[data-featured-layout="action"]').getBoundingClientRect().top,
        controlsY: root.querySelector('[data-featured-layout="controls"]')
          .getBoundingClientRect().top,
      }
    }
    const before = read()
    next.click()
    await new Promise(resolve => setTimeout(resolve, 720))
    return { before, after: read() }
  })
  await page.locator('[data-featured-action="previous"]').click({ force: true })
  await page.waitForTimeout(60)
  const featuredPrevious = await page.locator('.featured-content-prev-enter-active').count() > 0
  await page.waitForTimeout(620)
  await page.locator('[data-featured-action="next"]').click({ force: true })
  await page.waitForTimeout(70)
  await page.locator('[data-featured-action="next"]').click({ force: true })
  await page.waitForTimeout(70)
  await page.locator('[data-featured-action="previous"]').click({ force: true })
  await page.waitForTimeout(760)
  const featuredTerminal = await page.evaluate(() => ({
    contentCount: document.querySelectorAll('[data-featured-content]').length,
    mediaCount: document.querySelectorAll('.featured-works__media-surface').length,
    displayAnimations: document.querySelector('.featured-works__display').getAnimations().length,
    runningAnimations: document.querySelector('[data-testid="featured-works"]')
      .getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running').length,
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    imagesDecoded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
    footerPresent: Boolean(document.querySelector('[data-testid="public-footer"], footer')),
  }))

  await scrollTo(page, '[data-testid="home-current-adoptions"]')
  await page.waitForTimeout(700)
  await pauseCarousel(page, '[data-testid="home-adoption-pause"][aria-label="暂停自动轮播"]')
  const adoptionBefore = await page.locator('.home-adoption-poster').getAttribute('data-work-slug')
  await page.locator('[aria-label="下一个领养角色"]').click({ force: true })
  await page.waitForTimeout(60)
  const adoptionNext = await page.locator('.home-adoption-media-next-enter-active').count() > 0
  const adoptionNextLayers = await page.evaluate(() => Object.fromEntries([
    ['title', '.home-adoption-poster__identity'],
    ['facts', '.home-adoption-poster__facts'],
    ['action', '.home-adoption-poster__actions'],
  ].map(([name, selector]) => {
    const animation = document.querySelector(selector)?.getAnimations()
      .find(item => item.playState === 'running')
    return [name, animation?.effect?.getKeyframes?.()[0]?.transform ?? 'none']
  })))
  await page.waitForTimeout(620)
  await page.locator('[aria-label="上一个领养角色"]').click({ force: true })
  await page.waitForTimeout(60)
  const adoptionPrevious = await page.locator('.home-adoption-media-prev-enter-active').count() > 0
  const adoptionPreviousLayers = await page.evaluate(() => Object.fromEntries([
    ['title', '.home-adoption-poster__identity'],
    ['facts', '.home-adoption-poster__facts'],
    ['action', '.home-adoption-poster__actions'],
  ].map(([name, selector]) => {
    const animation = document.querySelector(selector)?.getAnimations()
      .find(item => item.playState === 'running')
    return [name, animation?.effect?.getKeyframes?.()[0]?.transform ?? 'none']
  })))
  await page.waitForTimeout(620)
  await page.locator('[aria-label="下一个领养角色"]').click({ force: true })
  await page.waitForTimeout(70)
  await page.locator('[aria-label="下一个领养角色"]').click({ force: true })
  await page.waitForTimeout(70)
  await page.locator('[aria-label="上一个领养角色"]').click({ force: true })
  await page.waitForTimeout(760)
  const adoptionTerminal = await page.evaluate(() => ({
    slug: document.querySelector('.home-adoption-poster')?.getAttribute('data-work-slug'),
    mediaCount: document.querySelectorAll('.home-adoption-poster__media-surface').length,
    runningAnimations: document.querySelector('[data-testid="home-current-adoptions"]')
      .getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running').length,
    imageHref: document.querySelector('[data-testid="home-adoption-media-link"]')?.getAttribute('href'),
    actionHref: document.querySelector('.home-adoption-poster__actions .public-action')?.getAttribute('href'),
  }))
  await context.close()
  return {
    errors,
    hero: { before: heroBefore, after: heroAfter, next: heroNext, previous: heroPrevious },
    featured: { layers, layout, previous: featuredPrevious, terminal: featuredTerminal },
    adoption: {
      before: adoptionBefore,
      next: adoptionNext,
      nextLayers: adoptionNextLayers,
      previous: adoptionPrevious,
      previousLayers: adoptionPreviousLayers,
      terminal: adoptionTerminal,
    },
  }
}

async function inspectAutoplay(viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(href(), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  const state = () => page.evaluate(() => ({
    hero: document.querySelector('.home-hero__dot[aria-current="true"]')?.getAttribute('aria-label'),
    featured: document.querySelector('.featured-works__media')?.getAttribute('data-work-slug'),
    adoption: document.querySelector('.home-adoption-poster')?.getAttribute('data-work-slug'),
  }))
  const initial = await state()
  await page.waitForTimeout(5000)
  const advanced = await state()
  await pauseCarousel(page, '.home-hero__pause[aria-label="暂停自动轮播"]')
  await scrollTo(page, '[data-testid="featured-works"]')
  await pauseCarousel(page, '[data-featured-action="pause"][aria-label="暂停自动轮播"]')
  await scrollTo(page, '[data-testid="home-current-adoptions"]')
  await pauseCarousel(page, '[data-testid="home-adoption-pause"][aria-label="暂停自动轮播"]')
  const paused = await state()
  await page.waitForTimeout(5000)
  const remainedPaused = await state()
  await page.locator('.home-hero__pause[aria-label="继续自动轮播"]').click({ force: true })
  await page.locator('[data-featured-action="pause"][aria-label="继续自动轮播"]').click({ force: true })
  await page.locator('[data-testid="home-adoption-pause"][aria-label="继续自动轮播"]').click({ force: true })
  await page.waitForTimeout(5000)
  const resumed = await state()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const hidden = await state()
  await page.waitForTimeout(5000)
  const remainedHidden = await state()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(5000)
  const visibleAgain = await state()
  await context.close()
  return { initial, advanced, paused, remainedPaused, resumed, hidden, remainedHidden, visibleAgain }
}

async function inspectReduced(viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(href(), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  const initial = await page.evaluate(() => ({
    hero: document.querySelector('.home-hero__dot[aria-current="true"]')?.getAttribute('aria-label'),
    featured: document.querySelector('.featured-works__media')?.getAttribute('data-work-slug'),
    adoption: document.querySelector('.home-adoption-poster')?.getAttribute('data-work-slug'),
  }))
  await page.waitForTimeout(4300)
  const terminal = await page.evaluate(() => ({
    hero: document.querySelector('.home-hero__dot[aria-current="true"]')?.getAttribute('aria-label'),
    featured: document.querySelector('.featured-works__media')?.getAttribute('data-work-slug'),
    adoption: document.querySelector('.home-adoption-poster')?.getAttribute('data-work-slug'),
    heroReduced: document.querySelector('[data-testid="public-hero"]')?.getAttribute('data-reduced-motion'),
    featuredReduced: document.querySelector('[data-testid="featured-works"]')?.getAttribute('data-reduced-motion'),
    adoptionReduced: document.querySelector('[data-testid="home-current-adoptions"]')?.getAttribute('data-reduced-motion'),
    pauseCount: [...document.querySelectorAll('.home-hero__pause, .featured-works__pause, .home-adoption-poster__pause')]
      .filter(element => getComputedStyle(element).display !== 'none').length,
  }))
  await page.locator('.home-hero__arrow[aria-label="下一张"]').click({ force: true })
  await scrollTo(page, '[data-testid="featured-works"]')
  await page.locator('[data-featured-action="next"]').click({ force: true })
  await scrollTo(page, '[data-testid="home-current-adoptions"]')
  await page.locator('[aria-label="下一个领养角色"]').click({ force: true })
  await page.waitForTimeout(300)
  const manualTerminal = await page.evaluate(() => ({
    runningAnimations: document.querySelector('[data-testid="public-home"]')
      .getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running').length,
    contentCount: document.querySelectorAll('[data-featured-content]').length,
    mediaCount: document.querySelectorAll('.featured-works__media-surface').length,
    adoptionMediaCount: document.querySelectorAll('.home-adoption-poster__media-surface').length,
  }))
  await context.close()
  return { initial, terminal, manualTerminal }
}

const transitionCases = [
  {
    name: 'home-commission',
    sourcePath: '/',
    source: '.home-commission a[href*="view=homeCommission"]',
    sourceSection: '[data-testid="home-business-entries"]',
    target: '[data-testid="commission-page"]',
    transitionName: 'home-commission-media',
  },
  {
    name: 'home-featured',
    sourcePath: '/',
    source: '.featured-works__media',
    sourceSection: '[data-testid="featured-works"]',
    target: '[data-testid="work-detail"]',
    transitionName: 'home-featured-media',
  },
  {
    name: 'home-adoption',
    sourcePath: '/',
    source: '[data-testid="home-adoption-media-link"]',
    sourceSection: '[data-testid="home-current-adoptions"]',
    target: '[data-testid="work-detail"]',
    transitionName: 'home-adoption-media',
  },
  {
    name: 'works-card',
    sourcePath: '/works',
    source: '.work-card',
    target: '[data-testid="work-detail"]',
    transitionName: 'works-card-media',
    reverseTarget: '.work-card',
  },
  {
    name: 'adoption-card',
    sourcePath: '/adoptions',
    source: '.adoption-card',
    target: '[data-testid="work-detail"]',
    transitionName: 'adoption-card-media',
    reverseTarget: '.adoption-card',
  },
]

async function installViewTransitionProbe(context, fallback = false) {
  await context.addInitScript(({ disable }) => {
    const original = typeof document.startViewTransition === 'function'
      ? document.startViewTransition.bind(document)
      : null
    window.__v13ViewTransitions = { supported: Boolean(original), calls: [] }
    window.__v13PageEntrances = []
    document.addEventListener('transitionrun', (event) => {
      if (event.target instanceof Element && event.target.classList.contains('public-page-enter-active')) {
        window.__v13PageEntrances.push('public-page')
      }
    }, true)
    document.addEventListener('animationstart', (event) => {
      if (event.target instanceof Element && event.target.classList.contains('public-error-enter')) {
        window.__v13PageEntrances.push('public-error')
      }
    }, true)
    if (disable) {
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value: undefined,
      })
    }
    else if (original) {
      document.startViewTransition = function (update) {
        window.__v13ViewTransitions.calls.push(
          [...document.querySelectorAll('body *')]
            .map(element => ({
              className: typeof element.className === 'string' ? element.className : '',
              name: getComputedStyle(element).viewTransitionName,
            }))
            .filter(item => item.name && item.name !== 'none'),
        )
        return original(update)
      }
    }
  }, { disable: fallback })
}

async function captureTransition(transitionCase, mode) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
    recordVideo: { dir: videoDirectory, size: { width: 1440, height: 900 } },
  })
  await installViewTransitionProbe(context, mode === 'fallback')
  const page = await context.newPage()
  await page.goto(href(transitionCase.sourcePath), { waitUntil: 'domcontentloaded' })
  await settle(page, transitionCase.source)
  if (transitionCase.sourceSection) await scrollTo(page, transitionCase.sourceSection)
  await page.waitForTimeout(900)
  const source = page.locator(transitionCase.source).first()
  const sourceHref = await source.getAttribute('href')
  const beforeNames = await page.evaluate(() => (
    [...document.querySelectorAll('body *')]
      .map(element => getComputedStyle(element).viewTransitionName)
      .filter(name => name && name !== 'none')
  ))
  await source.click({ force: true })
  await page.waitForURL(url => url.pathname !== transitionCase.sourcePath, { timeout: 10_000 })
  await settle(page, transitionCase.target)
  await page.waitForTimeout(mode === 'forward' ? 800 : 300)
  const result = await page.evaluate((expectedName) => ({
    path: location.pathname,
    query: location.search,
    supported: window.__v13ViewTransitions.supported,
    calls: window.__v13ViewTransitions.calls,
    pageEntrances: window.__v13PageEntrances,
    destinationNames: [...document.querySelectorAll('body *')]
      .map(element => getComputedStyle(element).viewTransitionName)
      .filter(name => name && name !== 'none'),
    expectedDuration: getComputedStyle(
      document.documentElement,
      `::view-transition-group(${expectedName})`,
    ).animationDuration,
    rootOldAnimation: getComputedStyle(
      document.documentElement,
      '::view-transition-old(root)',
    ).animationName,
    rootNewAnimation: getComputedStyle(
      document.documentElement,
      '::view-transition-new(root)',
    ).animationName,
    runningAnimations: document.getAnimations()
      .filter(animation => animation.playState === 'running').length,
    imagesDecoded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
  }), transitionCase.transitionName)
  await saveVideo(page, context, `transition-${transitionCase.name}-${mode}`)
  return { sourceHref, beforeNames, ...result }
}

async function captureReverseTransition(transitionCase) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDirectory, size: { width: 1440, height: 900 } },
  })
  await installViewTransitionProbe(context)
  const page = await context.newPage()
  await page.goto(href(transitionCase.sourcePath), { waitUntil: 'domcontentloaded' })
  await settle(page, transitionCase.source)
  await page.waitForTimeout(900)
  const source = page.locator(transitionCase.source).first()
  await source.click({ force: true })
  await page.waitForURL(url => url.pathname !== transitionCase.sourcePath, { timeout: 10_000 })
  await settle(page, transitionCase.target)
  await page.waitForTimeout(800)
  const slug = await page.locator('[data-testid="work-detail"]').getAttribute('data-work-slug')
  await page.locator('.work-detail__back-link').click({ force: true })
  await page.waitForURL(url => url.pathname === transitionCase.sourcePath, { timeout: 10_000 })
  const target = `${transitionCase.reverseTarget}[data-work-slug="${slug}"]`
  await settle(page, target)
  await page.waitForTimeout(800)
  const result = await page.evaluate((expectedName) => ({
    path: location.pathname,
    query: location.search,
    calls: window.__v13ViewTransitions.calls,
    destinationNames: [...document.querySelectorAll('body *')]
      .map(element => getComputedStyle(element).viewTransitionName)
      .filter(name => name && name !== 'none'),
    runningAnimations: document.getAnimations()
      .filter(animation => animation.playState === 'running').length,
    imagesDecoded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
    expectedDuration: getComputedStyle(
      document.documentElement,
      `::view-transition-group(${expectedName})`,
    ).animationDuration,
  }), transitionCase.transitionName)
  await saveVideo(page, context, `transition-${transitionCase.name}-reverse`)
  return { slug, ...result }
}

async function inspectPublicPages(viewport, reduced) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  await installViewTransitionProbe(context)

  const resolver = await context.newPage()
  await resolver.goto(href('/works'), { waitUntil: 'domcontentloaded' })
  await settle(resolver, '.work-card')
  const workPath = new URL(await resolver.locator('.work-card').first().getAttribute('href'), baseURL).pathname
  await resolver.goto(href('/adoptions'), { waitUntil: 'domcontentloaded' })
  await settle(resolver, '.adoption-card')
  const adoptionPath = new URL(await resolver.locator('.adoption-card').first().getAttribute('href'), baseURL).pathname
  await resolver.close()

  const routeCases = [
    ['homepage', '/', '[data-testid="public-home"]', 200],
    ['works', '/works', '.works-page', 200],
    ['work-detail', workPath, '[data-testid="work-detail"]', 200],
    ['adoptions', '/adoptions', '.adoptions-page', 200],
    ['adoption-detail', adoptionPath, '[data-testid="work-detail"]', 200],
    ['commission', '/commission', '[data-testid="commission-page"]', 200],
    ['commission-apply', '/commission/apply', '[data-testid="commission-apply-page"]', 200],
    ['about', '/about', '[data-testid="about-page"]', 200],
    ['service', '/service', '.legal-document', 200],
    ['privacy', '/privacy', '.legal-document', 200],
    ['licenses', '/licenses', '.public-page', 200],
    ['not-found', '/__v13-not-found', '[data-testid="public-error-page"]', 404],
    ['server-error', '/__test__/page-error', '[data-testid="public-error-page"]', 500],
    ['empty', '/works?page=999', '[data-testid="public-empty-state"]', 200],
    ['no-result', '/works?q=__v13_no_result__', '[data-testid="public-empty-state"]', 200],
    ['media-failure', '/works', '.responsive-picture--failed', 200, true],
  ]
  const result = { navigations: {}, routes: {} }

  for (const [name, path, selector, expectedStatus, failImages = false] of routeCases) {
    const page = await context.newPage()
    const errors = []
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', error => errors.push(error.message))
    if (failImages) {
      await page.route('**/*', route => (
        route.request().resourceType() === 'image'
        && !route.request().url().includes('/brand/')
          ? route.abort()
          : route.continue()
      ))
    }
    const response = await page.goto(href(path), { waitUntil: 'domcontentloaded' })
    await page.locator(selector).first().waitFor({ timeout: 10_000 })
    await page.evaluate(async () => {
      await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 3000))])
    })
    await page.waitForTimeout(620)
    result.routes[name] = await page.evaluate(({ expected, isReduced, hasFailure }) => ({
      expectedStatus: expected,
      reduced: isReduced,
      pageEntrances: window.__v13PageEntrances,
      runningAnimations: document.getAnimations()
        .filter(animation => animation.playState === 'running').length,
      rootViewTransitionNames: [...document.querySelectorAll('body *')]
        .map(element => getComputedStyle(element).viewTransitionName)
        .filter(value => value && value !== 'none'),
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      mediaFailurePresent: hasFailure === Boolean(document.querySelector('.responsive-picture--failed')),
    }), { expected: expectedStatus, isReduced: reduced, hasFailure: failImages })
    result.routes[name].status = response?.status() ?? 0
    result.routes[name].errors = (failImages || expectedStatus >= 400)
      ? errors.filter(error => !error.includes('Failed to load resource') && !error.includes('ERR_FAILED'))
      : errors
    await page.close()
  }

  const navigationCases = [
    ['homepage', '/works', '.works-page', '/', '[data-testid="public-home"]'],
    ['works', '/', '[data-testid="public-home"]', '/works', '.works-page'],
    ['adoptions', '/', '[data-testid="public-home"]', '/adoptions', '.adoptions-page'],
    ['commission', '/', '[data-testid="public-home"]', '/commission', '[data-testid="commission-page"]'],
    ['commission-apply', '/', '[data-testid="public-home"]', '/commission/apply', '[data-testid="commission-apply-page"]'],
    ['about', '/', '[data-testid="public-home"]', '/about', '[data-testid="about-page"]'],
    ['service', '/', '[data-testid="public-home"]', '/service', '.legal-document'],
    ['privacy', '/', '[data-testid="public-home"]', '/privacy', '.legal-document'],
    ['licenses', '/', '[data-testid="public-home"]', '/licenses', '.public-page'],
  ]

  for (const [name, sourcePath, sourceSelector, path, selector] of navigationCases) {
    const page = await context.newPage()
    const errors = []
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(href(sourcePath), { waitUntil: 'domcontentloaded' })
    await settle(page, sourceSelector)
    await page.waitForTimeout(900)
    await Promise.all([
      page.waitForURL(url => url.pathname === path, { timeout: 10_000 }),
      page.locator(`a[href="${path}"]`).filter({ visible: true }).first().click(),
    ])
    await page.locator(selector).first().waitFor({ timeout: 10_000 })
    await page.waitForTimeout(620)
    result.navigations[name] = await page.evaluate(() => ({
      pageEntrances: window.__v13PageEntrances,
      runningAnimations: document.getAnimations()
        .filter(animation => animation.playState === 'running').length,
      rootViewTransitionNames: [...document.querySelectorAll('body *')]
        .map(element => getComputedStyle(element).viewTransitionName)
        .filter(value => value && value !== 'none'),
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }))
    result.navigations[name].errors = errors
    await page.close()
  }
  await context.close()
  return result
}

for (const viewport of viewports) {
  await captureScreenshots(viewport)
  for (const scenario of scenarios) {
    await recordMotion(viewport, scenario)
    console.log(`[V13] ${viewport.name} ${scenario}`)
  }
  audit.motion[viewport.name] = {
    standard: await inspectMotion(viewport),
    reduced: await inspectReduced(viewport),
  }
  audit.autoplay[viewport.name] = await inspectAutoplay(viewport)
  audit.publicPages[viewport.name] = {
    standard: await inspectPublicPages(viewport, false),
    reduced: await inspectPublicPages(viewport, true),
  }
}

for (const transitionCase of transitionCases) {
  audit.transitions[transitionCase.name] = {}
  for (const mode of ['forward', 'fallback', 'reduced']) {
    audit.transitions[transitionCase.name][mode] = await captureTransition(transitionCase, mode)
    console.log(`[V13] transition ${transitionCase.name} ${mode}`)
  }
  if (transitionCase.reverseTarget) {
    audit.transitions[transitionCase.name].reverse = await captureReverseTransition(transitionCase)
    console.log(`[V13] transition ${transitionCase.name} reverse`)
  }
}

const standardMotion = Object.values(audit.motion).map(item => item.standard)
const reducedMotion = Object.values(audit.motion).map(item => item.reduced)
const autoplay = Object.values(audit.autoplay)
const publicPages = Object.values(audit.publicPages)
const layoutStaysFixed = standardMotion.every(item => {
  const { before, after } = item.featured.layout
  return before.slug !== after.slug
    && near(before.titleY, after.titleY)
    && near(before.speciesY, after.speciesY)
    && near(before.actionY, after.actionY)
    && near(before.controlsY, after.controlsY)
})

audit.checks = {
  heroBrandLock: standardMotion.every(item => (
    item.hero.before.text === '有点小狗工作室'
    && item.hero.before.text === item.hero.after.text
    && item.hero.before.fontFamily === item.hero.after.fontFamily
    && item.hero.before.fontSize === item.hero.after.fontSize
    && item.hero.before.fontWeight === item.hero.after.fontWeight
    && item.hero.before.letterSpacing === item.hero.after.letterSpacing
    && item.hero.before.lineHeight === item.hero.after.lineHeight
    && Object.keys(item.hero.before.rect).every(key => near(item.hero.before.rect[key], item.hero.after.rect[key]))
  )),
  heroEntranceAndDirection: standardMotion.every(item => (
    item.hero.before.entrance.includes('home-hero-title-in')
    && item.hero.next
    && item.hero.previous
    && item.hero.after.slideCount === 1
  )),
  featuredHierarchy: standardMotion.every(item => (
    item.featured.layers.media > item.featured.layers.title
    && item.featured.layers.title > item.featured.layers.species
    && item.featured.layers.species > item.featured.layers.action
  )),
  featuredLayoutStaysFixed: layoutStaysFixed,
  featuredDirectionAndInterrupt: standardMotion.every(item => (
    item.featured.previous
    && item.featured.terminal.contentCount === 1
    && item.featured.terminal.mediaCount === 1
    && item.featured.terminal.runningAnimations === 0
    && item.featured.terminal.displayAnimations === 0
  )),
  adoptionHierarchyDirectionAndInterrupt: standardMotion.every(item => (
    item.adoption.before !== item.adoption.terminal.slug
    && item.adoption.next
    && item.adoption.previous
    && item.adoption.nextLayers.title.includes('24px')
    && item.adoption.nextLayers.facts.includes('16px')
    && item.adoption.nextLayers.action.includes('8px')
    && item.adoption.previousLayers.title.includes('-24px')
    && item.adoption.previousLayers.facts.includes('-16px')
    && item.adoption.previousLayers.action.includes('-8px')
    && item.adoption.terminal.mediaCount === 1
    && item.adoption.terminal.runningAnimations === 0
    && item.adoption.terminal.imageHref.includes(item.adoption.terminal.slug)
    && item.adoption.terminal.actionHref.includes(item.adoption.terminal.slug)
  )),
  autoplayFourSecondsAndPausable: autoplay.every(item => (
    item.initial.hero !== item.advanced.hero
    && item.initial.featured !== item.advanced.featured
    && item.initial.adoption !== item.advanced.adoption
    && item.paused.hero === item.remainedPaused.hero
    && item.paused.featured === item.remainedPaused.featured
    && item.paused.adoption === item.remainedPaused.adoption
    && item.remainedPaused.hero !== item.resumed.hero
    && item.remainedPaused.featured !== item.resumed.featured
    && item.remainedPaused.adoption !== item.resumed.adoption
    && item.hidden.hero === item.remainedHidden.hero
    && item.hidden.featured === item.remainedHidden.featured
    && item.hidden.adoption === item.remainedHidden.adoption
    && item.remainedHidden.hero !== item.visibleAgain.hero
    && item.remainedHidden.featured !== item.visibleAgain.featured
    && item.remainedHidden.adoption !== item.visibleAgain.adoption
  )),
  reducedMotionStopsAutoplay: reducedMotion.every(item => (
    item.initial.hero === item.terminal.hero
    && item.initial.featured === item.terminal.featured
    && item.initial.adoption === item.terminal.adoption
    && item.terminal.heroReduced === 'true'
    && item.terminal.featuredReduced === 'true'
    && item.terminal.adoptionReduced === 'true'
    && item.terminal.pauseCount === 0
    && item.manualTerminal.runningAnimations === 0
    && item.manualTerminal.contentCount === 1
    && item.manualTerminal.mediaCount === 1
    && item.manualTerminal.adoptionMediaCount === 1
  )),
  noRuntimeErrors: standardMotion.every(item => item.errors.length === 0),
  noOverflowAndImagesDecoded: standardMotion.every(item => (
    item.featured.terminal.noHorizontalOverflow
    && item.featured.terminal.imagesDecoded
    && item.featured.terminal.footerPresent
  )),
  publicPageEntranceMatrix: publicPages.every(item => (
    Object.values(item.standard.routes).every(page => (
      page.status === page.expectedStatus
      && page.rootViewTransitionNames.length === 0
      && page.noHorizontalOverflow
      && page.mediaFailurePresent
      && page.errors.length === 0
    ))
    && item.standard.routes['not-found'].pageEntrances.includes('public-error')
    && item.standard.routes['server-error'].pageEntrances.includes('public-error')
    && Object.values(item.standard.navigations).every(page => (
      page.pageEntrances.includes('public-page')
      && page.rootViewTransitionNames.length === 0
      && page.noHorizontalOverflow
      && page.errors.length === 0
    ))
    && Object.values(item.reduced.routes).every(page => (
      page.status === page.expectedStatus
      && page.pageEntrances.length === 0
      && page.runningAnimations === 0
      && page.rootViewTransitionNames.length === 0
      && page.noHorizontalOverflow
      && page.mediaFailurePresent
      && page.errors.length === 0
    ))
    && Object.values(item.reduced.navigations).every(page => (
      page.pageEntrances.length === 0
      && page.runningAnimations === 0
      && page.rootViewTransitionNames.length === 0
      && page.noHorizontalOverflow
      && page.errors.length === 0
    ))
  )),
  transitionWhitelistForward: transitionCases.every(transitionCase => {
    const result = audit.transitions[transitionCase.name].forward
    return result.supported
      && result.beforeNames.length === 0
      && result.calls.length === 1
      && result.calls[0].filter(item => item.name === transitionCase.transitionName).length === 1
      && result.destinationNames.includes(transitionCase.transitionName)
      && result.pageEntrances.length === 0
      && result.rootOldAnimation === 'none'
      && result.rootNewAnimation === 'none'
      && result.runningAnimations === 0
      && result.imagesDecoded
  }),
  transitionFallback: transitionCases.every(transitionCase => {
    const result = audit.transitions[transitionCase.name].fallback
    return result.supported && result.calls.length === 0 && result.runningAnimations === 0
  }),
  transitionReduced: transitionCases.every(transitionCase => {
    const result = audit.transitions[transitionCase.name].reduced
    return result.calls.length <= 1
      && Number.parseFloat(result.expectedDuration) <= 0.001
      && result.runningAnimations === 0
      && result.imagesDecoded
  }),
  clickedCardSourcesOnly: ['works-card', 'adoption-card'].every(name => (
    !audit.transitions[name].forward.beforeNames.includes(`${name}-media`)
  )),
  catalogReverseTransitions: transitionCases
    .filter(transitionCase => transitionCase.reverseTarget)
    .every((transitionCase) => {
      const result = audit.transitions[transitionCase.name].reverse
      return result.calls.length === 2
        && result.calls[1].filter(item => item.name === transitionCase.transitionName).length === 1
        && result.destinationNames.includes(transitionCase.transitionName)
        && result.query.includes(`view=${transitionCase.name === 'works-card' ? 'worksCard' : 'adoptionCard'}`)
        && result.query.includes(`slug=${result.slug}`)
        && result.runningAnimations === 0
        && result.imagesDecoded
    }),
}

await writeFile(
  resolve(outputDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)
await rm(videoDirectory, { force: true, recursive: true })
await browser.close()

if (Object.values(audit.checks).some(value => value !== true)) {
  throw new Error('V13 evidence checks failed.')
}

console.log('[V13] evidence complete')

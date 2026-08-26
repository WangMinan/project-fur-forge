import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V14_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V14',
)
await mkdir(outputDirectory, { recursive: true })

const executablePath = process.env.V14_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) })
const audit = { capturedAt: new Date().toISOString(), baseURL, viewports: {}, checks: {} }

const controlSelectors = [
  '.public-header__brand',
  '.public-header__link',
  '.public-header__subnav-link',
  '.public-header__menu',
  '.mobile-nav__close',
  '.mobile-nav__link',
  '.mobile-nav__sublink',
  '.home-hero__arrow',
  '.home-hero__dot',
  '.home-hero__pause',
  '[data-featured-action]',
  '[data-testid="home-adoption-selector"] button',
  '[data-testid="home-adoption-stepper"] button',
  '[data-testid="home-adoption-pause"]',
  '.catalog-search__input',
  '.catalog-search__submit',
  '.catalog-search__clear',
  '.pagination__page',
  '.pagination__step',
  '.public-action',
  '.work-gallery__thumb',
]

async function settle(page) {
  await page.waitForTimeout(350)
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))])
    await Promise.race([
      Promise.all([...document.images].map(image => image.complete
        ? Promise.resolve()
        : image.decode().catch(() => undefined))),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ])
  })
}

async function measureControls(page) {
  return page.evaluate((selectors) => selectors.flatMap((selector) => {
    return [...document.querySelectorAll(selector)].flatMap((element) => {
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') return []
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return []
      return [{
        selector,
        tag: element.tagName.toLowerCase(),
        width: element instanceof HTMLElement ? element.offsetWidth : 0,
        height: element instanceof HTMLElement ? element.offsetHeight : 0,
        visualWidth: rect.width,
        visualHeight: rect.height,
        disabled: element.matches(':disabled, [aria-disabled="true"]'),
        busy: element.matches('[aria-busy="true"]'),
      }]
    })
  }), controlSelectors)
}

async function captureRoute(page, name, path, viewport, errors) {
  await page.goto(new URL(path, baseURL).href, { waitUntil: 'domcontentloaded' })
  await settle(page)
  const controls = await measureControls(page)
  const activeElement = await page.evaluate(() => {
    const candidate = document.querySelector(
      '.public-action, .pagination__page, .catalog-search__input, .work-gallery__thumb, .public-header__link',
    )
    if (!(candidate instanceof HTMLElement)) return null
    candidate.focus()
    return {
      tag: candidate.tagName.toLowerCase(),
      className: candidate.className,
      focused: document.activeElement === candidate,
      focusVisible: candidate.matches(':focus-visible'),
    }
  })
  const interactiveStates = await page.evaluate(() => ({
    hoverCandidates: document.querySelectorAll(
      '.public-action, .pagination__page, .pagination__step, .catalog-search__submit, .work-gallery__thumb',
    ).length,
    activeCandidates: document.querySelectorAll(
      '[aria-current="page"], [aria-current="true"], [aria-pressed="true"], .pagination__page--current',
    ).length,
    disabledCandidates: document.querySelectorAll(
      ':disabled, [aria-disabled="true"], .pagination__step--disabled',
    ).length,
    loadingCandidates: document.querySelectorAll('[aria-busy="true"], [data-loading="true"]').length,
  }))
  const noHorizontalOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))
  const namedViewTransitions = await page.evaluate(() => (
    [...document.querySelectorAll('body *')]
      .map(element => getComputedStyle(element).viewTransitionName)
      .filter(name => name && name !== 'none')
  ))
  await page.screenshot({
    path: resolve(outputDirectory, `${name}-${viewport}.png`),
    fullPage: true,
  })
  return {
    errors: [...errors],
    controls,
    activeElement,
    interactiveStates,
    namedViewTransitions,
    noHorizontalOverflow,
  }
}

async function captureViewport(name, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })

  const routes = [
    ['home', '/'],
    ['works', '/works'],
    ['adoptions', '/adoptions'],
    ['works-search-empty', '/works?q=__v14_no_match__'],
  ]
  const routeResults = {}
  for (const [routeName, path] of routes) {
    routeResults[routeName] = await captureRoute(page, routeName, path, name, errors)
  }

  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  await settle(page)
  if (viewport.width < 1024 && await page.locator('.public-header__menu').isVisible()) {
    await page.locator('.public-header__menu').click()
    await page.screenshot({
      path: resolve(outputDirectory, `${name}-mobile-nav-open.png`),
      fullPage: false,
    })
    routeResults.mobileNav = {
      errors: [...errors],
      controls: await measureControls(page),
      noHorizontalOverflow: await page.evaluate(() => (
        document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )),
    }
  }

  await page.goto(new URL('/works', baseURL).href, { waitUntil: 'domcontentloaded' })
  await settle(page)
  const workHref = await page.locator('a.work-card').first().getAttribute('href').catch(() => null)
  if (workHref) {
    routeResults.workDetail = await captureRoute(page, 'work-detail', workHref, name, errors)
  }

  audit.viewports[name] = routeResults
  await context.close()
}

await captureViewport('desktop-1440x900', { width: 1440, height: 900 })
await captureViewport('mobile-390x844', { width: 390, height: 844 })

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
const interactionPage = await interactionContext.newPage()
audit.interactions = { adoptionReturns: [], featuredFade: null }
for (const cardIndex of [1, 3]) {
  await interactionPage.goto(new URL('/adoptions', baseURL).href, { waitUntil: 'domcontentloaded' })
  await settle(interactionPage)
  const cards = interactionPage.locator('a.adoption-card')
  if (await cards.count() <= cardIndex) {
    audit.interactions.adoptionReturns.push({ card: cardIndex + 1, available: false, returned: false })
    continue
  }
  const slug = await cards.nth(cardIndex).getAttribute('data-work-slug')
  await cards.nth(cardIndex).click()
  await settle(interactionPage)
  await interactionPage.screenshot({
    path: resolve(outputDirectory, `mobile-adoption-${cardIndex + 1}-detail.png`),
    fullPage: false,
  })
  const backLink = interactionPage.locator('.work-detail__back-link')
  await backLink.click()
  await interactionPage.waitForURL(url => url.pathname === '/adoptions')
  audit.interactions.adoptionReturns.push({
    card: cardIndex + 1,
    available: true,
    returned: true,
    slug,
  })
}

await interactionPage.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
await settle(interactionPage)
const featuredNext = interactionPage.locator('[data-featured-action="next"]')
if (await featuredNext.isVisible().catch(() => false)) {
  const before = await interactionPage.locator('.featured-works__media').getAttribute('data-work-slug')
  await featuredNext.click()
  const transitionClasses = await interactionPage.locator(
    '.featured-media-next-enter-active, .featured-media-next-leave-active, .featured-media-prev-enter-active, .featured-media-prev-leave-active',
  ).count()
  const after = await interactionPage.locator('.featured-works__media').getAttribute('data-work-slug')
  audit.interactions.featuredFade = {
    after,
    before,
    changed: before !== after,
    transitionClasses,
  }
}
await interactionContext.close()

const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const reducedPage = await reducedContext.newPage()
await reducedPage.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
await settle(reducedPage)
audit.reduced = await reducedPage.evaluate(() => ({
  media: matchMedia('(prefers-reduced-motion: reduce)').matches,
  rootAnimations: document.querySelector('[data-testid="public-home"]')?.getAnimations({ subtree: true }).length ?? 0,
  noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  controls: [...document.querySelectorAll('.home-hero__arrow, .home-hero__dot, .home-hero__pause')].map((element) => ({
    selector: element.className,
    width: element instanceof HTMLElement ? element.offsetWidth : 0,
    height: element instanceof HTMLElement ? element.offsetHeight : 0,
  })),
}))
await reducedPage.screenshot({ path: resolve(outputDirectory, 'mobile-390x844-reduced.png'), fullPage: true })
await reducedContext.close()

const allRouteResults = Object.values(audit.viewports).flatMap(viewport => Object.values(viewport))
const allControls = allRouteResults.flatMap(route => route.controls ?? [])
audit.checks = {
  noErrors: allRouteResults.every(route => route.errors?.length === 0),
  noHorizontalOverflow: allRouteResults.every(route => route.noHorizontalOverflow !== false) && audit.reduced.noHorizontalOverflow,
  controlsHaveStableTarget: allControls.length > 0 && allControls.every(control => control.width >= 44 && control.height >= 44),
  keyboardFocusEvidence: allRouteResults.some(route => route.activeElement?.focused && route.activeElement?.focusVisible),
  activeStateEvidence: allRouteResults.some(route => route.interactiveStates?.activeCandidates > 0),
  disabledStateEvidence: allRouteResults.some(route => route.interactiveStates?.disabledCandidates > 0),
  noSharedMediaTransitions: allRouteResults.every(route => route.namedViewTransitions?.length === 0),
  adoptionReturnWorks: audit.interactions.adoptionReturns.length === 2
    && audit.interactions.adoptionReturns.every(result => result.available && result.returned),
  featuredFadeWorks: Boolean(
    audit.interactions.featuredFade?.changed
    && audit.interactions.featuredFade.transitionClasses > 0,
  ),
  reducedMotionDetected: audit.reduced.media && audit.reduced.rootAnimations === 0,
}
await writeFile(resolve(outputDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
await browser.close()
if (Object.values(audit.checks).some(value => value !== true)) throw new Error('V14 evidence checks failed.')
console.log('[V14] evidence complete')

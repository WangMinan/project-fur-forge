import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const verify = process.argv.includes('--verify')
const baseURL = process.env.V15_BASE_URL ?? 'http://127.0.0.1:3000/'
const errorBaseURL = process.env.V15_ERROR_BASE_URL ?? baseURL
const evidenceDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V15',
)
const matrixDirectory = resolve(evidenceDirectory, 'matrix')
const reviewDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/.design/screenshots/v15-final-review',
)
await Promise.all([
  mkdir(matrixDirectory, { recursive: true }),
  mkdir(reviewDirectory, { recursive: true }),
])

const executablePath = process.env.V15_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) })

const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1023x900', width: 1023, height: 900 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
]
const routes = [
  { name: 'home', path: '/', selector: '[data-testid="public-home"]', status: 200 },
  { name: 'works', path: '/works', selector: '.works-page', status: 200 },
  { name: 'adoptions', path: '/adoptions', selector: '.adoptions-page', status: 200 },
  { name: 'work-detail', path: '/works/brand-assets-b', selector: '[data-testid="work-detail"]', status: 200 },
  { name: 'adoption-detail', path: '/works/adoption-regular-2?from=adoptions', selector: '[data-testid="work-detail"]', status: 200 },
  { name: 'commission', path: '/commission', selector: '[data-testid="commission-page"]', status: 200 },
  { name: 'commission-apply', path: '/commission/apply', selector: '[data-testid="commission-apply-page"]', status: 200 },
  { name: 'about', path: '/about', selector: '[data-testid="about-page"]', status: 200 },
  { name: 'service', path: '/service', selector: 'main', status: 200 },
  { name: 'privacy', path: '/privacy', selector: 'main', status: 200 },
  { name: 'licenses', path: '/licenses', selector: 'main', status: 200 },
  { name: 'not-found', path: '/__v15_not_found', selector: '[data-testid="public-error-page"]', status: 404 },
  { name: 'works-empty', path: '/works?page=9999', selector: '[data-testid="public-empty-state"]', status: 200 },
  { name: 'works-no-result', path: '/works?q=__v15_no_match__', selector: '[data-testid="public-empty-state"]', status: 200 },
  { name: 'adoptions-no-result', path: '/adoptions?q=__v15_no_match__', selector: '[data-testid="public-empty-state"]', status: 200 },
]
const designReviewRoutes = routes.filter(route => ![
  'works-empty',
  'works-no-result',
  'adoptions-no-result',
].includes(route.name))
const designReviewViewports = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
]
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

const audit = {
  capturedAt: new Date().toISOString(),
  environment: { baseURL, errorBaseURL, executablePath },
  matrix: {},
  input: {},
  preferences: {},
  noJavaScript: {},
  designReview: {},
  checks: {},
}

function href(path, base = baseURL) {
  return new URL(path, base).href
}

async function settle(page, selector) {
  await page.locator(selector).first().waitFor({ timeout: 15000 })
  const lazyImages = page.locator('img[loading="lazy"]')
  for (let index = 0; index < await lazyImages.count(); index += 1) {
    const image = lazyImages.nth(index)
    if (await image.isVisible()) {
      await image.scrollIntoViewIfNeeded()
      await page.waitForTimeout(32)
    }
  }
  await page.evaluate(async () => {
    window.scrollTo(0, 0)
    await Promise.race([document.fonts.ready, new Promise(done => setTimeout(done, 2000))])
    await Promise.race([
      Promise.all([...document.images].map(image => (
        image.complete ? Promise.resolve() : image.decode().catch(() => undefined)
      ))),
      new Promise(done => setTimeout(done, 4000)),
    ])
  })
  await page.waitForTimeout(120)
}

async function inspect(page, selector) {
  return page.evaluate(({ controlSelectors, selector }) => {
    const visible = element => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }
    const interactiveVisible = element => {
      const style = getComputedStyle(element)
      return visible(element) && Number.parseFloat(style.opacity) > 0.01 && style.pointerEvents !== 'none'
    }
    const accessibleName = element => (
      element.getAttribute('aria-label')
      || element.getAttribute('title')
      || element.textContent?.trim()
      || (element.querySelector('img[alt]')?.getAttribute('alt') ?? '')
    ).trim()
    const controls = controlSelectors.flatMap(controlSelector => (
      [...document.querySelectorAll(controlSelector)]
        .filter(interactiveVisible)
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            selector: controlSelector,
            width: rect.width,
            height: rect.height,
            disabled: element.matches(':disabled, [aria-disabled="true"]'),
          }
        })
    ))
    const fields = [...document.querySelectorAll('input:not([type="hidden"]), textarea, select')]
      .filter(element => !element.closest('[aria-hidden="true"]'))
    const missingFieldLabels = fields.filter((field) => {
      const id = field.getAttribute('id')
      return !field.getAttribute('aria-label')
        && !field.getAttribute('aria-labelledby')
        && !field.closest('label')
        && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
    }).map(field => field.outerHTML.slice(0, 180))
    const unnamedActions = [...document.querySelectorAll('button, a[href]')]
      .filter(interactiveVisible)
      .filter(element => !accessibleName(element))
      .map(element => element.outerHTML.slice(0, 180))
    const images = [...document.images].filter(visible)
    const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .filter(visible)
      .map(element => ({ level: Number(element.tagName.slice(1)), text: element.textContent?.trim() ?? '' }))
    const headingSkips = headings.filter((heading, index) => (
      index > 0 && heading.level > headings[index - 1].level + 1
    ))
    const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''
    const target = document.querySelector(selector)
    return {
      selectorFound: Boolean(target),
      targetText: target?.textContent?.replace(/\s+/gu, ' ').trim().slice(0, 240) ?? '',
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      overflowBy: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controls,
      missingFieldLabels,
      unnamedActions,
      h1Count: headings.filter(heading => heading.level === 1).length,
      headingSkips,
      imageCount: images.length,
      missingImageAlts: images.filter(image => !image.hasAttribute('alt')).length,
      missingImageDimensions: images.filter(image => !image.hasAttribute('width') || !image.hasAttribute('height')).length,
      failedImages: images
        .filter(image => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
        .map(image => image.currentSrc || image.getAttribute('src') || image.alt || '(unnamed image)'),
      failedPictures: document.querySelectorAll('.responsive-picture--failed').length,
      mainPresent: Boolean(document.querySelector('main')),
      skipLinkPresent: Boolean(document.querySelector('a[href="#main-content"]')),
      footerPresent: Boolean(document.querySelector('footer')),
      viewport,
      zoomAllowed: !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\D|$)/iu.test(viewport),
      inputFontSizes: fields.filter(visible).map(field => Number.parseFloat(getComputedStyle(field).fontSize)),
      pointer: {
        coarse: matchMedia('(pointer: coarse)').matches,
        fine: matchMedia('(pointer: fine)').matches,
        hover: matchMedia('(hover: hover)').matches,
      },
    }
  }, { controlSelectors, selector })
}

async function captureMatrix() {
  for (const viewport of viewports) {
    audit.matrix[viewport.name] = {}
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    let errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    const viewportDirectory = resolve(matrixDirectory, viewport.name)
    await mkdir(viewportDirectory, { recursive: true })
    for (const route of routes) {
      errors = []
      const response = await page.goto(href(route.path), { waitUntil: 'domcontentloaded' })
      await settle(page, route.selector)
      audit.matrix[viewport.name][route.name] = {
        status: response?.status() ?? null,
        errors: [...errors],
        ...await inspect(page, route.selector),
      }
      await page.screenshot({
        path: resolve(viewportDirectory, `${route.name}.png`),
        fullPage: true,
      })
      console.log(`[V15] matrix ${viewport.name} ${route.name}`)
    }
    await context.close()
  }
}

async function captureInputEvidence() {
  const keyboardContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const keyboardPage = await keyboardContext.newPage()
  await keyboardPage.goto(href('/works'), { waitUntil: 'domcontentloaded' })
  await settle(keyboardPage, '.works-page')
  await keyboardPage.keyboard.press('Tab')
  const firstFocus = await keyboardPage.evaluate(() => ({
    className: document.activeElement?.className ?? '',
    href: document.activeElement?.getAttribute('href') ?? '',
    focusVisible: document.activeElement?.matches(':focus-visible') ?? false,
  }))
  await keyboardPage.keyboard.press('Enter')
  const skipTarget = await keyboardPage.evaluate(() => ({
    id: document.activeElement?.id ?? '',
    focused: document.activeElement === document.querySelector('#main-content'),
  }))
  const focusTrail = []
  for (let index = 0; index < 18; index += 1) {
    await keyboardPage.keyboard.press('Tab')
    focusTrail.push(await keyboardPage.evaluate(() => {
      const element = document.activeElement
      const rect = element?.getBoundingClientRect()
      const header = document.querySelector('.public-header')?.getBoundingClientRect()
      return {
        name: element?.getAttribute('aria-label') || element?.textContent?.trim().slice(0, 60) || element?.tagName,
        focusVisible: element?.matches(':focus-visible') ?? false,
        coveredByHeader: Boolean(rect && header && rect.bottom > header.top && rect.top < header.bottom && !element?.closest('.public-header')),
      }
    }))
  }
  audit.input.keyboard = { firstFocus, skipTarget, focusTrail }
  await keyboardContext.close()

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(href('/works'), { waitUntil: 'domcontentloaded' })
  await settle(mobilePage, '.works-page')
  const menu = mobilePage.locator('.public-header__menu')
  for (let attempt = 0; attempt < 3 && await menu.getAttribute('aria-expanded') !== 'true'; attempt += 1) {
    await menu.click()
    await mobilePage.waitForTimeout(250)
  }
  const panel = mobilePage.locator('[data-testid="public-mobile-nav"]')
  await panel.waitFor()
  const openFocus = await mobilePage.evaluate(() => ({
    insidePanel: Boolean(document.activeElement?.closest('[data-testid="public-mobile-nav"]')),
    label: document.activeElement?.getAttribute('aria-label') ?? '',
  }))
  for (let index = 0; index < 12; index += 1) await mobilePage.keyboard.press('Tab')
  const trapped = await mobilePage.evaluate(() => Boolean(
    document.activeElement?.closest('[data-testid="public-mobile-nav"]'),
  ))
  await mobilePage.keyboard.press('Escape')
  await panel.waitFor({ state: 'hidden' })
  const restored = await mobilePage.evaluate(() => document.activeElement === document.querySelector('.public-header__menu'))
  audit.input.touch = {
    media: await mobilePage.evaluate(() => ({
      coarse: matchMedia('(pointer: coarse)').matches,
      fine: matchMedia('(pointer: fine)').matches,
      hover: matchMedia('(hover: hover)').matches,
    })),
    openFocus,
    trapped,
    restored,
  }
  await mobileContext.close()

  const fineContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const finePage = await fineContext.newPage()
  await finePage.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(finePage, '[data-testid="public-home"]')
  const commissionNav = finePage.locator('.public-header__nav-item').filter({
    has: finePage.locator('.public-header__subnav'),
  }).first()
  await commissionNav.hover()
  await finePage.waitForTimeout(250)
  audit.input.finePointer = {
    media: await finePage.evaluate(() => ({
      coarse: matchMedia('(pointer: coarse)').matches,
      fine: matchMedia('(pointer: fine)').matches,
      hover: matchMedia('(hover: hover)').matches,
    })),
    subnavVisible: await commissionNav.locator('.public-header__subnav').isVisible(),
  }
  await fineContext.close()

  const imeContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const imePage = await imeContext.newPage()
  audit.input.ime = {}
  for (const route of ['/works', '/adoptions']) {
    await imePage.goto(href(route), { waitUntil: 'domcontentloaded' })
    await settle(imePage, route === '/works' ? '.works-page' : '.adoptions-page')
    const input = imePage.locator('.catalog-search__input')
    await input.focus()
    await input.evaluate((element, value) => {
      element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(element, value)
      element.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertCompositionText', isComposing: true }))
      element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: value }))
      element.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }))
    }, '常规领养测试2')
    await Promise.all([
      imePage.waitForURL(url => url.pathname === route && url.searchParams.get('q') === '常规领养测试2'),
      imePage.locator('.catalog-search__submit').click(),
    ])
    audit.input.ime[route] = {
      query: new URL(imePage.url()).searchParams.get('q'),
      value: await imePage.locator('.catalog-search__input').inputValue(),
    }
  }
  await imePage.setViewportSize({ width: 390, height: 480 })
  const searchInput = imePage.locator('.catalog-search__input')
  await searchInput.focus()
  await searchInput.scrollIntoViewIfNeeded()
  audit.input.softKeyboard = await searchInput.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight, visible: rect.top >= 0 && rect.bottom <= innerHeight }
  })
  await imeContext.close()
}

async function emulatePreference(name, feature, value) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const session = await context.newCDPSession(page)
  await session.send('Emulation.setEmulatedMedia', { features: [{ name: feature, value }] })
  await page.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="public-home"]')
  const result = await page.evaluate(({ feature, value }) => {
    const root = getComputedStyle(document.documentElement)
    const header = document.querySelector('.public-header')
    return {
      matches: matchMedia(`(${feature}: ${value})`).matches,
      animationCount: document.querySelector('[data-testid="public-home"]')?.getAnimations({ subtree: true }).length ?? 0,
      overlaySoft: root.getPropertyValue('--public-overlay-soft').trim(),
      borderPrimary: root.getPropertyValue('--public-border-primary').trim(),
      focusRing: root.getPropertyValue('--public-focus-ring').trim(),
      headerBackdrop: header ? getComputedStyle(header).backdropFilter : '',
    }
  }, { feature, value })
  await page.screenshot({ path: resolve(evidenceDirectory, `${name}-390x844.png`), fullPage: true })
  await context.close()
  return result
}

async function capturePreferences() {
  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const reducedPage = await reducedContext.newPage()
  await reducedPage.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(reducedPage, '[data-testid="public-home"]')
  await reducedPage.waitForFunction(() => (
    document.querySelector('[data-testid="featured-works"]')?.getAttribute('data-reduced-motion') === 'true'
  ))
  audit.preferences.reducedMotion = await reducedPage.evaluate(() => ({
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animationCount: document.querySelector('[data-testid="public-home"]')?.getAnimations({ subtree: true }).length ?? 0,
    featuredPauseHidden: getComputedStyle(document.querySelector('[data-featured-action="pause"]')).display === 'none',
  }))
  await reducedPage.screenshot({ path: resolve(evidenceDirectory, 'reduced-motion-390x844.png'), fullPage: true })
  await reducedContext.close()
  audit.preferences.reducedTransparency = await emulatePreference(
    'reduced-transparency',
    'prefers-reduced-transparency',
    'reduce',
  )
  audit.preferences.moreContrast = await emulatePreference('more-contrast', 'prefers-contrast', 'more')
}

async function captureNoJavaScript() {
  for (const viewport of [viewports[0], viewports.at(-1)]) {
    const context = await browser.newContext({ viewport, javaScriptEnabled: false })
    const page = await context.newPage()
    audit.noJavaScript[viewport.name] = {}
    for (const route of routes) {
      const response = await page.goto(href(route.path), { waitUntil: 'domcontentloaded' })
      await settle(page, route.selector)
      audit.noJavaScript[viewport.name][route.name] = {
        status: response?.status() ?? null,
        ...await inspect(page, route.selector),
      }
    }
    for (const name of ['home', 'works', 'commission-apply']) {
      const route = routes.find(candidate => candidate.name === name)
      await page.goto(href(route.path), { waitUntil: 'domcontentloaded' })
      await page.screenshot({
        path: resolve(evidenceDirectory, `no-js-${name}-${viewport.name}.png`),
        fullPage: true,
      })
    }
    await context.close()
  }
}

async function captureDesignReview() {
  for (const viewport of designReviewViewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    audit.designReview[viewport.name] = {}
    for (const route of designReviewRoutes) {
      const response = await page.goto(href(route.path), { waitUntil: 'domcontentloaded' })
      await settle(page, route.selector)
      await page.screenshot({
        path: resolve(reviewDirectory, `review-${route.name}-${viewport.name}.png`),
        fullPage: true,
      })
      audit.designReview[viewport.name][route.name] = response?.status() ?? null
    }
    await context.close()
  }
}

async function captureContactSheets() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  for (const viewport of designReviewViewports) {
    const cards = await Promise.all(designReviewRoutes.map(async route => (
      `<article><h2>review-${route.name}</h2><img alt="" src="data:image/png;base64,${(
        await readFile(resolve(reviewDirectory, `review-${route.name}-${viewport.name}.png`))
      ).toString('base64')}"></article>`
    )))
    await page.setContent(`<style>
      * { box-sizing: border-box; }
      body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 0; padding: 20px; background: #ddd; font-family: Arial, sans-serif; }
      article { align-self: start; padding: 10px; border: 1px solid #aaa; background: #fff; }
      h2 { margin: 0 0 10px; font-size: 16px; }
      img { display: block; width: 100%; height: 430px; background: #f5f5f5; object-fit: contain; object-position: top center; }
    </style>${cards.join('')}`, { waitUntil: 'load' })
    await page.screenshot({
      path: resolve(reviewDirectory, `contact-sheet-${viewport.name}.png`),
      fullPage: true,
    })
  }
  await context.close()
}

async function captureServerError() {
  const response = await fetch(href('/__test__/page-error', errorBaseURL)).catch(() => null)
  audit.environment.errorFixtureStatus = response?.status ?? null
  if (response?.status !== 500) return
  audit.serverError = {}
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const navigation = await page.goto(href('/__test__/page-error', errorBaseURL), { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-testid="public-error-page"]')
    audit.serverError[viewport.name] = {
      status: navigation?.status() ?? null,
      ...await inspect(page, '[data-testid="public-error-page"]'),
    }
    await page.screenshot({
      path: resolve(matrixDirectory, viewport.name, 'server-error.png'),
      fullPage: true,
    })
    await context.close()
  }
}

await captureMatrix()
await captureInputEvidence()
await capturePreferences()
await captureNoJavaScript()
await captureDesignReview()
await captureContactSheets()
await captureServerError()

const matrixStates = Object.values(audit.matrix).flatMap(viewport => Object.values(viewport))
const noJavaScriptStates = Object.values(audit.noJavaScript).flatMap(viewport => Object.values(viewport))
const controlStates = matrixStates.flatMap(state => state.controls)
const allStates = [...matrixStates, ...noJavaScriptStates]
const browserConstrainedSafeArea = allStates.every(state => (
  /width\s*=\s*device-width/iu.test(state.viewport)
  && !/viewport-fit\s*=\s*cover/iu.test(state.viewport)
))
audit.environment.safeAreaStrategy = 'browser-constrained-default-viewport'
audit.checks = {
  expectedStatuses: viewports.every(viewport => routes.every(route => (
    audit.matrix[viewport.name][route.name].status === route.status
  ))),
  noRuntimeErrors: viewports.every(viewport => routes
    .filter(route => route.status < 400)
    .every(route => audit.matrix[viewport.name][route.name].errors.length === 0)),
  noHorizontalOverflow: allStates.every(state => state.noHorizontalOverflow),
  selectorsFound: allStates.every(state => state.selectorFound),
  controlsAtLeast44: controlStates.length > 0 && controlStates.every(control => (
    control.disabled || (control.width >= 44 && control.height >= 44)
  )),
  publicSemantics: allStates.every(state => (
    state.mainPresent
    && state.missingFieldLabels.length === 0
    && state.unnamedActions.length === 0
    && state.missingImageAlts === 0
    && state.h1Count <= 1
  )),
  imageDimensions: allStates.every(state => state.missingImageDimensions === 0),
  imagesDecoded: allStates.every(state => state.failedImages.length === 0),
  zoomAllowed: allStates.every(state => state.zoomAllowed),
  mobileInputFontAtLeast16: viewports.filter(viewport => viewport.width < 768).every(viewport => (
    Object.values(audit.matrix[viewport.name]).every(state => state.inputFontSizes.every(size => size >= 16))
  )),
  breakpointBoundary: (
    audit.matrix['1023x900'].home.controls.some(control => control.selector === '.public-header__menu')
    && !audit.matrix['1023x900'].home.controls.some(control => control.selector === '.public-header__link')
    && audit.matrix['1024x900'].home.controls.some(control => control.selector === '.public-header__link')
    && !audit.matrix['1024x900'].home.controls.some(control => control.selector === '.public-header__menu')
  ),
  skipLink: audit.input.keyboard.firstFocus.href === '#main-content'
    && audit.input.keyboard.firstFocus.focusVisible
    && audit.input.keyboard.skipTarget.focused,
  keyboardFocusVisible: audit.input.keyboard.focusTrail.every(item => item.focusVisible && !item.coveredByHeader),
  mobileNavFocus: audit.input.touch.openFocus.insidePanel && audit.input.touch.trapped && audit.input.touch.restored,
  pointerModes: audit.input.touch.media.coarse
    && !audit.input.touch.media.hover
    && audit.input.finePointer.media.fine
    && audit.input.finePointer.media.hover
    && audit.input.finePointer.subnavVisible,
  ime: Object.values(audit.input.ime).every(state => state.query === '常规领养测试2' && state.value === '常规领养测试2'),
  softKeyboard: audit.input.softKeyboard.visible,
  reducedMotion: audit.preferences.reducedMotion.matches
    && audit.preferences.reducedMotion.animationCount === 0
    && audit.preferences.reducedMotion.featuredPauseHidden,
  reducedTransparency: audit.preferences.reducedTransparency.matches,
  moreContrast: audit.preferences.moreContrast.matches,
  noJavaScriptSSR: noJavaScriptStates.every(state => state.selectorFound && state.noHorizontalOverflow),
  safeArea: browserConstrainedSafeArea,
  serverError: audit.environment.errorFixtureStatus === 500
    && Object.values(audit.serverError ?? {}).every(state => state.status === 500 && state.selectorFound),
}

await writeFile(resolve(evidenceDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
await browser.close()

const failed = Object.entries(audit.checks).filter(([, value]) => value !== true)
console.log(`[V15] evidence complete; ${failed.length} checks failed`)
if (failed.length) console.log(failed.map(([name]) => `- ${name}`).join('\n'))
if (verify && failed.length) throw new Error('V15 evidence checks failed.')

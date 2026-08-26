import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const verify = process.argv.includes('--verify')
const baseURL = process.env.V16_BASE_URL ?? 'http://127.0.0.1:3000/'
const errorBaseURL = process.env.V16_ERROR_BASE_URL ?? baseURL
const evidenceDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V16',
)
const reviewDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/.design/screenshots/v16-final-consistency',
)
await Promise.all([
  mkdir(evidenceDirectory, { recursive: true }),
  mkdir(reviewDirectory, { recursive: true }),
])

const executablePath = process.env.V16_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) })

const viewports = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
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
  { name: 'not-found', path: '/__v16_not_found', selector: '[data-testid="public-error-page"]', status: 404 },
  { name: 'works-empty', path: '/works?page=9999', selector: '[data-testid="public-empty-state"]', status: 200 },
  { name: 'works-no-result', path: '/works?q=__v16_no_match__', selector: '[data-testid="public-empty-state"]', status: 200 },
  { name: 'adoptions-no-result', path: '/adoptions?q=__v16_no_match__', selector: '[data-testid="public-empty-state"]', status: 200 },
]

function href(path, origin = baseURL) {
  return new URL(path, origin).href
}

async function settle(page, selector) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 15_000 })
  await page.evaluate(async () => {
    for (const top of [document.body.scrollHeight, 0]) {
      scrollTo({ top, behavior: 'instant' })
      await new Promise(resolve => setTimeout(resolve, 120))
    }
    await document.fonts?.ready
    await Promise.all([...document.images].map(image => image.complete
      ? undefined
      : new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true })
          image.addEventListener('error', resolve, { once: true })
        })))
  })
  await page.waitForTimeout(180)
}

async function inspect(page, selector, errors) {
  return page.evaluate(({ selector, errors }) => {
    const missingImageAlts = [...document.images].filter(image => !image.hasAttribute('alt')).length
    const failedImages = [...document.images]
      .filter(image => image.complete && image.naturalWidth === 0)
      .map(image => image.currentSrc || image.src)
    return {
      selectorFound: Boolean(document.querySelector(selector)),
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
      h1Count: document.querySelectorAll('h1').length,
      mainPresent: Boolean(document.querySelector('main')),
      missingImageAlts,
      failedImages,
      footerCount: document.querySelectorAll('.public-footer').length,
      heroBrandCount: document.querySelectorAll('.home-hero__title').length,
      errors,
    }
  }, { selector, errors })
}

const audit = { generatedAt: new Date().toISOString(), baseURL, viewports: {}, specialStates: {}, checks: {} }

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  audit.viewports[viewport.name] = {}
  for (const route of routes) {
    const errors = []
    const onError = error => errors.push(error.message)
    const onConsole = message => {
      if (message.type() === 'error') errors.push(message.text())
    }
    page.on('pageerror', onError)
    page.on('console', onConsole)
    const response = await page.goto(href(route.path), { waitUntil: 'domcontentloaded' })
    await settle(page, route.selector)
    const state = await inspect(page, route.selector, errors)
    audit.viewports[viewport.name][route.name] = { status: response?.status() ?? null, ...state }
    await page.screenshot({
      path: resolve(reviewDirectory, `review-${route.name}-${viewport.name}.png`),
      fullPage: true,
    })
    page.off('pageerror', onError)
    page.off('console', onConsole)
  }
  await context.close()
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.route('http://127.0.0.1:3001/**', route => route.abort())
  await page.goto(href('/works'), { waitUntil: 'domcontentloaded' })
  await settle(page, '.works-page')
  const failures = await page.locator('.responsive-picture__fallback').count()
  audit.specialStates[`media-failure-${viewport.name}`] = { failures }
  await page.screenshot({
    path: resolve(reviewDirectory, `review-media-failure-${viewport.name}.png`),
    fullPage: true,
  })
  await context.close()
}

const errorFixture = await fetch(href('/__test__/page-error', errorBaseURL)).catch(() => null)
audit.specialStates.errorFixtureStatus = errorFixture?.status ?? null
if (errorFixture?.status === 500) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const response = await page.goto(href('/__test__/page-error', errorBaseURL), { waitUntil: 'domcontentloaded' })
    await settle(page, '[data-testid="public-error-page"]')
    audit.specialStates[`server-error-${viewport.name}`] = { status: response?.status() ?? null }
    await page.screenshot({
      path: resolve(reviewDirectory, `review-server-error-${viewport.name}.png`),
      fullPage: true,
    })
    await context.close()
  }
}

const contactContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const contactPage = await contactContext.newPage()
for (const viewport of viewports) {
  const cards = await Promise.all(routes.map(async route => (
    `<article><h2>${route.name}</h2><img alt="" src="data:image/png;base64,${(
      await readFile(resolve(reviewDirectory, `review-${route.name}-${viewport.name}.png`))
    ).toString('base64')}"></article>`
  )))
  await contactPage.setContent(`<style>
    * { box-sizing: border-box; }
    body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 0; padding: 20px; background: #ddd; font-family: Arial, sans-serif; }
    article { align-self: start; padding: 10px; border: 1px solid #aaa; background: #fff; }
    h2 { margin: 0 0 10px; font-size: 16px; }
    img { display: block; width: 100%; height: 430px; background: #f5f5f5; object-fit: contain; object-position: top center; }
  </style>${cards.join('')}`, { waitUntil: 'load' })
  await contactPage.screenshot({
    path: resolve(reviewDirectory, `contact-sheet-${viewport.name}.png`),
    fullPage: true,
  })
}
await contactContext.close()

const states = Object.entries(audit.viewports).flatMap(([viewport, routesByName]) => (
  Object.entries(routesByName).map(([name, state]) => ({ viewport, name, ...state }))
))
audit.checks = {
  expectedStatuses: states.every(state => state.status === routes.find(route => route.name === state.name)?.status),
  selectorsFound: states.every(state => state.selectorFound),
  noHorizontalOverflow: states.every(state => state.noHorizontalOverflow),
  semantics: states.every(state => state.mainPresent && state.h1Count <= 1 && state.missingImageAlts === 0),
  imagesDecoded: states.every(state => state.failedImages.length === 0),
  noRuntimeErrors: states.filter(state => state.status < 400).every(state => state.errors.length === 0),
  footerContinuity: states.filter(state => state.status < 400).every(state => state.footerCount === 1),
  heroBrandLock: viewports.every(viewport => audit.viewports[viewport.name].home.heroBrandCount === 1),
  mediaFailure: viewports.every(viewport => audit.specialStates[`media-failure-${viewport.name}`].failures > 0),
  serverError: audit.specialStates.errorFixtureStatus === 500
    && viewports.every(viewport => audit.specialStates[`server-error-${viewport.name}`]?.status === 500),
}

await writeFile(resolve(evidenceDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
await browser.close()

const failed = Object.entries(audit.checks).filter(([, value]) => value !== true)
console.log(`[V16] evidence complete; ${failed.length} checks failed`)
if (failed.length) console.log(failed.map(([name]) => `- ${name}`).join('\n'))
if (verify && failed.length) throw new Error('V16 evidence checks failed.')

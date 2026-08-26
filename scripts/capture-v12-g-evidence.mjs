import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const mode = process.argv.includes('--before') ? 'before' : 'after'
const verify = process.argv.includes('--verify')
const includeDesktop = process.argv.includes('--desktop')
const desktopOnly = process.argv.includes('--desktop-only')
const baseURL = process.env.V12_G_BASE_URL ?? 'http://127.0.0.1:3000/'
const errorBaseURL = process.env.V12_G_ERROR_BASE_URL ?? baseURL
const evidenceDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V12-G/${mode}`,
)
await mkdir(evidenceDirectory, { recursive: true })

const executablePath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})

const desktopViewport = { name: '1440x900', width: 1440, height: 900 }
const viewports = desktopOnly
  ? [desktopViewport]
  : [
      { name: '390x844', width: 390, height: 844 },
      { name: '430x932', width: 430, height: 932 },
      ...(includeDesktop ? [desktopViewport] : []),
    ]
const routes = [
  { name: 'works', path: '/works', selector: '.works-page', status: 200 },
  { name: 'adoptions', path: '/adoptions', selector: '.adoptions-page', status: 200 },
  { name: 'work-detail', path: '/works/brand-assets-b', selector: '[data-testid="work-detail"]', status: 200 },
  { name: 'adoption-detail', path: '/works/adoption-regular-3?from=adoptions', selector: '[data-testid="work-detail"]', status: 200 },
  { name: 'commission', path: '/commission', selector: '[data-testid="commission-page"]', status: 200 },
  { name: 'about', path: '/about', selector: '[data-testid="about-page"]', status: 200 },
  { name: 'commission-apply', path: '/commission/apply', selector: '[data-testid="commission-apply-page"]', status: 200 },
  { name: 'service', path: '/service', selector: 'main', status: 200 },
  { name: 'privacy', path: '/privacy', selector: 'main', status: 200 },
  { name: 'licenses', path: '/licenses', selector: 'main', status: 200 },
  { name: 'not-found', path: '/__v12-g-not-found', selector: '[data-testid="public-error-page"]', status: 404 },
  { name: 'server-error', path: '/__test__/page-error', selector: '[data-testid="public-error-page"]', status: 500, errorFixture: true },
  { name: 'works-empty', path: '/works?page=9999', selector: '[data-testid="public-empty-state"]', status: 200 },
  { name: 'works-no-result', path: '/works?q=__v12_g_no_match__', selector: '[data-testid="public-empty-state"]', status: 200 },
  { name: 'adoptions-no-result', path: '/adoptions?q=__v12_g_no_match__', selector: '[data-testid="public-empty-state"]', status: 200 },
]
const mediaFailureRoutes = [
  { name: 'works-media-failure', path: '/works', selector: '.works-page' },
  { name: 'adoptions-media-failure', path: '/adoptions', selector: '.adoptions-page' },
  { name: 'detail-media-failure', path: '/works/brand-assets-b', selector: '[data-testid="work-detail"]' },
  { name: 'commission-media-failure', path: '/commission', selector: '[data-testid="commission-page"]' },
]

const audit = {
  mode,
  capturedAt: new Date().toISOString(),
  routes: {},
  interactions: {},
  mediaFailures: {},
}

function href(path, fixture = false) {
  return new URL(path, fixture ? errorBaseURL : baseURL).href
}

async function settle(page, selector) {
  await page.locator(selector).first().waitFor()
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise(done => setTimeout(done, 3000))])
    await Promise.race([
      Promise.all([...document.images].map(image => (
        image.complete ? Promise.resolve() : image.decode().catch(() => undefined)
      ))),
      new Promise(done => setTimeout(done, 5000)),
    ])
    window.scrollTo(0, document.documentElement.scrollHeight)
    await new Promise(done => setTimeout(done, 150))
    window.scrollTo(0, 0)
  })
}

async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: resolve(evidenceDirectory, `${name}.png`),
    fullPage: true,
  })
}

async function inspect(page, selector) {
  return page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector)
    const interactive = [...document.querySelectorAll('main a, main button, main input, main summary')]
      .filter(element => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      })
    const controls = [...document.querySelectorAll([
      'main button',
      'main summary',
      'main input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([tabindex="-1"])',
      'main .public-action',
      'main .public-pagination a',
      'main .work-gallery__thumb',
    ].join(','))]
      .filter((element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      })
    const images = [...document.images].filter(image => getComputedStyle(image).display !== 'none')
    return {
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      targetText: target?.textContent?.replace(/\s+/gu, ' ').trim() ?? '',
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
      imageCount: images.length,
      imagesDecoded: images.every(image => image.complete && image.naturalWidth > 0),
      failedPictures: document.querySelectorAll('.responsive-picture--failed').length,
      footerPresent: Boolean(document.querySelector('[data-testid="public-footer"], footer')),
      minInteractiveHeight: interactive.length
        ? Math.min(...interactive.map(element => element.getBoundingClientRect().height))
        : null,
      minInteractiveWidth: interactive.length
        ? Math.min(...interactive.map(element => element.getBoundingClientRect().width))
        : null,
      minControlHeight: controls.length
        ? Math.min(...controls.map(element => element.getBoundingClientRect().height))
        : null,
      minControlWidth: controls.length
        ? Math.min(...controls.map(element => element.getBoundingClientRect().width))
        : null,
    }
  }, selector)
}

for (const route of routes) {
  audit.routes[route.name] = {}
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const response = await page.goto(href(route.path, route.errorFixture), { waitUntil: 'domcontentloaded' })
    await settle(page, route.selector)
    await screenshot(page, `${route.name}-${viewport.name}`)
    audit.routes[route.name][viewport.name] = {
      status: response?.status() ?? null,
      ...await inspect(page, route.selector),
    }
    await context.close()
    console.log(`[V12-G] ${mode} ${route.name} ${viewport.name}`)
  }
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(href('/commission/apply'), { waitUntil: 'domcontentloaded' })
  await settle(page, '[data-testid="commission-apply-page"]')
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: '确认提交' }).click()
  const validationSummary = page.locator('[data-testid="commission-apply-validation-summary"]')
  await validationSummary.waitFor({ timeout: 5000 }).catch(() => undefined)
  await screenshot(page, `commission-apply-validation-${viewport.name}`)
  audit.interactions[`commission-apply-validation-${viewport.name}`] = {
    visible: await validationSummary.isVisible(),
    focused: await validationSummary.isVisible()
      ? await validationSummary.evaluate(element => element === document.activeElement)
      : false,
    ...await inspect(page, '[data-testid="commission-apply-page"]'),
  }
  await context.close()

  const licensesContext = await browser.newContext({ viewport })
  const licensesPage = await licensesContext.newPage()
  await licensesPage.goto(href('/licenses'), { waitUntil: 'domcontentloaded' })
  await settle(licensesPage, 'main')
  const summary = licensesPage.locator('.license-full__summary').first()
  await summary.click()
  await screenshot(licensesPage, `licenses-details-open-${viewport.name}`)
  audit.interactions[`licenses-details-open-${viewport.name}`] = {
    opened: await summary.locator('..').getAttribute('open') !== null,
    ...await inspect(licensesPage, 'main'),
  }
  await licensesContext.close()
}

for (const route of mediaFailureRoutes) {
  audit.mediaFailures[route.name] = {}
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.route('**/*', (requestRoute) => {
      const request = requestRoute.request()
      const requestURL = new URL(request.url())
      if (request.resourceType() === 'image'
        && !requestURL.pathname.startsWith('/brand/')
        && !requestURL.pathname.startsWith('/filings/')) {
        return requestRoute.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' })
      }
      return requestRoute.continue()
    })
    await page.goto(href(route.path), { waitUntil: 'domcontentloaded' })
    await settle(page, route.selector)
    await page.locator('.responsive-picture--failed').first().waitFor()
    await screenshot(page, `${route.name}-${viewport.name}`)
    audit.mediaFailures[route.name][viewport.name] = await inspect(page, route.selector)
    await context.close()
    console.log(`[V12-G] ${mode} ${route.name} ${viewport.name}`)
  }
}

if (mode === 'after') {
  const routeStates = Object.values(audit.routes).flatMap(route => Object.values(route))
  const interactionStates = Object.values(audit.interactions)
  const failureStates = Object.values(audit.mediaFailures).flatMap(route => Object.values(route))
  audit.checks = {
    expectedStatuses: routes.every(route => Object.values(audit.routes[route.name])
      .every(state => state.status === route.status)),
    noHorizontalOverflow: [...routeStates, ...interactionStates, ...failureStates]
      .every(state => state.noHorizontalOverflow),
    regularImagesDecoded: routeStates
      .filter(state => state.imageCount > 0)
      .every(state => state.imagesDecoded),
    allFootersPresent: routes
      .filter(route => !['not-found', 'server-error'].includes(route.name))
      .every(route => Object.values(audit.routes[route.name]).every(state => state.footerPresent)),
    minimumTargets: [...routeStates, ...interactionStates]
      .filter(state => state.minControlHeight !== null)
      .every(state => state.minControlHeight >= 44 && state.minControlWidth >= 44),
    formValidation: viewports.every(viewport => (
      audit.interactions[`commission-apply-validation-${viewport.name}`].visible
      && audit.interactions[`commission-apply-validation-${viewport.name}`].focused
    )),
    legalDetails: viewports.every(viewport => (
      audit.interactions[`licenses-details-open-${viewport.name}`].opened
    )),
    mediaFailureRecovery: failureStates.every(state => state.failedPictures > 0),
  }
}

await writeFile(
  resolve(evidenceDirectory, desktopOnly ? 'desktop-audit.json' : 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
)
await browser.close()

if (verify && Object.values(audit.checks ?? {}).some(value => !value)) {
  throw new Error('V12-G evidence checks failed.')
}

console.log(`[V12-G] ${mode} evidence complete`)

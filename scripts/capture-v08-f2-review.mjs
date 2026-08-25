import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V08_F2_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V08-F2/after',
)
await mkdir(outputDirectory, { recursive: true })

const executablePath = [
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
  { name: '1024x900', width: 1024, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
]

const routes = [
  { name: 'home', path: '/', expectedStatus: 200 },
  { name: 'works', path: '/works', expectedStatus: 200 },
  { name: 'adoptions', path: '/adoptions', expectedStatus: 200 },
  { name: 'work-detail', path: '/works/brand-assets-b', expectedStatus: 200 },
  { name: 'commission', path: '/commission', expectedStatus: 200 },
  { name: 'commission-apply', path: '/commission/apply', expectedStatus: 200 },
  { name: 'about', path: '/about', expectedStatus: 200 },
  { name: 'service', path: '/service', expectedStatus: 200 },
  { name: 'privacy', path: '/privacy', expectedStatus: 200 },
  { name: 'licenses', path: '/licenses', expectedStatus: 200 },
  { name: 'not-found', path: '/__v08-f2-not-found', expectedStatus: 404 },
]

const redirects = [
  { name: 'contact', path: '/contact', location: '/about#contact' },
  { name: 'terms', path: '/terms', location: '/service' },
  { name: 'adoption-detail', path: '/adoptions/adoption-green-dog-test', location: '/works/adoption-green-dog-test' },
]

function href(path) {
  return new URL(path, baseURL).href
}

async function settle(page) {
  await page.locator('main').first().waitFor()
  const images = page.locator('img')
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index)
    await image.scrollIntoViewIfNeeded().catch(() => {})
    await image.evaluate((element) => {
      if (element.complete) return undefined
      return new Promise((done) => {
        element.addEventListener('load', done, { once: true })
        element.addEventListener('error', done, { once: true })
      })
    }).catch(() => {})
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
}

async function inspect(page) {
  const interactive = page.locator('main a[href], main button, main summary, main input:not([type="hidden"]), main textarea, main select').first()
  const hasInteractive = await interactive.count() > 0
  if (hasInteractive) await interactive.focus()

  return page.evaluate(() => {
    const images = [...document.images]
    const focus = document.activeElement
    const focusRect = focus instanceof HTMLElement ? focus.getBoundingClientRect() : null
    return {
      h1: [...document.querySelectorAll('main h1')].map(element => element.textContent?.trim() ?? ''),
      footerCount: document.querySelectorAll('footer').length,
      imageCount: images.length,
      decodedImages: images.filter(image => image.complete && image.naturalWidth > 0).length,
      unresolvedImages: images.filter(image => image.complete && image.naturalWidth === 0).length,
      fallbackCount: document.querySelectorAll('.responsive-picture__fallback').length,
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      documentHeight: document.documentElement.scrollHeight,
      focusVisible: focus instanceof HTMLElement && focus.matches(':focus-visible'),
      focusTarget: focusRect ? { width: focusRect.width, height: focusRect.height } : null,
    }
  })
}

const audit = {
  capturedAt: new Date().toISOString(),
  routes: {},
  reducedMotion: {},
  redirects: {},
  interactions: {},
}

for (const viewport of viewports) {
  for (const route of routes) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const response = await page.goto(href(route.path), { waitUntil: 'domcontentloaded' })
    await settle(page)
    await page.screenshot({
      path: resolve(outputDirectory, `${route.name}-${viewport.name}.png`),
      fullPage: true,
    })
    audit.routes[`${route.name}-${viewport.name}`] = {
      expectedStatus: route.expectedStatus,
      responseStatus: response?.status() ?? null,
      ...await inspect(page),
    }
    await context.close()
  }
}

for (const route of routes) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(href(route.path), { waitUntil: 'domcontentloaded' })
  await page.locator('main').first().waitFor()
  await page.waitForTimeout(250)
  audit.reducedMotion[route.name] = await page.evaluate(() => ({
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    runningAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length,
  }))
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  for (const redirect of redirects) {
    const response = await context.request.get(href(redirect.path), { maxRedirects: 0 })
    audit.redirects[redirect.name] = {
      status: response.status(),
      location: response.headers().location,
      expectedLocation: redirect.location,
    }
  }
  await context.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  await page.goto(href('/'), { waitUntil: 'domcontentloaded' })
  await settle(page)
  const featuredLink = page.locator('[data-testid="featured-works"] a[href="/works"]').first()
  await featuredLink.scrollIntoViewIfNeeded()
  await featuredLink.tap()
  await page.waitForURL(url => new URL(url).pathname === '/works')
  audit.interactions.touchHomeToWorks = new URL(page.url()).pathname

  await page.goto(href('/works'), { waitUntil: 'domcontentloaded' })
  await settle(page)
  const detailLink = page.locator('a[href^="/works/"]').first()
  await detailLink.tap()
  await page.waitForURL(url => new URL(url).pathname.startsWith('/works/'))
  audit.interactions.touchWorksToDetail = new URL(page.url()).pathname
  await context.close()
}

const routeEntries = Object.entries(audit.routes)
audit.checks = {
  completeCoverage: routeEntries.length === routes.length * viewports.length,
  expectedStatuses: routeEntries.every(([, route]) => route.responseStatus === route.expectedStatus),
  headingsPresent: routeEntries.every(([, route]) => route.h1.length > 0),
  noHorizontalOverflow: routeEntries.every(([, route]) => route.noHorizontalOverflow),
  noUnresolvedImages: routeEntries.every(([, route]) => route.unresolvedImages === 0),
  regularPagesHaveOneFooter: routeEntries
    .filter(([key]) => !key.startsWith('not-found-'))
    .every(([, route]) => route.footerCount === 1),
  keyboardFocus: routeEntries.every(([, route]) => route.focusTarget === null || route.focusVisible),
  reducedMotion: Object.values(audit.reducedMotion).every(result => (
    result.matches && result.runningAnimations === 0
  )),
  redirects: Object.values(audit.redirects).every(result => (
    result.status === 301 && result.location === result.expectedLocation
  )),
  touch: audit.interactions.touchHomeToWorks === '/works'
    && audit.interactions.touchWorksToDetail.startsWith('/works/'),
}

await writeFile(resolve(outputDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
await browser.close()

if (Object.values(audit.checks).some(value => !value)) process.exitCode = 1

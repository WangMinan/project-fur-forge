import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const mode = process.argv.includes('--before') ? 'before' : 'after'
const verify = process.argv.includes('--verify')
const baseURL = process.env.V12_D_BASE_URL ?? 'http://127.0.0.1:3000/'
const evidenceDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V12-D/${mode}`,
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

const routes = [
  { name: 'service', path: '/service' },
  { name: 'privacy', path: '/privacy' },
  { name: 'licenses', path: '/licenses' },
]
const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '1440x900', width: 1440, height: 900 },
]

const audit = {
  mode,
  capturedAt: new Date().toISOString(),
  routes: {},
  interactions: {},
}

async function openRoute(page, path) {
  const response = await page.goto(new URL(path, baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.locator('h1').waitFor()
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images]
      .filter(image => !image.complete)
      .map(image => new Promise(resolveImage => image.addEventListener('load', resolveImage, { once: true }))))
  })
  return response
}

for (const route of routes) {
  audit.routes[route.name] = {}
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const response = await openRoute(page, route.path)
    await page.screenshot({
      path: resolve(evidenceDirectory, `${route.name}-${viewport.name}.png`),
      fullPage: true,
    })

    const state = await page.evaluate(() => {
      const content = document.querySelector('.legal-document__body, .licenses')
      const navLinks = [...document.querySelectorAll('.legal-document__contents-link, .licenses-nav__link')]
      return {
        noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        imagesDecoded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
        contentText: content?.textContent?.replace(/\s+/gu, ' ').trim() ?? '',
        contentWidth: content?.getBoundingClientRect().width ?? 0,
        navLinkCount: navLinks.length,
        minNavTargetHeight: navLinks.length
          ? Math.min(...navLinks.map(link => link.getBoundingClientRect().height))
          : null,
        footerVisible: Boolean(document.querySelector('footer')),
      }
    })
    audit.routes[route.name][viewport.name] = {
      ...state,
      status: response?.status() ?? null,
      contentHash: createHash('sha256').update(state.contentText).digest('hex'),
      contentText: undefined,
    }
    await context.close()
  }
}

if (mode === 'after') {
  const anchorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const anchorPage = await anchorContext.newPage()
  await openRoute(anchorPage, '/service')
  await anchorPage.locator('.legal-document__contents-link').first().click()
  audit.interactions.anchor = await anchorPage.locator('#section-1').evaluate((target) => {
    const rect = target.getBoundingClientRect()
    return { hash: location.hash, top: rect.top, viewportHeight: innerHeight }
  })
  await anchorContext.close()

  for (const viewport of [viewports[0], viewports[2]]) {
    const detailsContext = await browser.newContext({ viewport })
    const detailsPage = await detailsContext.newPage()
    await openRoute(detailsPage, '/licenses')
    const summary = detailsPage.locator('.license-full__summary').first()
    await summary.focus()
    await summary.press('Enter')
    const details = summary.locator('..')
    const opened = await details.getAttribute('open') !== null
    audit.interactions[`details-${viewport.name}`] = {
      opened,
      targetHeight: await summary.evaluate(element => element.getBoundingClientRect().height),
    }
    await detailsPage.evaluate(() => window.scrollTo(0, 0))
    await detailsPage.screenshot({
      path: resolve(evidenceDirectory, `licenses-details-open-${viewport.name}.png`),
      fullPage: true,
    })
    await detailsContext.close()
  }

  const routeStates = Object.values(audit.routes).flatMap(route => Object.values(route))
  audit.checks = {
    allRoutes200: routeStates.every(route => route.status === 200),
    allImagesDecoded: routeStates.every(route => route.imagesDecoded),
    noHorizontalOverflow: routeStates.every(route => route.noHorizontalOverflow),
    allFootersPresent: routeStates.every(route => route.footerVisible),
    readableLineLength: routeStates.every(route => route.contentWidth <= 768),
    mobileNavTargets: Object.values(audit.routes).every(route => (
      route['390x844'].minNavTargetHeight === null
      || route['390x844'].minNavTargetHeight >= 44
    )),
    anchorSafe: audit.interactions.anchor.hash === '#section-1'
      && audit.interactions.anchor.top >= 0
      && audit.interactions.anchor.top < audit.interactions.anchor.viewportHeight,
    detailsKeyboard: Object.entries(audit.interactions)
      .filter(([key]) => key.startsWith('details-'))
      .every(([, state]) => state.opened && state.targetHeight >= 44),
  }
}

await writeFile(resolve(evidenceDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
await browser.close()

if (verify && Object.values(audit.checks ?? {}).some(value => !value)) {
  throw new Error('V12-D evidence checks failed.')
}

console.log(`[V12-D] ${mode} evidence complete`)

import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const mode = process.argv[2] === 'before' ? 'before' : 'after'
const baseURL = process.env.V07_F2_BASE_URL ?? 'http://127.0.0.1:3000/'
const evidenceDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V07-F2/${mode}`,
)
const reviewDirectory = resolve('agent_docs/需求4-站点视觉升级与内容合规/.design/screenshots')
await mkdir(evidenceDirectory, { recursive: true })
await mkdir(reviewDirectory, { recursive: true })

const executablePath = process.env.V07_F2_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})

const pages = ['service', 'privacy', 'licenses']
const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
]

async function capture(route, viewport, directory = evidenceDirectory, filename = `${route}-${viewport.name}`) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const response = await page.goto(new URL(`/${route}`, baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.locator('main h1').waitFor()
  await page.screenshot({ path: resolve(directory, `${filename}.png`), fullPage: true })
  const result = await page.evaluate(() => ({
    responseStatus: performance.getEntriesByType('navigation')[0]?.responseStatus ?? null,
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    headingOrder: [...document.querySelectorAll('main h1, main h2')].map(element => ({
      id: element.id,
      level: element.tagName,
      text: element.textContent?.trim(),
    })),
  }))
  await context.close()
  return { navigationStatus: response?.status() ?? null, ...result }
}

const audit = { mode, capturedAt: new Date().toISOString(), routes: {}, interactions: {} }
for (const viewport of viewports) {
  for (const route of pages) {
    audit.routes[`${route}-${viewport.name}`] = await capture(route, viewport)
  }
}

if (mode === 'after') {
  const reviewViewports = [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1280', width: 1280, height: 800 },
  ]
  for (const viewport of reviewViewports) {
    for (const route of pages) {
      audit.routes[`review-${route}-${viewport.name}`] = await capture(
        route,
        viewport,
        reviewDirectory,
        `review-${route}-${viewport.name}`,
      )
    }
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(new URL('/licenses', baseURL).href, { waitUntil: 'domcontentloaded' })
  const summaries = page.locator('main summary')
  await summaries.first().focus()
  audit.interactions.licenses = {
    focusVisible: await summaries.first().evaluate(element => element.matches(':focus-visible')),
    summaryTargets: await summaries.evaluateAll(elements => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { height: rect.height, width: rect.width }
    })),
    downloadHref: await page.getByRole('link', { name: '下载完整 TXT 声明' }).getAttribute('href'),
  }
  await summaries.first().click()
  await page.screenshot({ path: resolve(evidenceDirectory, 'licenses-details-open-390x844.png'), fullPage: true })
  audit.interactions.licenses.detailsOpen = await page.locator('main details').first().evaluate(element => element.open)
  audit.interactions.licenses.noOverflowWhenOpen = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )
  await context.close()

  const anchorContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const anchorPage = await anchorContext.newPage()
  await anchorPage.goto(new URL('/service#section-2', baseURL).href, { waitUntil: 'domcontentloaded' })
  audit.interactions.anchor = await anchorPage.locator('#section-2').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { exists: true, top: rect.top, headerOffset: 72 }
  }).catch(() => ({ exists: false, top: null, headerOffset: 72 }))
  await anchorContext.close()

  const termsContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const termsPage = await termsContext.newPage()
  const termsResponse = await termsPage.goto(new URL('/terms', baseURL).href, { waitUntil: 'domcontentloaded' })
  const redirectedFrom = termsResponse?.request().redirectedFrom()
  audit.interactions.terms = {
    destination: new URL(termsPage.url()).pathname,
    redirectStatus: (await redirectedFrom?.response())?.status() ?? null,
  }
  await termsContext.close()

  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const reducedPage = await reducedContext.newPage()
  await reducedPage.goto(new URL('/privacy', baseURL).href, { waitUntil: 'domcontentloaded' })
  audit.interactions.reducedMotion = await reducedPage.evaluate(() => ({
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    runningAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length,
  }))
  await reducedContext.close()

  const legalRoutes = Object.entries(audit.routes).filter(([key]) => /^(service|privacy)-\d/u.test(key))
  const targetRoutes = Object.entries(audit.routes).filter(([key]) => /^(service|privacy|licenses)-\d/u.test(key))
  audit.checks = {
    allRoutes200: targetRoutes.every(([, route]) => route.navigationStatus === 200),
    noHorizontalOverflow: targetRoutes.every(([, route]) => route.noHorizontalOverflow),
    semanticLegalHeadings: legalRoutes.every(([, route]) => route.headingOrder[0]?.level === 'H1'
      && route.headingOrder.filter(heading => heading.level === 'H2').length > 0
      && route.headingOrder.filter(heading => heading.level === 'H2').every(heading => heading.id)),
    keyboardFocus: audit.interactions.licenses.focusVisible,
    summaryTargets44: audit.interactions.licenses.summaryTargets.every(target => target.height >= 44),
    detailsOpen: audit.interactions.licenses.detailsOpen,
    detailsNoOverflow: audit.interactions.licenses.noOverflowWhenOpen,
    downloadLink: audit.interactions.licenses.downloadHref === '/THIRD_PARTY_NOTICES.txt',
    anchorOffset: audit.interactions.anchor.exists
      && audit.interactions.anchor.top >= audit.interactions.anchor.headerOffset,
    termsRedirect: audit.interactions.terms.destination === '/service'
      && audit.interactions.terms.redirectStatus === 301,
    reducedMotion: audit.interactions.reducedMotion.matches
      && audit.interactions.reducedMotion.runningAnimations === 0,
  }
}

await writeFile(resolve(evidenceDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
await browser.close()

if (mode === 'after' && Object.values(audit.checks).some(value => !value)) {
  process.exitCode = 1
}

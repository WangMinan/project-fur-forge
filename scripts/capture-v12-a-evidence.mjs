import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V12_A_BASE_URL ?? 'http://127.0.0.1:3000/'
const variant = process.env.V12_A_VARIANT ?? 'after'
const verify = process.env.V12_A_VERIFY === '1'
const evidenceDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V12-A/${variant}`,
)
await mkdir(evidenceDirectory, { recursive: true })

const executablePath = process.env.V12_A_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})

const allViewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
]
const viewports = process.env.V12_A_VIEWPORT
  ? allViewports.filter(viewport => viewport.name === process.env.V12_A_VIEWPORT)
  : allViewports

const worksResponse = await fetch(new URL('/api/public/v1/works', baseURL))
const worksPayload = await worksResponse.json()
const works = worksPayload?.data?.items ?? []
const detailWork = works.find(item => item.work.slug === 'return-xiapian') ?? works[0]
if (!detailWork)
  throw new Error('V12-A evidence requires at least one public work.')

const adoptionResponse = await fetch(new URL('/api/public/v1/adoptions', baseURL))
const adoptionPayload = await adoptionResponse.json()
const adoption = adoptionPayload?.data?.items?.find(
  item => item.work.adoptionStatus === 'available',
) ?? adoptionPayload?.data?.items?.[0]
if (!adoption)
  throw new Error('V12-A evidence requires at least one public adoption.')

async function waitForVisuals(page, root) {
  await page.evaluate(() => document.fonts.ready)
  await root.locator('img').evaluateAll(async images => Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await Promise.race([
        new Promise(resolveLoad => {
          image.addEventListener('load', resolveLoad, { once: true })
          image.addEventListener('error', resolveLoad, { once: true })
        }),
        new Promise(resolveTimeout => setTimeout(resolveTimeout, 2500)),
      ])
    }
    if (image.naturalWidth > 0)
      await image.decode()
  })))
}

async function capture(viewport, name, pathname, rootSelector) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  const response = await page.goto(new URL(pathname, baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  const root = page.locator(rootSelector)
  await root.waitFor()
  await waitForVisuals(page, root)
  await page.screenshot({
    animations: 'disabled',
    path: resolve(evidenceDirectory, `${name}-${viewport.name}.png`),
  })
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: resolve(evidenceDirectory, `${name}-${viewport.name}-full.png`),
  })

  const result = await root.evaluate((element, currentViewport) => ({
    viewport: currentViewport,
    noHorizontalOverflow:
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    runningAnimations:
      element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
    gridColumns: element.querySelector('.works-grid')
      ? getComputedStyle(element.querySelector('.works-grid')).gridTemplateColumns
        .split(' ').filter(Boolean).length
      : null,
    desktopDetailSideBySide: currentViewport.width < 1024 || (() => {
      const media = element.querySelector('.work-detail__media')?.getBoundingClientRect()
      const copy = element.querySelector('.work-detail__header')?.getBoundingClientRect()
      return Boolean(media && copy && media.right <= copy.left)
    })(),
    footer: (() => {
      const footer = document.querySelector('[data-testid="public-footer"]')?.getBoundingClientRect()
      return footer
        ? { bottom: footer.bottom, top: footer.top }
        : null
    })(),
    images: [...element.querySelectorAll('img')].map(image => ({
      complete: image.complete,
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
      objectFit: getComputedStyle(image).objectFit,
    })),
  }), viewport)
  result.responseStatus = response?.status() ?? null
  await context.close()
  return result
}

const audit = { variant, works: {}, workDetail: {}, adoptionDetail: {} }
for (const viewport of viewports) {
  audit.works[viewport.name] = await capture(
    viewport,
    'works',
    '/works',
    '.works-page',
  )
  audit.workDetail[viewport.name] = await capture(
    viewport,
    'work-detail',
    detailWork.href,
    '[data-testid="work-detail"]',
  )
  const adoptionURL = new URL(adoption.href, baseURL)
  adoptionURL.searchParams.set('from', 'adoptions')
  audit.adoptionDetail[viewport.name] = await capture(
    viewport,
    'adoption-detail',
    adoptionURL.href,
    '[data-testid="work-detail"]',
  )
}

const results = [
  ...Object.values(audit.works),
  ...Object.values(audit.workDetail),
  ...Object.values(audit.adoptionDetail),
]
audit.checks = {
  allRoutes200: results.every(result => result.responseStatus === 200),
  allImagesDecoded: results.every(result => (
    result.images.length > 0
    && result.images.every(image => image.complete && image.naturalWidth > 0)
  )),
  noHorizontalOverflow: results.every(result => result.noHorizontalOverflow),
  staticUnderReducedMotion: results.every(result => result.runningAnimations === 0),
  worksDesktopFourColumns: audit.works['1440x900']?.gridColumns === 4,
  desktopDetailSideBySide: Object.values(audit.workDetail)
    .filter(result => result.viewport.width >= 1024)
    .every(result => result.desktopDetailSideBySide)
    && Object.values(audit.adoptionDetail)
      .filter(result => result.viewport.width >= 1024)
      .every(result => result.desktopDetailSideBySide),
  desktopDetailFooterPinned: [
    audit.workDetail['1440x900'],
    audit.adoptionDetail['1440x900'],
  ].every(result => (
    result?.footer
    && result.footer.top < result.viewport.height
    && Math.abs(result.footer.bottom - result.viewport.height) <= 1
  )),
}

await writeFile(
  resolve(evidenceDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
)
await browser.close()

if (verify && Object.values(audit.checks).some(value => !value))
  throw new Error('V12-A evidence checks failed.')

console.log(`[V12-A] ${variant} evidence complete`)

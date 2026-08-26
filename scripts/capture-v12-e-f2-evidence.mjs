import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V12_E_F2_BASE_URL ?? 'http://127.0.0.1:3000/'
const verify = process.argv.includes('--verify')
const output = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V12-E-F2/after',
)
await mkdir(output, { recursive: true })

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
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
]

const adoptionResponse = await fetch(new URL('/api/public/v1/adoptions', baseURL))
const adoptionPayload = await adoptionResponse.json()
const adoptions = adoptionPayload?.data?.items ?? []
const detailPath = adoptions[0]?.href
if (!detailPath)
  throw new Error('V12-E-F2 evidence requires one available adoption.')

const audit = {
  capturedAt: new Date().toISOString(),
  adoptionProjection: {
    resultCount: adoptionPayload.data.resultCount,
    statuses: adoptions.map(item => item.work.adoptionStatus),
  },
  viewports: {},
  mediaFailure: {},
}

function absolute(path) {
  return new URL(path, baseURL).href
}

async function settle(page, selector) {
  const root = page.locator(selector)
  await root.waitFor()
  await page.evaluate(() => document.fonts.ready)
  await root.locator('img').evaluateAll(async images => Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await Promise.race([
        new Promise(resolveLoad => {
          image.addEventListener('load', resolveLoad, { once: true })
          image.addEventListener('error', resolveLoad, { once: true })
        }),
        new Promise(resolveTimeout => setTimeout(resolveTimeout, 2000)),
      ])
    }
    if (image.naturalWidth > 0)
      await image.decode()
  })))
  return root
}

async function open(context, path, selector) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  const response = await page.goto(absolute(path), { waitUntil: 'domcontentloaded' })
  const root = await settle(page, selector)
  return { errors, page, response, root }
}

async function shot(locator, name) {
  await locator.scrollIntoViewIfNeeded()
  await locator.page().waitForTimeout(100)
  await locator.screenshot({
    animations: 'disabled',
    path: resolve(output, `${name}.png`),
  })
}

function pageMetrics(page) {
  return page.evaluate(() => ({
    noHorizontalOverflow:
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  }))
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const results = { errors: [] }

  const home = await open(context, '/', '.home-adoptions')
  await home.root.scrollIntoViewIfNeeded()
  await shot(home.root, `home-adoption-${viewport.name}`)
  results.home = {
    text: (await home.root.innerText()).replace(/\s+/gu, ' ').trim(),
    ...await pageMetrics(home.page),
  }
  results.errors.push(...home.errors)
  await home.page.close()

  const works = await open(context, '/works', '.works-page')
  await shot(works.page.locator('.works-page__intro'), `works-intro-${viewport.name}`)
  await shot(works.page.locator('.pagination'), `works-pagination-${viewport.name}`)
  results.works = await works.page.evaluate(() => {
    const mark = document.querySelector('.works-page__mark')
    const step = document.querySelector('.pagination__step')
    const current = document.querySelector('.pagination__page--current')
    const markStyle = mark ? getComputedStyle(mark) : null
    const stepStyle = step ? getComputedStyle(step) : null
    const currentStyle = current ? getComputedStyle(current) : null
    return {
      markOpacity: markStyle?.opacity ?? null,
      markVisible: Boolean(mark && mark.getBoundingClientRect().width > 0),
      pagination: {
        currentBorderBottom: currentStyle?.borderBottomWidth ?? null,
        stepBackground: stepStyle?.backgroundColor ?? null,
        stepHeight: step?.getBoundingClientRect().height ?? null,
      },
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }
  })
  results.errors.push(...works.errors)
  await works.page.close()

  const adoptionList = await open(context, '/adoptions', '.adoptions-page')
  await shot(adoptionList.page.locator('.adoptions-page__grid'), `adoptions-grid-${viewport.name}`)
  await shot(adoptionList.page.locator('.pagination'), `adoptions-pagination-${viewport.name}`)
  results.adoptions = {
    text: (await adoptionList.root.innerText()).replace(/\s+/gu, ' ').trim(),
    ...await pageMetrics(adoptionList.page),
  }
  results.errors.push(...adoptionList.errors)
  await adoptionList.page.close()

  const commission = await open(context, '/commission', '#commission-details')
  await shot(commission.root, `commission-details-${viewport.name}`)
  results.commission = await commission.root.evaluate((element) => {
    const sections = [...element.querySelectorAll('.commission-page__section')]
    const widths = sections.map(section => section.getBoundingClientRect().width)
    return {
      kickerCount: element.querySelectorAll('.commission-page__section-kicker').length,
      ratio: widths.length === 2 ? widths[0] / (widths[0] + widths[1]) : null,
    }
  })
  results.errors.push(...commission.errors)
  await commission.page.close()

  const detail = await open(context, detailPath, '.work-detail')
  await shot(detail.root, `adoption-detail-${viewport.name}`)
  results.detail = {
    text: (await detail.root.innerText()).replace(/\s+/gu, ' ').trim(),
    ...await pageMetrics(detail.page),
  }
  results.errors.push(...detail.errors)
  await detail.page.close()

  audit.viewports[viewport.name] = results
  await context.close()
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  await context.route('**/*', (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (request.resourceType() === 'image'
      && !pathname.startsWith('/brand/')
      && !pathname.startsWith('/filings/')) {
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' })
    }
    return route.continue()
  })

  const hero = await open(context, '/', '.home-hero')
  await hero.page.locator('.home-hero .responsive-picture--failed').waitFor()
  await hero.page.screenshot({
    animations: 'disabled',
    path: resolve(output, `media-failure-hero-${viewport.name}.png`),
  })
  const heroCenter = await hero.page.evaluate(() => {
    const frame = document.querySelector('.home-hero .responsive-picture--failed')?.getBoundingClientRect()
    const message = document.querySelector('.home-hero .responsive-picture__fallback-message')?.getBoundingClientRect()
    return frame && message
      ? {
          x: message.x + message.width / 2 - (frame.x + frame.width / 2),
          y: message.y + message.height / 2 - (frame.y + frame.height / 2),
        }
      : null
  })
  await hero.page.close()

  const works = await open(context, '/works', '.works-page')
  await works.page.locator('.works-grid .responsive-picture--failed').first().waitFor()
  await shot(works.page.locator('.works-grid').first(), `media-failure-works-${viewport.name}`)
  const fallbackBounds = await works.page.locator('.works-grid .responsive-picture__fallback-message')
    .evaluateAll(messages => messages.map((message) => {
      const messageRect = message.getBoundingClientRect()
      const frameRect = message.closest('.responsive-picture')?.getBoundingClientRect()
      return frameRect
        ? {
            contained: messageRect.left >= frameRect.left
              && messageRect.right <= frameRect.right
              && messageRect.top >= frameRect.top
              && messageRect.bottom <= frameRect.bottom,
            x: messageRect.x + messageRect.width / 2 - (frameRect.x + frameRect.width / 2),
            y: messageRect.y + messageRect.height / 2 - (frameRect.y + frameRect.height / 2),
          }
        : null
    }))
  await works.page.close()

  const detail = await open(context, detailPath, '.work-detail')
  await detail.page.locator('.work-gallery .responsive-picture--failed').first().waitFor()
  await shot(detail.page.locator('.work-gallery'), `media-failure-detail-${viewport.name}`)
  const detailOverflow = await detail.page.locator('.work-gallery .responsive-picture__fallback-message')
    .evaluateAll(messages => messages.every((message) => {
      const messageRect = message.getBoundingClientRect()
      const frameRect = message.closest('.responsive-picture')?.getBoundingClientRect()
      return Boolean(frameRect
        && messageRect.left >= frameRect.left
        && messageRect.right <= frameRect.right
        && messageRect.top >= frameRect.top
        && messageRect.bottom <= frameRect.bottom)
    }))
  await detail.page.close()

  audit.mediaFailure[viewport.name] = {
    detailFallbacksContained: detailOverflow,
    heroCenterDelta: heroCenter,
    worksFallbacks: fallbackBounds,
  }
  await context.close()
}

await browser.close()

const viewportResults = Object.values(audit.viewports)
const failureResults = Object.values(audit.mediaFailure)
audit.checks = {
  availableOnly: audit.adoptionProjection.statuses.every(status => status === 'available'),
  noStatusCopy: viewportResults.every(result => (
    !result.home.text.includes('角色状态')
    && !result.adoptions.text.includes('可领养')
    && !result.detail.text.includes('领养状态')
  )),
  noHorizontalOverflow: viewportResults.every(result => (
    result.home.noHorizontalOverflow
    && result.works.noHorizontalOverflow
    && result.adoptions.noHorizontalOverflow
    && result.detail.noHorizontalOverflow
  )),
  worksWatermark: viewportResults.every(result => result.works.markVisible),
  commission: viewportResults.every((result, index) => (
    result.commission.kickerCount === 0
    && (index > 0 || (result.commission.ratio >= 0.28 && result.commission.ratio <= 0.32))
  )),
  pagination: viewportResults.every(result => (
    result.works.pagination.stepHeight >= 44
    && result.works.pagination.currentBorderBottom !== '0px'
  )),
  mediaCentered: failureResults.every(result => (
    result.heroCenterDelta
    && Math.abs(result.heroCenterDelta.x) < 1
    && Math.abs(result.heroCenterDelta.y) < 1
    && result.worksFallbacks.every(item => item?.contained
      && Math.abs(item.x) < 1
      && Math.abs(item.y) < 1)
    && result.detailFallbacksContained
  )),
  noRuntimeErrors: viewportResults.every(result => result.errors.length === 0),
}

await writeFile(
  resolve(output, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)
console.log(JSON.stringify(audit.checks, null, 2))
if (verify && !Object.values(audit.checks).every(Boolean))
  process.exitCode = 1

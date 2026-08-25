import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V10_BASE_URL ?? 'http://127.0.0.1:3000/'
const evidenceDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V10/after',
)
const reviewDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/.design/screenshots/v10/after',
)
await mkdir(evidenceDirectory, { recursive: true })
await mkdir(reviewDirectory, { recursive: true })

const executablePath = process.env.V10_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})

const formalViewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
]
const reviewViewports = [
  { name: '2048x1080', width: 2048, height: 1080 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '375x812', width: 375, height: 812 },
]

async function waitForFontsAndImages(page, root) {
  await page.evaluate(() => document.fonts.ready)
  const images = root.locator('img')
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index)
    await image.scrollIntoViewIfNeeded()
    await image.evaluate(async (element) => {
      if (!element.complete) {
        await new Promise(resolveLoad => {
          element.addEventListener('load', resolveLoad, { once: true })
          element.addEventListener('error', resolveLoad, { once: true })
        })
      }
      if (element.complete && element.naturalWidth > 0)
        await element.decode()
    })
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
}

async function scrollHomeSceneIntoView(page) {
  await page.getByTestId('home-business-entries').evaluate((element) => {
    if (!(element instanceof HTMLElement)) return
    const styles = getComputedStyle(document.documentElement)
    const offsetToken = innerWidth >= 1024
      ? '--public-header-height'
      : '--public-anchor-offset'
    const rawOffset = styles.getPropertyValue(offsetToken).trim()
    const offset = rawOffset.endsWith('rem')
      ? Number.parseFloat(rawOffset) * Number.parseFloat(styles.fontSize)
      : Number.parseFloat(rawOffset)
    document.documentElement.style.setProperty('scroll-snap-type', 'none', 'important')
    const absoluteTop = element.getBoundingClientRect().top + window.scrollY
    const scrollingElement = document.scrollingElement
    if (scrollingElement)
      scrollingElement.scrollTop = absoluteTop - (Number.isFinite(offset) ? offset : 0)
  })
  await page.waitForTimeout(100)
}

async function inspectHome(page, viewport) {
  const root = page.getByTestId('home-business-entries')
  return root.evaluate((element, currentViewport) => {
    const rect = selector => element.querySelector(selector)?.getBoundingClientRect().toJSON() ?? null
    const section = element.getBoundingClientRect()
    const media = element.querySelector('.home-commission__media')
    const mediaRect = media?.getBoundingClientRect()
    const bodyRect = element.querySelector('.home-commission__body')?.getBoundingClientRect()
    const wayfinding = element.querySelector('.home-commission__wayfinding')
    const wayfindingRect = wayfinding?.getBoundingClientRect()
    const mediaStyle = media ? getComputedStyle(media) : null
    const images = [...element.querySelectorAll('img')]
    return {
      viewport: currentViewport,
      section: section.toJSON(),
      heading: rect('.home-commission__heading'),
      media: mediaRect?.toJSON() ?? null,
      body: bodyRect?.toJSON() ?? null,
      wayfinding: wayfindingRect?.toJSON() ?? null,
      destination: wayfinding
        ? [...wayfinding.children]
            .filter(child => !child.classList.contains('home-commission__wayfinding-rule'))
            .map(child => child.textContent?.trim())
            .filter(Boolean)
            .join(' / ')
        : null,
      mediaBorderRadius: mediaStyle?.borderRadius ?? null,
      mediaBodyGap: mediaRect && bodyRect ? bodyRect.top - mediaRect.bottom : null,
      mediaBeforeBody: Boolean(mediaRect && bodyRect && (
        currentViewport.width < 768
          ? mediaRect.bottom <= bodyRect.top
          : mediaRect.left < bodyRect.left
      )),
      decodedImages: images.map(image => ({
        complete: image.complete,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
      })),
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      sceneFitsViewport: section.top >= -1 && section.bottom <= currentViewport.height + 1,
      wayfindingInViewport: Boolean(
        wayfindingRect && wayfindingRect.top >= 0 && wayfindingRect.bottom <= currentViewport.height,
      ),
      applicationHref:
        element.querySelector('a[href="/commission/apply"]')?.getAttribute('href') ?? null,
      detailHref:
        element.querySelector('a[href^="/commission?view="]')?.getAttribute('href') ?? null,
      runningAnimations:
        element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
    }
  }, viewport)
}

async function inspectCommission(page, viewport) {
  const root = page.getByTestId('commission-page')
  return root.evaluate((element, currentViewport) => {
    const lead = element.querySelector('.commission-lead')
    const media = element.querySelector('.commission-lead__media')
    const mediaRect = media?.getBoundingClientRect()
    const contentRect = element.querySelector('.commission-lead__content')?.getBoundingClientRect()
    const mediaStyle = media ? getComputedStyle(media) : null
    const images = [...element.querySelectorAll('img')]
    const qrImages = [...element.querySelectorAll('.contact-channel-grid__qr')]
    return {
      viewport: currentViewport,
      h1Count: element.querySelectorAll('h1').length,
      leadWithoutMedia: lead?.classList.contains('commission-lead--without-media') ?? false,
      media: mediaRect?.toJSON() ?? null,
      mediaBorderRadius: mediaStyle?.borderRadius ?? null,
      mediaBeforeContent: Boolean(mediaRect && contentRect && mediaRect.bottom <= contentRect.top),
      currentHeroRatio: media?.querySelector('img')
        ? media.querySelector('img').naturalWidth / media.querySelector('img').naturalHeight
        : null,
      scopeRows: element.querySelectorAll('.commission-page__scope-row').length,
      statusVisible: Boolean(element.querySelector('.commission-lead__status')),
      applicationHref:
        element.querySelector('a[href="/commission/apply"]')?.getAttribute('href') ?? null,
      contactHref:
        element.querySelector('a[href="/about#contact"]')?.getAttribute('href') ?? null,
      termsHref:
        [...element.querySelectorAll('a')].find(link => link.textContent?.trim() === '服务条款')?.getAttribute('href') ?? null,
      wayfindingHref:
        element.querySelector('.commission-page__wayfinding')?.getAttribute('href') ?? null,
      decodedImages: images.map(image => ({
        complete: image.complete,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
      })),
      qrSizes: qrImages.map((image) => {
        const rect = image.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }),
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      runningAnimations:
        element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
    }
  }, viewport)
}

async function captureHome(viewport, directory, prefix = 'home-commission') {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  const root = page.getByTestId('home-business-entries')
  await root.waitFor()
  await waitForFontsAndImages(page, root)
  await page.waitForTimeout(700)
  await scrollHomeSceneIntoView(page)
  await page.waitForTimeout(250)
  const result = {
    responseStatus: response?.status() ?? null,
    ...await inspectHome(page, viewport),
  }
  await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path: resolve(directory, `${prefix}-${viewport.name}.png`),
  })
  await context.close()
  return result
}

async function captureCommission(viewport, directory, prefix = 'commission') {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  const response = await page.goto(new URL('/commission', baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  const root = page.getByTestId('commission-page')
  await root.waitFor()
  await waitForFontsAndImages(page, root)
  await page.waitForTimeout(250)
  const result = {
    responseStatus: response?.status() ?? null,
    ...await inspectCommission(page, viewport),
  }
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: resolve(directory, `${prefix}-${viewport.name}.png`),
  })
  await context.close()
  return result
}

const audit = {
  capturedAt: new Date().toISOString(),
  home: {},
  commission: {},
  review: { home: {}, commission: {} },
  fallbackContract: {},
  sharedMedia: {},
}

for (const viewport of formalViewports) {
  audit.home[viewport.name] = await captureHome(viewport, evidenceDirectory)
  audit.commission[viewport.name] = await captureCommission(viewport, evidenceDirectory)
}

for (const viewport of reviewViewports) {
  audit.review.home[viewport.name] = await captureHome(viewport, reviewDirectory, 'review-home-commission')
  audit.review.commission[viewport.name] = await captureCommission(viewport, reviewDirectory, 'review-commission')
}

const commissionLeadSource = await readFile(resolve('app/components/CommissionLead.vue'), 'utf8')
const commissionPageSource = await readFile(resolve('app/pages/commission/index.vue'), 'utf8')
audit.fallbackContract = {
  emptyPlacementReachesLead: /<CommissionLead\s+[\s\S]*?v-if="hero"/u.test(commissionPageSource),
  noMediaClass: /'commission-lead--without-media': !sources/u.test(commissionLeadSource),
  mediaConditional: /v-if="sources"\s+class="commission-lead__media"/u.test(commissionLeadSource),
  contentOutsideMediaCondition: /<\/div>\s*\n\s*<div class="commission-lead__content">/u.test(commissionLeadSource),
}

{
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  const link = page.getByRole('link', { name: '了解自设委托', exact: true })
  await link.waitFor()
  await link.click()
  await page.waitForURL(url => url.pathname === '/commission')
  await page.locator('.commission-lead__media').waitFor()
  audit.sharedMedia = {
    query: new URL(page.url()).search,
    transitionName: await page.locator('.commission-lead__media').evaluate(
      element => element.style.viewTransitionName,
    ),
  }
  await context.close()
}

const allHome = [...Object.values(audit.home), ...Object.values(audit.review.home)]
const allCommission = [
  ...Object.values(audit.commission),
  ...Object.values(audit.review.commission),
]
audit.checks = {
  allRoutes200: [...allHome, ...allCommission]
    .every(result => result.responseStatus === 200),
  allImagesDecoded: [...allHome, ...allCommission].every(result => (
    result.decodedImages.length > 0
    && result.decodedImages.every(image => image.complete && image.naturalWidth > 0)
  )),
  noHorizontalOverflow: [...allHome, ...allCommission]
    .every(result => result.noHorizontalOverflow),
  sharedImageRadius: [...allHome, ...allCommission].every(result => (
    Number.parseFloat(result.mediaBorderRadius) === 12
  )),
  homeScene: allHome.every(result => (
    result.mediaBeforeBody
    && result.mediaBodyGap >= (result.viewport.width < 768 ? 12 : 16)
    && result.destination === '下一幕 / 设定领养'
    && result.applicationHref === '/commission/apply'
    && result.detailHref === '/commission?view=home-commission'
    && result.runningAnimations === 0
    && result.sceneFitsViewport
    && result.wayfindingInViewport
  )),
  commissionScene: allCommission.every(result => (
    result.h1Count === 1
    && result.mediaBeforeContent
    && result.scopeRows === 2
    && result.statusVisible
    && result.applicationHref === '/commission/apply'
    && result.contactHref === '/about#contact'
    && result.termsHref === '/service'
    && result.wayfindingHref === '/commission/apply'
    && result.runningAnimations === 0
  )),
  responsiveCommissionMedia:
    audit.commission['1440x900'].currentHeroRatio > 1
    && audit.commission['390x844'].currentHeroRatio < 1
    && audit.commission['430x932'].currentHeroRatio < 1,
  qrReadable: allCommission.every(result => result.qrSizes.every(size => size.width >= 128)),
  fallbackContract: Object.values(audit.fallbackContract).every(Boolean),
  sharedMedia:
    audit.sharedMedia.query === '?view=home-commission'
    && audit.sharedMedia.transitionName === 'home-commission-media',
}

await writeFile(
  resolve(evidenceDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
)
await browser.close()

if (Object.values(audit.checks).some(value => !value))
  throw new Error('V10 evidence checks failed.')

console.log('[V10] static evidence complete')

import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V10_F1_BASE_URL ?? 'http://127.0.0.1:3000/'
const evidenceDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V10-F1/after',
)
await mkdir(evidenceDirectory, { recursive: true })

const executablePath = process.env.V10_F1_BROWSER_PATH ?? [
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
const reviewViewports = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '375x812', width: 375, height: 812 },
]

async function waitForVisuals(page, root) {
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

async function scrollHomeSceneIntoView(page, testId = 'home-business-entries') {
  const root = page.getByTestId(testId)
  const offset = await root.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    const token = innerWidth >= 1024
      ? '--public-header-height'
      : '--public-anchor-offset'
    const rawOffset = styles.getPropertyValue(token).trim()
    const resolvedOffset = rawOffset.endsWith('rem')
      ? Number.parseFloat(rawOffset) * Number.parseFloat(styles.fontSize)
      : Number.parseFloat(rawOffset)
    return Number.isFinite(resolvedOffset) ? resolvedOffset : 0
  })

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const top = await root.evaluate(element => element.getBoundingClientRect().top)
    const distance = top - offset
    if (Math.abs(distance) <= 1) break
    const viewportHeight = await page.evaluate(() => window.innerHeight)
    await page.mouse.wheel(0, Math.sign(distance) * Math.min(Math.abs(distance), viewportHeight))
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(250)
}

async function inspectImages(root) {
  return root.locator('img').evaluateAll(images => images.map(image => ({
    complete: image.complete,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
  })))
}

async function captureHome(viewport, prefix = 'home-commission') {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  const root = page.getByTestId('home-business-entries')
  await root.waitFor()
  await waitForVisuals(page, root)
  await page.waitForTimeout(700)
  await scrollHomeSceneIntoView(page)
  const result = await root.evaluate((element, currentViewport) => {
    const section = element.getBoundingClientRect()
    const media = element.querySelector('.home-commission__media')
    const narrative = element.querySelector('.home-commission__narrative')
    const mediaRect = media?.getBoundingClientRect()
    const narrativeRect = narrative?.getBoundingClientRect()
    const wayfinding = element.querySelector('.home-commission__wayfinding')
    const wayfindingRect = wayfinding?.getBoundingClientRect()
    const mediaStyle = media ? getComputedStyle(media) : null
    const heading = element.querySelector('.home-commission__heading')
    const totalPrimaryWidth = (mediaRect?.width ?? 0) + (narrativeRect?.width ?? 0)
    return {
      viewport: currentViewport,
      scrollY: window.scrollY,
      scrollState: {
        bodyHeight: document.body.scrollHeight,
        bodyOverflow: getComputedStyle(document.body).overflowY,
        htmlHeight: document.documentElement.scrollHeight,
        htmlOverflow: getComputedStyle(document.documentElement).overflowY,
        scrollingElement: document.scrollingElement?.tagName ?? null,
      },
      section: section.toJSON(),
      media: mediaRect?.toJSON() ?? null,
      narrative: narrativeRect?.toJSON() ?? null,
      mediaShare: totalPrimaryWidth > 0 ? (mediaRect?.width ?? 0) / totalPrimaryWidth : null,
      headingWidth: heading?.getBoundingClientRect().width ?? null,
      registerPresent: Boolean(element.querySelector('.home-commission__register')),
      promise: element.querySelector('.home-commission__promise')?.textContent?.replace(/\s+/gu, '') ?? null,
      wayfindingLanguage: {
        hero: document.querySelector('.home-hero__continuation')?.textContent
          ?.replace(/\s+/gu, '') ?? null,
        featured: document.querySelector('.featured-works__wayfinding')?.textContent
          ?.replace(/\s+/gu, '') ?? null,
        commission: wayfinding?.textContent?.replace(/\s+/gu, '') ?? null,
      },
      destination: wayfinding
        ? [...wayfinding.children]
            .filter(child => !child.classList.contains('home-commission__wayfinding-rule'))
            .map(child => child.textContent?.trim())
            .filter(Boolean)
            .join(' / ')
        : null,
      mediaBorderRadius: mediaStyle?.borderRadius ?? null,
      layoutOrder: currentViewport.width >= 768
        ? Boolean(mediaRect && narrativeRect && mediaRect.right < narrativeRect.right)
        : Boolean(mediaRect && narrativeRect && mediaRect.bottom <= narrativeRect.top),
      sceneFitsViewport: section.top >= -1 && section.bottom <= currentViewport.height + 1,
      wayfindingInViewport: Boolean(
        wayfindingRect && wayfindingRect.top >= 0 && wayfindingRect.bottom <= currentViewport.height,
      ),
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      runningAnimations:
        element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
    }
  }, viewport)
  result.responseStatus = response?.status() ?? null
  result.decodedImages = await inspectImages(root)
  await page.screenshot({
    animations: 'disabled',
    path: resolve(evidenceDirectory, `${prefix}-${viewport.name}.png`),
  })
  await context.close()
  return result
}

async function captureFeatured(viewport, prefix = 'featured-heading') {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  const root = page.getByTestId('featured-works')
  await root.waitFor()
  await waitForVisuals(page, root)
  await page.waitForTimeout(700)
  await scrollHomeSceneIntoView(page, 'featured-works')
  const result = await root.evaluate((element, currentViewport) => {
    const heading = element.querySelector('.featured-works__heading')
    const media = element.querySelector('.featured-works__media')
    const wayfinding = element.querySelector('.featured-works__wayfinding')
    return {
      viewport: currentViewport,
      headingWidth: heading?.getBoundingClientRect().width ?? null,
      registerPresent: Boolean(element.querySelector('.featured-works__register')),
      mediaBorderRadius: media ? getComputedStyle(media).borderRadius : null,
      destination: wayfinding?.textContent?.replace(/\s+/gu, '') ?? null,
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      runningAnimations:
        element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
    }
  }, viewport)
  result.responseStatus = response?.status() ?? null
  result.decodedImages = await inspectImages(root)
  await page.screenshot({
    animations: 'disabled',
    path: resolve(evidenceDirectory, `${prefix}-${viewport.name}.png`),
  })
  await context.close()
  return result
}

async function captureCommission(viewport, prefix = 'commission') {
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
  await waitForVisuals(page, root)
  const result = await root.evaluate((element, currentViewport) => {
    const media = element.querySelector('.commission-lead__media')
    const content = element.querySelector('.commission-lead__content')
    const mediaRect = media?.getBoundingClientRect()
    const contentRect = content?.getBoundingClientRect()
    const continuation = element.querySelector('.commission-lead__continuation')
    const continuationRect = continuation?.getBoundingClientRect()
    const masthead = element.querySelector('.commission-lead__masthead')
    const mediaStyle = media ? getComputedStyle(media) : null
    return {
      viewport: currentViewport,
      media: mediaRect?.toJSON() ?? null,
      content: contentRect?.toJSON() ?? null,
      h1Count: element.querySelectorAll('h1').length,
      promise: element.querySelector('.commission-lead__promise')?.textContent?.trim() ?? null,
      continuationHref: continuation?.getAttribute('href') ?? null,
      continuationLabel: continuation?.textContent?.replace(/\s+/gu, ' ').trim() ?? null,
      continuationInFirstViewport: Boolean(
        continuationRect
        && continuationRect.top >= 0
        && continuationRect.bottom <= currentViewport.height,
      ),
      mastheadWidth: masthead?.getBoundingClientRect().width ?? null,
      mastheadChildCount: masthead?.childElementCount ?? null,
      mediaBorderRadius: mediaStyle?.borderRadius ?? null,
      layoutOrder: currentViewport.width >= 1024
        ? Boolean(contentRect && mediaRect && contentRect.right < mediaRect.right)
        : Boolean(contentRect && mediaRect && mediaRect.bottom <= contentRect.top),
      applicationHref:
        element.querySelector('a[href="/commission/apply"]')?.getAttribute('href') ?? null,
      applicationWayfinding: element.querySelector('.commission-page__wayfinding')?.textContent
        ?.replace(/\s+/gu, '') ?? null,
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      runningAnimations:
        element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
    }
  }, viewport)
  result.responseStatus = response?.status() ?? null
  result.decodedImages = await inspectImages(root)
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: resolve(evidenceDirectory, `${prefix}-${viewport.name}.png`),
  })
  if (viewport.name === '1440x900') {
    await page.locator('.commission-lead__continuation').click()
    await page.waitForTimeout(250)
    result.continuationTarget = await page.locator('#commission-details').evaluate(element => ({
      hash: window.location.hash,
      top: element.getBoundingClientRect().top,
    }))
  }
  await context.close()
  return result
}

const audit = {
  capturedAt: new Date().toISOString(),
  home: {},
  featured: {},
  commission: {},
  review: { home: {}, commission: {} },
}

for (const viewport of viewports) {
  audit.home[viewport.name] = await captureHome(viewport)
  audit.featured[viewport.name] = await captureFeatured(viewport)
  audit.commission[viewport.name] = await captureCommission(viewport)
}
for (const viewport of reviewViewports) {
  audit.review.home[viewport.name] = await captureHome(viewport, 'review-home-commission')
  audit.review.commission[viewport.name] = await captureCommission(viewport, 'review-commission')
}

const allHome = [...Object.values(audit.home), ...Object.values(audit.review.home)]
const allCommission = [
  ...Object.values(audit.commission),
  ...Object.values(audit.review.commission),
]
const allFeatured = Object.values(audit.featured)
const allResults = [...allHome, ...allFeatured, ...allCommission]
audit.checks = {
  allRoutes200: allResults.every(result => result.responseStatus === 200),
  allImagesDecoded: allResults.every(result => (
    result.decodedImages.length > 0
    && result.decodedImages.every(image => image.complete && image.naturalWidth > 0)
  )),
  noHorizontalOverflow: allResults.every(result => result.noHorizontalOverflow),
  sharedImageRadius: allResults.every(result => Number.parseFloat(result.mediaBorderRadius) === 12),
  homeNarrative: allHome.every(result => (
    result.promise === '从角色设定出发'
    && result.destination === '下一幕 / 设定领养'
    && result.wayfindingLanguage.hero === '下一幕代表作品'
    && result.wayfindingLanguage.featured === '下一幕自设委托'
    && result.wayfindingLanguage.commission === '下一幕设定领养'
    && result.layoutOrder
    && result.runningAnimations === 0
    && result.sceneFitsViewport
    && result.wayfindingInViewport
  )),
  desktopHomeBalance: [audit.home['1440x900'], audit.review.home['1280x800']]
    .every(result => result.mediaShare >= 0.6 && result.mediaShare <= 0.67),
  compactHeadings: [
    ...allHome.map(result => result.headingWidth),
    ...allFeatured.map(result => result.headingWidth),
    ...allCommission.map(result => result.mastheadWidth),
  ].every(width => width > 0 && width <= 513),
  noRightRegisters: allHome.every(result => !result.registerPresent)
    && allFeatured.every(result => !result.registerPresent)
    && allCommission.every(result => result.mastheadChildCount === 1),
  featuredHeading: allFeatured.every(result => (
    result.destination === '下一幕自设委托'
    && result.runningAnimations === 0
  )),
  commissionLead: allCommission.every(result => (
    result.h1Count === 1
    && result.promise === '从角色设定出发'
    && result.layoutOrder
    && result.applicationHref === '/commission/apply'
    && result.applicationWayfinding === '开始申请填写委托表单→'
    && result.continuationHref === '#commission-details'
    && result.continuationLabel?.replace(/\s+/gu, '') === '继续查看制作范围与估价↓'
    && result.runningAnimations === 0
  )),
  desktopContinuationVisible: audit.commission['1440x900'].continuationInFirstViewport,
  desktopContinuationTarget:
    audit.commission['1440x900'].continuationTarget?.hash === '#commission-details'
    && audit.commission['1440x900'].continuationTarget?.top >= 72
    && audit.commission['1440x900'].continuationTarget?.top <= 200,
}

await writeFile(
  resolve(evidenceDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
)
await browser.close()

if (Object.values(audit.checks).some(value => !value))
  throw new Error('V10-F1 static evidence checks failed.')

console.log('[V10-F1] static evidence complete')

import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const baseURL = process.env.V03_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V03',
)
await mkdir(outputDirectory, { recursive: true })

const executablePath = process.env.V03_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})
const audit = { capturedAt: new Date().toISOString(), viewports: {}, navigation: {}, reducedMotion: {} }

async function waitForImages(page, selector) {
  await page.waitForFunction((targetSelector) => {
    const images = [...document.querySelectorAll(`${targetSelector} img`)]
    return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0)
  }, selector)
}

async function captureFeatured(name, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  const section = page.locator('[data-testid="featured-works"]')
  await section.waitFor({ state: 'visible' })
  await section.scrollIntoViewIfNeeded()
  await waitForImages(page, '[data-testid="featured-works"]')
  await section.screenshot({ path: resolve(outputDirectory, `${name}.png`) })
  audit.viewports[name] = await section.evaluate(element => {
    const images = [...element.querySelectorAll('img')]
    const display = element.querySelector('.featured-works__display')
    const actions = element.querySelectorAll('.featured-works__content .public-action')
    return {
      imageCount: images.length,
      allImagesDecoded: images.every(image => image.complete && image.naturalWidth > 0),
      imageAspectRatios: images.map(image => `${image.naturalWidth}:${image.naturalHeight}`),
      displayTransform: display ? getComputedStyle(display).transform : null,
      displayAnimation: display ? getComputedStyle(display).animationName : null,
      actionCount: actions.length,
      hasControls: Boolean(element.querySelector('[data-v00-action], .v00-featured-controls')),
      hasIdentityText: /犬科|猫科|鸟类|幻想兽/.test(element.textContent ?? ''),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    }
  })
  await context.close()
}

for (const viewport of [
  { width: 1440, height: 900, label: 'featured-desktop-1440x900' },
  { width: 390, height: 844, label: 'featured-mobile-390x844' },
  { width: 430, height: 932, label: 'featured-mobile-430x932' },
]) {
  await captureFeatured(viewport.label, viewport)
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="public-home"]')
  await page.waitForTimeout(600)
  await page.mouse.wheel(0, 720)
  await page.waitForTimeout(760)
  await page.screenshot({ path: resolve(outputDirectory, 'homepage-featured-desktop-1440x900.png') })
  const afterFeatured = await page.evaluate(() => ({
    featuredTop: document.querySelector('[data-testid="featured-works"]')?.getBoundingClientRect().top ?? null,
    commissionTop: document.querySelector('[data-testid="home-business-entries"]')?.getBoundingClientRect().top ?? null,
    activeSection: [...document.querySelectorAll('[data-home-scroll-scene]')]
      .find(element => Math.abs(element.getBoundingClientRect().top - 72) < 4)?.getAttribute('data-testid') ?? null,
  }))
  await page.mouse.wheel(0, 720)
  await page.waitForTimeout(760)
  await page.screenshot({ path: resolve(outputDirectory, 'homepage-commission-desktop-1440x900.png') })
  const afterCommission = await page.evaluate(() => ({
    featuredTop: document.querySelector('[data-testid="featured-works"]')?.getBoundingClientRect().top ?? null,
    commissionTop: document.querySelector('[data-testid="home-business-entries"]')?.getBoundingClientRect().top ?? null,
    activeSection: [...document.querySelectorAll('[data-home-scroll-scene]')]
      .find(element => Math.abs(element.getBoundingClientRect().top - 72) < 4)?.getAttribute('data-testid') ?? null,
  }))
  await page.mouse.wheel(0, -720)
  await page.waitForTimeout(760)
  audit.navigation.wheel = {
    afterFirstWheel: afterFeatured,
    afterSecondWheel: afterCommission,
    afterReverseWheel: await page.evaluate(() => ({
      featuredTop: document.querySelector('[data-testid="featured-works"]')?.getBoundingClientRect().top ?? null,
      commissionTop: document.querySelector('[data-testid="home-business-entries"]')?.getBoundingClientRect().top ?? null,
      activeSection: [...document.querySelectorAll('[data-home-scroll-scene]')]
        .find(element => Math.abs(element.getBoundingClientRect().top - 72) < 4)?.getAttribute('data-testid') ?? null,
    })),
  }
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  const firstMedia = page.locator('[data-testid="featured-works"] .featured-work__media').first()
  await firstMedia.click()
  audit.navigation.directRoute = {
    pathname: new URL(page.url()).pathname,
    query: new URL(page.url()).search,
  }
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  const firstMedia = page.locator('[data-testid="featured-works"] .featured-work__media').first()
  await firstMedia.focus()
  await firstMedia.press('Enter')
  audit.navigation.keyboardRoute = {
    pathname: new URL(page.url()).pathname,
    query: new URL(page.url()).search,
  }
  await context.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  const section = page.locator('[data-testid="featured-works"]')
  await section.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  audit.reducedMotion = await section.evaluate((element) => {
    const media = [...element.querySelectorAll('[data-motion-layer="media"]')]
    const display = element.querySelector('.featured-works__display')
    return {
      mediaTransforms: media.map(item => getComputedStyle(item).transform),
      displayTransform: display ? getComputedStyle(display).transform : null,
    }
  })
  await context.close()
}

audit.checks = {
  targetViewports: Object.keys(audit.viewports).length === 3,
  twoOrFewerImages: Object.values(audit.viewports).every(view => view.imageCount <= 2),
  allImagesDecoded: Object.values(audit.viewports).every(view => view.allImagesDecoded),
  staticBackgroundType: Object.values(audit.viewports).every(view => (
    view.displayTransform === 'none' && view.displayAnimation === 'none'
  )),
  singleDirectoryAction: Object.values(audit.viewports).every(view => view.actionCount === 1),
  noPrototypeControls: Object.values(audit.viewports).every(view => !view.hasControls),
  noIdentityCopy: Object.values(audit.viewports).every(view => !view.hasIdentityText),
  noHorizontalOverflow: Object.values(audit.viewports).every(view => view.scrollWidth <= view.clientWidth + 1),
  directRoute: audit.navigation.directRoute?.pathname.startsWith('/works/') === true,
  stagedWheel: audit.navigation.wheel?.afterSecondWheel?.activeSection === 'home-business-entries',
  reverseWheel: audit.navigation.wheel?.afterReverseWheel?.activeSection === 'featured-works',
  keyboardRoute: audit.navigation.keyboardRoute?.pathname.startsWith('/works/') === true,
  reducedMotionStatic: audit.reducedMotion?.displayTransform === 'none'
    && audit.reducedMotion?.mediaTransforms?.every(transform => transform === 'none'),
}

await writeFile(
  resolve(outputDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)
await browser.close()
if (Object.values(audit.checks).some(value => value !== true)) {
  process.exitCode = 1
}

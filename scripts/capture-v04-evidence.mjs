import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const baseURL = process.env.V04_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V04',
)
await mkdir(outputDirectory, { recursive: true })

const executablePath = process.env.V04_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})
const audit = { capturedAt: new Date().toISOString(), viewports: {}, inputs: {}, reducedMotion: {} }
const sections = [
  ['hero', '[data-testid="public-hero"]'],
  ['featured', '[data-testid="featured-works"]'],
  ['commission', '[data-testid="home-business-entries"]'],
  ['adoption', '[data-testid="home-current-adoptions"]'],
]

async function waitForImages(page, selector) {
  await page.waitForFunction((targetSelector) => {
    const images = [...document.querySelectorAll(`${targetSelector} img`)]
    return images.length === 0 || images.every(image => image.complete && image.naturalWidth > 0)
  }, selector)
}

async function inspectViewport(viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__))
  const result = {}

  for (const [name, selector] of sections) {
    const section = page.locator(selector)
    await section.scrollIntoViewIfNeeded()
    await waitForImages(page, selector)
    if (name === 'hero') {
      await section.locator('button').first().focus()
    }
    await page.waitForTimeout(760)
    await section.screenshot({
      path: resolve(outputDirectory, `${name}-${viewport.width}x${viewport.height}.png`),
    })
    result[name] = await section.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      imagesDecoded: [...element.querySelectorAll('img')]
        .every(image => image.complete && image.naturalWidth > 0),
      firstFocusableTarget: (() => {
        const target = element.querySelector('a, button')
        if (!target) return null
        const rect = target.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      })(),
      text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    }))
  }

  result.page = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    sceneCount: document.querySelectorAll('[data-home-scroll-scene]').length,
  }))
  audit.viewports[`${viewport.width}x${viewport.height}`] = result
  await context.close()
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1023, height: 900 },
  { width: 1024, height: 900 },
]) {
  await inspectViewport(viewport)
}

for (const width of [1023, 1024]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__))
  await page.waitForTimeout(200)
  await page.mouse.wheel(0, 800)
  await page.waitForTimeout(760)
  audit.inputs[`wheel-${width}`] = {
    defaultPrevented: width >= 1024,
    scrollY: await page.evaluate(() => Math.round(scrollY)),
    featuredTop: await page.locator('[data-testid="featured-works"]')
      .evaluate(element => Math.round(element.getBoundingClientRect().top)),
  }
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const page = await context.newPage()
  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  const action = page.locator('[data-testid="featured-works"] .public-action')
  await action.scrollIntoViewIfNeeded()
  await action.tap()
  await page.waitForURL(url => url.pathname === '/works')
  audit.inputs.touchRoute = new URL(page.url()).pathname
  await context.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  await page.waitForTimeout(300)
  audit.reducedMotion = await page.evaluate(() => ({
    heroReducedMotion: document.querySelector('[data-testid="public-hero"]')?.getAttribute('data-reduced-motion'),
    featuredBackgroundTransform: getComputedStyle(document.querySelector('.featured-works__display')).transform,
    featuredMediaTransform: getComputedStyle(document.querySelector('.featured-work__media')).transform,
  }))
  await context.close()
}

audit.checks = {
  allTargetViewports: Object.keys(audit.viewports).length === 5,
  allScenesPresent: Object.values(audit.viewports).every(view => view.page.sceneCount === 4),
  allImagesDecoded: Object.values(audit.viewports).every(view => (
    view.hero.imagesDecoded
    && view.featured.imagesDecoded
    && view.commission.imagesDecoded
    && view.adoption.imagesDecoded
  )),
  noHorizontalOverflow: Object.values(audit.viewports)
    .every(view => view.page.scrollWidth <= view.page.clientWidth + 1),
  heroTargetsAtLeast44: Object.values(audit.viewports).every(view => (
    view.hero.firstFocusableTarget?.width >= 44
    && view.hero.firstFocusableTarget?.height >= 44
  )),
  nativeWheelAt1023: audit.inputs['wheel-1023']?.defaultPrevented === false
    && audit.inputs['wheel-1023']?.scrollY > 0
    && audit.inputs['wheel-1023']?.featuredTop !== 72,
  stagedWheelAt1024: audit.inputs['wheel-1024']?.defaultPrevented === true
    && audit.inputs['wheel-1024']?.scrollY > 0
    && audit.inputs['wheel-1024']?.featuredTop === 72,
  touchAction: audit.inputs.touchRoute === '/works',
  reducedMotionStatic: audit.reducedMotion.heroReducedMotion === 'true'
    && audit.reducedMotion.featuredBackgroundTransform === 'none'
    && audit.reducedMotion.featuredMediaTransform === 'none',
}

await writeFile(
  resolve(outputDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)
await browser.close()
if (Object.values(audit.checks).some(value => value !== true)) process.exitCode = 1

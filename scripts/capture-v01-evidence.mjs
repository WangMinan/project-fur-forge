import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V01_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V01',
)
const videoDirectory = resolve(outputDirectory, '.video-source')

await mkdir(videoDirectory, { recursive: true })

const browserPath = process.env.V01_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(browserPath ? { executablePath: browserPath } : {}),
  headless: true,
})
const audit = {
  capturedAt: new Date().toISOString(),
  baseURL,
  checks: {},
  viewports: {},
}

async function openPage({ reducedMotion = 'no-preference', video = false, viewport }) {
  const context = await browser.newContext({
    viewport,
    reducedMotion,
    hasTouch: viewport.width < 768,
    recordVideo: video ? { dir: videoDirectory, size: viewport } : undefined,
  })
  const page = await context.newPage()
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForTimeout(350)
  await page.locator('[data-testid="public-hero"] img').waitFor({ state: 'visible' })
  return { context, page }
}

async function saveVideo(page, context, name) {
  const video = page.video()
  await page.close()
  await context.close()
  if (video) {
    await video.saveAs(resolve(outputDirectory, `${name}.webm`))
  }
}

async function screenshot(viewport, name) {
  const { context, page } = await openPage({ viewport })
  await page.waitForTimeout(950)
  await page.screenshot({ path: resolve(outputDirectory, `${name}.png`) })
  audit.viewports[name] = await page.evaluate(() => {
    const hero = document.querySelector('[data-testid="public-hero"]')
    const title = document.querySelector('.home-hero__title')
    const image = document.querySelector('.home-hero img')
    const titleRect = title?.getBoundingClientRect()
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heroHeight: hero?.getBoundingClientRect().height ?? 0,
      imageDecoded: Boolean(image?.complete && image.naturalWidth > 0),
      title: titleRect
        ? {
            height: titleRect.height,
            width: titleRect.width,
            x: titleRect.x,
            y: titleRect.y,
          }
        : null,
    }
  })
  await context.close()
}

async function record(name, action, options = {}) {
  const { context, page } = await openPage({
    reducedMotion: options.reducedMotion,
    video: true,
    viewport: options.viewport ?? { width: 1440, height: 900 },
  })
  await page.waitForTimeout(options.before ?? 120)
  await action(page)
  await page.waitForTimeout(options.after ?? 850)
  await saveVideo(page, context, name)
}

await screenshot({ width: 1440, height: 900 }, 'hero-desktop-1440x900')
await screenshot({ width: 390, height: 844 }, 'hero-mobile-390x844')
await screenshot({ width: 430, height: 932 }, 'hero-mobile-430x932')

await record('hero-arrival', async () => {}, { after: 1_100 })
await record('hero-next', async (page) => {
  await page.getByRole('button', { name: '下一张' }).click({ force: true })
})
await record('hero-previous', async (page) => {
  await page.getByRole('button', { name: '上一张' }).click({ force: true })
})
await record('hero-interrupt', async (page) => {
  await page.getByRole('button', { name: '下一张' }).click({ force: true })
  await page.waitForTimeout(90)
  await page.getByRole('button', { name: '上一张' }).click({ force: true })
})
await record('hero-reduced', async (page) => {
  await page.getByRole('button', { name: '下一张' }).click({ force: true })
}, { reducedMotion: 'reduce', after: 450 })

{
  const { context, page } = await openPage({ viewport: { width: 1440, height: 900 } })
  await page.waitForTimeout(950)
  const title = page.locator('.home-hero__title')
  const before = await title.boundingBox()
  const firstCurrent = await page.locator('.home-hero__dot[aria-current="true"]')
    .getAttribute('aria-label')
  await page.locator('.home-hero__dot').first().focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(520)
  const after = await title.boundingBox()
  const secondCurrent = await page.locator('.home-hero__dot[aria-current="true"]')
    .getAttribute('aria-label')
  audit.checks.keyboard = firstCurrent !== secondCurrent
  audit.checks.titleTerminalGeometryStable = Boolean(before && after
    && Math.abs(before.x - after.x) < 0.5
    && Math.abs(before.y - after.y) < 0.5
    && Math.abs(before.width - after.width) < 0.5
    && Math.abs(before.height - after.height) < 0.5)
  await context.close()
}

{
  const { context, page } = await openPage({ viewport: { width: 390, height: 844 } })
  const hero = page.locator('[data-testid="public-hero"]')
  const firstCurrent = await page.locator('.home-hero__dot[aria-current="true"]')
    .getAttribute('aria-label')
  await hero.dispatchEvent('pointerdown', {
    clientX: 310,
    clientY: 320,
    pointerId: 1,
    pointerType: 'touch',
  })
  await hero.dispatchEvent('pointerup', {
    clientX: 220,
    clientY: 320,
    pointerId: 1,
    pointerType: 'touch',
  })
  await page.waitForTimeout(520)
  const secondCurrent = await page.locator('.home-hero__dot[aria-current="true"]')
    .getAttribute('aria-label')
  audit.checks.touchSwipe = firstCurrent !== secondCurrent
  audit.checks.touchTargets = await page.locator('.home-hero__controls button')
    .evaluateAll(buttons => buttons.every((button) => {
      const rect = button.getBoundingClientRect()
      return rect.width >= 44 && rect.height >= 44
    }))
  await context.close()
}

{
  const { context, page } = await openPage({
    reducedMotion: 'reduce',
    viewport: { width: 430, height: 932 },
  })
  const initial = await page.locator('.home-hero__dot[aria-current="true"]')
    .getAttribute('aria-label')
  await page.waitForTimeout(10_250)
  const terminal = await page.locator('.home-hero__dot[aria-current="true"]')
    .getAttribute('aria-label')
  audit.checks.reducedMotionStopsAutoplay = initial === terminal
  audit.checks.reducedMotionTerminalState = await page.evaluate(() => {
    const title = document.querySelector('.home-hero__title')
    const image = document.querySelector('.home-hero img')
    return getComputedStyle(title).animationName === 'none'
      && getComputedStyle(image).animationName === 'none'
      && document.querySelector('[data-testid="public-hero"]')
        ?.getAttribute('data-reduced-motion') === 'true'
  })
  await context.close()
}

{
  const response = await fetch(baseURL)
  const html = await response.text()
  audit.checks.ssrDefaultVisible = response.ok
    && html.includes('有点小狗工作室')
    && html.includes('responsive-picture__image')
}

audit.checks.noHorizontalOverflow = Object.values(audit.viewports)
  .every(viewport => viewport.scrollWidth <= viewport.clientWidth + 1)
audit.checks.allImagesDecoded = Object.values(audit.viewports)
  .every(viewport => viewport.imageDecoded)

await writeFile(
  resolve(outputDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)

await rm(videoDirectory, { force: true, recursive: true })
await browser.close()

if (Object.values(audit.checks).some(value => value !== true)) {
  process.exitCode = 1
}

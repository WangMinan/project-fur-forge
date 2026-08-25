import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const baseURL = process.env.V05_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V05',
)
await mkdir(outputDirectory, { recursive: true })
const executablePath = process.env.V05_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})
const audit = { capturedAt: new Date().toISOString(), viewports: {}, mediaRules: {} }

async function revealImages(page) {
  for (const selector of [
    '[data-testid="public-hero"]',
    '[data-testid="featured-works"]',
    '[data-testid="home-business-entries"]',
    '[data-testid="home-current-adoptions"]',
  ]) {
    await page.locator(selector).scrollIntoViewIfNeeded()
    await page.waitForFunction((targetSelector) => (
      [...document.querySelectorAll(`${targetSelector} img`)]
        .every(image => image.complete && image.naturalWidth > 0)
    ), selector)
  }
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' })
  await revealImages(page)
  await page.waitForTimeout(760)
  await page.screenshot({
    path: resolve(outputDirectory, `homepage-${viewport.width}x${viewport.height}.png`),
    fullPage: true,
  })
  audit.viewports[`${viewport.width}x${viewport.height}`] = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement)
    const fit = selector => getComputedStyle(document.querySelector(selector)).objectFit
    return {
      tokens: {
        editorialInk: style.getPropertyValue('--public-editorial-ink').trim(),
        backgroundType: style.getPropertyValue('--public-background-type').trim(),
        mediaCanvas: style.getPropertyValue('--public-media-canvas').trim(),
        motionFeedback: style.getPropertyValue('--motion-duration-feedback').trim(),
        motionState: style.getPropertyValue('--motion-duration-state').trim(),
        motionContent: style.getPropertyValue('--motion-duration-content').trim(),
        motionMedia: style.getPropertyValue('--motion-duration-media').trim(),
      },
      media: {
        hero: fit('[data-testid="public-hero"] img'),
        featured: fit('[data-testid="featured-works"] img'),
        commission: fit('[data-testid="home-business-entries"] img'),
        adoption: fit('[data-testid="home-current-adoptions"] img'),
      },
      overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    }
  })
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(new URL('/works', baseURL).href, { waitUntil: 'domcontentloaded' })
  const workCards = page.locator('.work-card')
  await workCards.first().waitFor({ state: 'visible' })
  audit.mediaRules.works = await workCards.evaluateAll(cards => cards.map(card => {
    const image = card.querySelector('img')
    return {
      orientation: card.classList.contains('work-card--portrait') ? 'portrait' : 'landscape',
      objectFit: image ? getComputedStyle(image).objectFit : null,
      ratio: card.querySelector('.work-card__frame')
        ? getComputedStyle(card.querySelector('.work-card__frame')).aspectRatio
        : null,
    }
  }))
  await page.goto(new URL('/adoptions', baseURL).href, { waitUntil: 'domcontentloaded' })
  const adoptionCard = page.locator('.adoption-card').first()
  await adoptionCard.waitFor({ state: 'visible' })
  audit.mediaRules.adoption = await adoptionCard.evaluate(card => {
    const image = card.querySelector('img')
    const canvas = card.querySelector('.adoption-card__canvas')
    return {
      objectFit: image ? getComputedStyle(image).objectFit : null,
      canvas: canvas ? getComputedStyle(canvas).backgroundColor : null,
    }
  })
  await context.close()
}

audit.checks = {
  targetViewports: Object.keys(audit.viewports).length === 3,
  semanticTokensPresent: Object.values(audit.viewports).every(view => (
    view.tokens.editorialInk === '#111317'
    && view.tokens.backgroundType === '#eef0f3'
    && view.tokens.mediaCanvas === '#ecebf2'
  )),
  motionTokensPresent: Object.values(audit.viewports).every(view => (
    view.tokens.motionFeedback
    && view.tokens.motionState
    && view.tokens.motionContent
    && view.tokens.motionMedia
  )),
  homepageMediaRules: Object.values(audit.viewports).every(view => (
    view.media.hero === 'cover'
    && view.media.featured === 'cover'
    && view.media.commission === 'cover'
    && view.media.adoption === 'contain'
  )),
  catalogPreservesRatios: audit.mediaRules.works?.some(item => item.orientation === 'portrait')
    && audit.mediaRules.works?.some(item => item.orientation === 'landscape')
    && audit.mediaRules.works?.every(item => item.objectFit === 'cover'),
  adoptionUsesCanvasContain: audit.mediaRules.adoption?.objectFit === 'contain',
  noHorizontalOverflow: Object.values(audit.viewports).every(view => view.overflow),
}

await writeFile(
  resolve(outputDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)
await browser.close()
if (Object.values(audit.checks).some(value => value !== true)) process.exitCode = 1

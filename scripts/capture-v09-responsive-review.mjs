import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const phase = process.argv[2] === 'before' ? 'before' : 'after'
const baseURL = process.env.V09_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/.design/screenshots/v09-responsive-fix/${phase}`,
)
await mkdir(outputDirectory, { recursive: true })

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
  { name: 'desktop-short-1440x768', width: 1440, height: 768 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-375x812', width: 375, height: 812 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-430x932', width: 430, height: 932 },
]
const audit = { capturedAt: new Date().toISOString(), phase, viewports: {} }

for (const viewport of viewports) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => document.fonts.ready)

  const hero = page.getByTestId('public-hero')
  await hero.waitFor()
  await hero.locator('img').first().evaluate(async image => image.decode())
  const heroResult = await hero.evaluate((element, viewportHeight) => {
    const continuation = element.querySelector('.home-hero__continuation')
    const next = element.querySelector('.home-hero__continuation-index')
    const rect = node => node?.getBoundingClientRect().toJSON() ?? null
    const continuationRect = continuation?.getBoundingClientRect()
    return {
      continuation: rect(continuation),
      continuationInViewport: Boolean(
        continuationRect
        && continuationRect.top >= 0
        && continuationRect.bottom <= viewportHeight,
      ),
      nextDisplay: next ? getComputedStyle(next).display : null,
      nextText: next?.textContent?.trim() ?? null,
      section: rect(element),
    }
  }, viewport.height)

  if (viewport.width < 768) {
    await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      path: resolve(outputDirectory, `hero-${viewport.name}.png`),
    })
  }
  await page.waitForTimeout(500)

  const featured = page.getByTestId('featured-works')
  await featured.waitFor()
  await page.evaluate(() => {
    const element = document.querySelector('[data-testid="featured-works"]')
    if (!(element instanceof HTMLElement)) return
    const styles = getComputedStyle(document.documentElement)
    const offsetToken = innerWidth >= 1024
      ? '--public-header-height'
      : '--public-anchor-offset'
    const rawOffset = styles.getPropertyValue(offsetToken).trim()
    const offset = rawOffset.endsWith('rem')
      ? Number.parseFloat(rawOffset) * Number.parseFloat(styles.fontSize)
      : Number.parseFloat(rawOffset)
    window.scrollTo({
      top: element.offsetTop - (Number.isFinite(offset) ? offset : 0),
      behavior: 'instant',
    })
  })
  await featured.evaluate(async (element) => {
    await Promise.all([...element.querySelectorAll('img')].map(image => image.decode()))
    await new Promise(resolve => setTimeout(resolve, 80))
  })
  const featuredResult = await featured.evaluate((element, viewportHeight) => {
    const media = element.querySelector('.featured-works__media')
    const content = element.querySelector('.featured-works__content')
    const controls = element.querySelector('.featured-works__controls')
    const wayfinding = element.querySelector('.featured-works__wayfinding')
    const rect = node => node?.getBoundingClientRect().toJSON() ?? null
    const sectionRect = element.getBoundingClientRect()
    const wayfindingRect = wayfinding?.getBoundingClientRect()
    return {
      content: rect(content),
      controls: rect(controls),
      media: rect(media),
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      section: rect(element),
      sectionFitsViewport: sectionRect.bottom <= viewportHeight + 1,
      wayfinding: rect(wayfinding),
      wayfindingInViewport: Boolean(
        wayfindingRect
        && wayfindingRect.top >= 0
        && wayfindingRect.bottom <= viewportHeight,
      ),
    }
  }, viewport.height)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    requestAnimationFrame(resolve)
  })))
  await page.waitForTimeout(120)

  await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path: resolve(outputDirectory, `featured-${viewport.name}.png`),
  })
  await featured.screenshot({
    animations: 'disabled',
    path: resolve(outputDirectory, `featured-${viewport.name}-component.png`),
  })
  audit.viewports[viewport.name] = { featured: featuredResult, hero: heroResult }
  await context.close()
}

await writeFile(
  resolve(outputDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
)
await browser.close()

console.log(`[V09 responsive review] ${phase} capture complete`)

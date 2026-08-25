import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V09_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V09/after',
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

const captures = [
  { name: 'featured-1440x768', width: 1440, height: 768 },
  { name: 'featured-1440x900', width: 1440, height: 900 },
  { name: 'featured-390x844', width: 390, height: 844 },
  { name: 'featured-430x932', width: 430, height: 932 },
]
const audit = {
  capturedAt: new Date().toISOString(),
  captures: {},
  heroRegression: {},
}

for (const capture of captures) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: capture.width, height: capture.height },
  })
  const page = await context.newPage()
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const section = page.getByTestId('featured-works')
  await section.waitFor()
  await page.evaluate(() => document.fonts.ready)
  const heroContinuation = await page.locator('.home-hero__continuation').evaluate((element) => {
    const next = element.querySelector('.home-hero__continuation-index')
    const rect = element.getBoundingClientRect()
    return {
      bottom: rect.bottom,
      display: next ? getComputedStyle(next).display : null,
      text: next?.textContent?.trim() ?? null,
    }
  })
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
  await section.evaluate(async (element) => {
    await Promise.all([...element.querySelectorAll('img')].map(image => image.decode()))
    await new Promise(resolve => setTimeout(resolve, 200))
  })

  audit.captures[capture.name] = await section.evaluate((element, viewport) => {
    const media = element.querySelector('.featured-works__media')
    const content = element.querySelector('.featured-works__content')
    const title = element.querySelector('.featured-works__title')
    const display = element.querySelector('.featured-works__display')
    const controls = element.querySelector('.featured-works__controls')
    const wayfinding = element.querySelector('.featured-works__wayfinding')
    const images = [...element.querySelectorAll('img')]
    const rect = node => node?.getBoundingClientRect().toJSON() ?? null
    const mediaRect = media?.getBoundingClientRect()
    const displayRect = display?.getBoundingClientRect()
    const controlsRect = controls?.getBoundingClientRect()
    const contentRect = content?.getBoundingClientRect()
    const sectionRect = element.getBoundingClientRect()
    const wayfindingRect = wayfinding?.getBoundingClientRect()

    return {
      activeAnimations: element.getAnimations({ subtree: true }).length,
      backgroundMediaOverlap: Boolean(
        mediaRect && displayRect
        && mediaRect.left < displayRect.right
        && mediaRect.right > displayRect.left
        && mediaRect.top < displayRect.bottom
        && mediaRect.bottom > displayRect.top,
      ),
      content: rect(content),
      contentControlGap: contentRect && controlsRect
        ? contentRect.top - controlsRect.bottom
        : null,
      controls: rect(controls),
      controlsVisibleInInitialViewport: Boolean(
        controlsRect && controlsRect.top >= 0 && controlsRect.bottom <= viewport.height,
      ),
      controlStatus:
        element.querySelector('.featured-works__control-status')?.textContent
          ?.replace(/\s+/gu, ' ').trim() ?? null,
      decodedImages: images.map(image => ({
        complete: image.complete,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
      })),
      destination: wayfinding?.textContent?.replace(/\s+/gu, ' ').trim() ?? null,
      detailHref: media?.getAttribute('href') ?? null,
      display: rect(display),
      folio: element.querySelector('.featured-works__folio')?.textContent?.trim() ?? null,
      media: rect(media),
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      section: rect(element),
      sectionFitsViewport: sectionRect.bottom <= viewport.height + 1,
      title: rect(title),
      typeMediaGap: mediaRect && displayRect ? mediaRect.top - displayRect.bottom : null,
      viewport,
      wayfindingInViewport: Boolean(
        wayfindingRect
        && wayfindingRect.top >= 0
        && wayfindingRect.bottom <= viewport.height,
      ),
      worksHref: element.querySelector('a[href="/works"]')?.getAttribute('href') ?? null,
    }
  }, { width: capture.width, height: capture.height })
  audit.captures[capture.name].heroContinuation = heroContinuation

  await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path: resolve(outputDirectory, `${capture.name}.png`),
  })

  const initialSlug = await section.locator('.featured-works__media').getAttribute('data-work-slug')
  await section.locator('[data-featured-action="next"]').click()
  await section.locator('img').evaluate(image => image.decode())
  const nextState = await section.evaluate(element => ({
    activeAnimations: element.getAnimations({ subtree: true }).length,
    slug: element.querySelector('.featured-works__media')?.getAttribute('data-work-slug') ?? null,
    status: element.querySelector('.featured-works__control-status')?.textContent
      ?.replace(/\s+/gu, ' ').trim() ?? null,
    title: element.querySelector('.featured-works__title')?.textContent?.trim() ?? null,
  }))
  if (capture.width < 768) {
    await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      path: resolve(outputDirectory, `${capture.name}-next.png`),
    })
  }
  await section.locator('[data-featured-action="previous"]').click()
  await section.locator('img').evaluate(image => image.decode())
  const restoredState = await section.evaluate(element => ({
    activeAnimations: element.getAnimations({ subtree: true }).length,
    slug: element.querySelector('.featured-works__media')?.getAttribute('data-work-slug') ?? null,
    status: element.querySelector('.featured-works__control-status')?.textContent
      ?.replace(/\s+/gu, ' ').trim() ?? null,
  }))
  audit.captures[capture.name].manualSwitch = {
    initialSlug,
    next: nextState,
    restored: restoredState,
  }
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  const hero = page.getByTestId('public-hero')
  const title = page.locator('.home-hero__title')
  await hero.waitFor()
  await title.waitFor()
  const entrance = await title.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      animationName: style.animationName,
      fontFamily: style.fontFamily,
    }
  })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(900)
  const terminal = await title.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      clipPath: style.clipPath,
      opacity: style.opacity,
      transform: style.transform,
    }
  })
  const initialSlide = await page.locator('.home-hero__dot--active').getAttribute('aria-label')
  await page.waitForFunction(
    initial => document.querySelector('.home-hero__dot--active')?.getAttribute('aria-label') !== initial,
    initialSlide,
    { timeout: 5_500 },
  )
  const advancedSlide = await page.locator('.home-hero__dot--active').getAttribute('aria-label')
  audit.heroRegression = { advancedSlide, entrance, initialSlide, terminal }
  await context.close()
}

audit.checks = {
  allImagesDecoded: Object.values(audit.captures).every(result => (
    result.decodedImages.length === 1
    && result.decodedImages.every(image => image.complete && image.naturalWidth > 0)
  )),
  desktopComposition: (() => {
    const result = audit.captures['featured-1440x900']
    const shortResult = audit.captures['featured-1440x768']
    return result.media.width >= 380
      && result.media.x > result.content.x
      && result.backgroundMediaOverlap
      && shortResult.sectionFitsViewport
      && shortResult.wayfindingInViewport
  })(),
  heroAutoplayPreserved:
    audit.heroRegression.initialSlide !== audit.heroRegression.advancedSlide,
  heroTitleEntrancePreserved:
    audit.heroRegression.entrance.animationName.includes('home-hero-title-in')
    && audit.heroRegression.entrance.fontFamily.includes('Zhuohei Collage Critical')
    && audit.heroRegression.terminal.opacity === '1'
    && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(audit.heroRegression.terminal.transform),
  mobileComposition: ['featured-390x844', 'featured-430x932'].every((name) => {
    const result = audit.captures[name]
    return result.media.width >= result.section.width * 0.48
      && result.media.x > result.content.x
      && result.typeMediaGap >= 8
      && result.controlsVisibleInInitialViewport
      && result.controls.height >= 44
      && result.contentControlGap >= 16
      && result.sectionFitsViewport
      && result.wayfindingInViewport
  }),
  manualSelection: Object.values(audit.captures).every(result => (
    result.controlStatus === '01 / 02'
    && result.manualSwitch.next.status === '02 / 02'
    && result.manualSwitch.next.slug !== result.manualSwitch.initialSlug
    && result.manualSwitch.restored.status === '01 / 02'
    && result.manualSwitch.restored.slug === result.manualSwitch.initialSlug
    && result.manualSwitch.next.activeAnimations === 0
    && result.manualSwitch.restored.activeAnimations === 0
  )),
  noFeaturedMotion: Object.values(audit.captures).every(result => result.activeAnimations === 0),
  noHorizontalOverflow: Object.values(audit.captures).every(result => result.noHorizontalOverflow),
  sceneWayfinding: Object.values(audit.captures).every(result => (
    result.destination?.startsWith('下一幕')
    && result.destination.endsWith('自设委托')
    && result.folio === null
    && result.wayfindingInViewport
  )),
  heroWayfindingPreserved: Object.values(audit.captures).every(result => (
    result.heroContinuation.display !== 'none'
    && result.heroContinuation.text === '下一幕'
    && result.heroContinuation.bottom <= result.viewport.height
  )),
  workingNavigation: Object.values(audit.captures).every(result => (
    result.detailHref?.startsWith('/works/')
    && result.worksHref === '/works'
  )),
}

await writeFile(
  resolve(outputDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
)
await browser.close()

if (Object.values(audit.checks).some(value => !value))
  throw new Error('V09 evidence checks failed.')

console.log('[V09] static evidence complete')

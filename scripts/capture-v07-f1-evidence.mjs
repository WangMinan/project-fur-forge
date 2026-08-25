import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const mode = process.argv[2] === 'before' ? 'before' : 'after'
const baseURL = process.env.V07_F1_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V07-F1/${mode}`,
)
const reviewDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/.design/screenshots',
)
await mkdir(outputDirectory, { recursive: true })
await mkdir(reviewDirectory, { recursive: true })

const executablePath = process.env.V07_F1_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})

const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
]

async function waitForImages(page) {
  const images = page.locator('img')
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index)
    await image.scrollIntoViewIfNeeded()
    await image.evaluate((element) => {
      if (element.complete) return
      return new Promise((resolve) => {
        element.addEventListener('load', resolve, { once: true })
        element.addEventListener('error', resolve, { once: true })
      })
    })
  }
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function capture(name, viewport, directory = outputDirectory) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const response = await page.goto(new URL('/commission', baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  await page.locator('[data-testid="commission-page"]').waitFor()
  await waitForImages(page)
  await page.screenshot({
    path: resolve(directory, `${name}.png`),
    fullPage: true,
  })
  const result = await page.evaluate(() => {
    const image = document.querySelector('[data-testid="commission-hero"] img')
    return {
      readyState: document.readyState,
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      imagesDecoded: [...document.images].every(item => item.complete && item.naturalWidth > 0),
      heroCurrentSrc: image?.currentSrc ?? null,
      heroNaturalRatio: image ? image.naturalWidth / image.naturalHeight : null,
    }
  })
  await context.close()
  return { responseStatus: response?.status() ?? null, ...result }
}

const audit = { mode, capturedAt: new Date().toISOString(), routes: {}, interactions: {} }
for (const viewport of viewports) {
  audit.routes[`commission-${viewport.name}`] = await capture(`commission-${viewport.name}`, viewport)
}

if (mode === 'after') {
  audit.review = {
    mobile: await capture('review-commission-mobile-375', { width: 375, height: 812 }, reviewDirectory),
    tablet: await capture('review-commission-tablet-768', { width: 768, height: 1024 }, reviewDirectory),
    desktop: await capture('review-commission-desktop-1280', { width: 1280, height: 800 }, reviewDirectory),
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(new URL('/commission', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="commission-page"]').waitFor()
  await waitForImages(page)
  const actions = page.locator('main a, main button')
  const firstAction = actions.first()
  await firstAction.focus()
  audit.interactions.mobile = {
    actionTargets: await actions.evaluateAll(elements => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })),
    focusVisible: await firstAction.evaluate(element => element.matches(':focus-visible')),
    qrSizes: await page.locator('[data-testid="contact-channel-card"] img[class*="__qr"]').evaluateAll(
      elements => elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          decoded: element.complete && element.naturalWidth > 0,
        }
      }),
    ),
    termsHref: await page.locator('[data-testid="commission-page"]').getByRole('link', { name: '服务条款', exact: true }).getAttribute('href'),
  }
  await page.locator('.commission-page__text').first().evaluate((element) => {
    element.textContent = `${element.textContent?.repeat(8)}`
  })
  await page.screenshot({
    path: resolve(outputDirectory, 'commission-long-copy-390x844.png'),
    fullPage: true,
  })
  audit.interactions.longCopy = await page.evaluate(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  }))
  await context.close()

  const commissionPageSource = await readFile(resolve('app/pages/commission/index.vue'), 'utf8')
  audit.interactions.heroFallback = {
    derivesBothOrientations: /hero\.value\?\.landscape\[0\].*hero\.value\?\.portrait\[0\]/su.test(commissionPageSource),
    hidesHero: /v-if="heroReady && hero"/u.test(commissionPageSource),
    showsStatus: /v-if="status && !heroReady"/u.test(commissionPageSource),
    showsIntro: /:description="heroReady \? undefined : introText"/u.test(commissionPageSource),
  }

  const sharedContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const sharedPage = await sharedContext.newPage()
  await sharedPage.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await sharedPage.getByRole('link', { name: '了解自设委托' }).click()
  await sharedPage.waitForURL(url => url.pathname === '/commission')
  await sharedPage.locator('[data-testid="commission-hero"]').waitFor()
  audit.interactions.sharedMedia = {
    query: new URL(sharedPage.url()).search,
    transitionName: await sharedPage.locator('.commission-lead__media').evaluate(
      element => element.style.viewTransitionName,
    ),
  }
  await sharedContext.close()

  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const touchPage = await touchContext.newPage()
  await touchPage.goto(new URL('/commission', baseURL).href, { waitUntil: 'domcontentloaded' })
  await touchPage.getByRole('link', { name: '完整联系说明' }).tap()
  await touchPage.waitForURL(url => url.pathname === '/about' && url.hash === '#contact')
  audit.interactions.touch = { destination: new URL(touchPage.url()).pathname + new URL(touchPage.url()).hash }
  await touchContext.close()

  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const reducedPage = await reducedContext.newPage()
  await reducedPage.goto(new URL('/commission?view=home-commission', baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  await reducedPage.locator('[data-testid="commission-hero"]').waitFor()
  audit.interactions.reducedMotion = await reducedPage.evaluate(() => ({
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    runningAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length,
  }))
  await reducedContext.close()

  audit.checks = {
    allRoutes200: Object.values(audit.routes).every(route => route.responseStatus === 200),
    allImagesDecoded: Object.values(audit.routes).every(route => route.imagesDecoded),
    noHorizontalOverflow: Object.values(audit.routes).every(route => route.noHorizontalOverflow),
    portraitHero: audit.routes['commission-390x844'].heroNaturalRatio < 1,
    landscapeHero: audit.routes['commission-1440x900'].heroNaturalRatio > 1,
    actionTargets44: audit.interactions.mobile.actionTargets.every(target => target.width >= 44 && target.height >= 44),
    keyboardFocus: audit.interactions.mobile.focusVisible,
    qrReadable: audit.interactions.mobile.qrSizes.every(size => size.decoded && size.width >= 128),
    termsEntry: audit.interactions.mobile.termsHref === '/service',
    longCopy: audit.interactions.longCopy.noHorizontalOverflow,
    heroFallback: Object.values(audit.interactions.heroFallback).every(Boolean),
    sharedMedia: audit.interactions.sharedMedia.query === '?view=home-commission'
      && audit.interactions.sharedMedia.transitionName === 'home-commission-media',
    touch: audit.interactions.touch.destination === '/about#contact',
    reducedMotion: audit.interactions.reducedMotion.matches
      && audit.interactions.reducedMotion.runningAnimations === 0,
  }
}

await writeFile(resolve(outputDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
await browser.close()

if (mode === 'after' && Object.values(audit.checks).some(value => !value)) {
  process.exitCode = 1
}

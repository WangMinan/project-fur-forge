import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const mode = process.argv[2] === 'before' ? 'before' : 'after'
const baseURL = process.env.V07_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V07/${mode}`,
)
const reviewDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/.design/screenshots',
)
await mkdir(outputDirectory, { recursive: true })
await mkdir(reviewDirectory, { recursive: true })

const executablePath = process.env.V07_BROWSER_PATH ?? [
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
  const response = await page.goto(new URL('/about', baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  await page.locator('[data-testid="about-page"]').waitFor()
  await waitForImages(page)
  await page.screenshot({
    path: resolve(directory, `${name}.png`),
    fullPage: true,
  })
  const result = await page.evaluate(() => ({
    status: document.readyState,
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    channelCount: document.querySelectorAll('[data-testid="contact-channel-card"]').length,
    imagesDecoded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
  }))
  await context.close()
  return { responseStatus: response?.status() ?? null, ...result }
}

const audit = { mode, capturedAt: new Date().toISOString(), routes: {}, interactions: {} }
for (const viewport of viewports) {
  audit.routes[`about-${viewport.name}`] = await capture(`about-${viewport.name}`, viewport)
}

if (mode === 'after') {
  audit.review = {
    mobile: await capture('review-about-mobile-375', { width: 375, height: 812 }, reviewDirectory),
    tablet: await capture('review-about-tablet-768', { width: 768, height: 1024 }, reviewDirectory),
    desktop: await capture('review-about-desktop-1280', { width: 1280, height: 800 }, reviewDirectory),
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(new URL('/about', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="about-page"]').waitFor()
  await waitForImages(page)

  const cards = page.locator('[data-testid="contact-channel-card"]')
  const qrSizes = await cards.evaluateAll(elements => elements.map((element) => {
    const image = element.querySelector('img[class*="__qr"]')
    const rect = image?.getBoundingClientRect()
    return {
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      decoded: Boolean(image?.complete && image.naturalWidth > 0),
    }
  }))
  const actionTargets = await page.locator('#contact a, #contact button').evaluateAll(elements => (
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
  ))
  await page.locator('#contact a, #contact button').first().focus()
  audit.interactions.mobile = {
    qrSizes,
    actionTargets,
    focusVisible: await page.locator('#contact a, #contact button').first().evaluate(element => (
      element.matches(':focus-visible')
    )),
  }

  await page.locator('[data-testid="contact-channel-card"]').last().evaluate(element => element.remove())
  await page.screenshot({
    path: resolve(outputDirectory, 'about-one-channel-390x844.png'),
    fullPage: true,
  })
  audit.interactions.oneChannel = await page.locator('[data-testid="contact-channel-grid"]').evaluate((element) => {
    const card = element.querySelector('[data-testid="contact-channel-card"]')
    const gridRect = element.getBoundingClientRect()
    const cardRect = card?.getBoundingClientRect()
    return {
      count: element.children.length,
      contained: Boolean(cardRect && cardRect.right <= gridRect.right + 1),
      cardWidth: cardRect?.width ?? 0,
    }
  })

  await page.locator('[data-testid="contact-channel-card"] p').evaluate((element) => {
    element.textContent = '12345678901234567890123456789012345678901234567890'
  })
  await page.screenshot({
    path: resolve(outputDirectory, 'about-long-account-390x844.png'),
    fullPage: true,
  })
  audit.interactions.longAccount = await page.locator('[data-testid="contact-channel-card"] p').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const parent = element.parentElement?.getBoundingClientRect()
    return { contained: Boolean(parent && rect.right <= parent.right + 1) }
  })
  await context.close()

  const redirectContext = await browser.newContext({ viewport: { width: 430, height: 932 } })
  const redirectPage = await redirectContext.newPage()
  const redirectResponse = await redirectPage.request.get(new URL('/contact', baseURL).href, {
    maxRedirects: 0,
  })
  await redirectPage.goto(new URL('/contact', baseURL).href, { waitUntil: 'domcontentloaded' })
  await redirectPage.locator('#contact').waitFor()
  audit.interactions.anchor = await redirectPage.locator('#contact').evaluate((element) => ({
    path: window.location.pathname,
    hash: window.location.hash,
    top: element.getBoundingClientRect().top,
    headerBottom: document.querySelector('header')?.getBoundingClientRect().bottom ?? 0,
  }))
  audit.interactions.redirect = {
    status: redirectResponse.status(),
    location: redirectResponse.headers().location,
  }
  await redirectContext.close()

  audit.checks = {
    allRoutes200: Object.values(audit.routes).every(route => route.responseStatus === 200),
    allImagesDecoded: Object.values(audit.routes).every(route => route.imagesDecoded),
    noHorizontalOverflow: Object.values(audit.routes).every(route => route.noHorizontalOverflow),
    qrReadable: audit.interactions.mobile.qrSizes.every(size => size.decoded && size.width >= 128 && size.height >= 128),
    actionTargets44: audit.interactions.mobile.actionTargets.every(target => target.width >= 44 && target.height >= 44),
    keyboardFocus: audit.interactions.mobile.focusVisible,
    oneChannel: audit.interactions.oneChannel.count === 1 && audit.interactions.oneChannel.contained,
    longAccount: audit.interactions.longAccount.contained,
    redirect301: audit.interactions.redirect.status === 301 && audit.interactions.redirect.location === '/about#contact',
    anchorOffset: audit.interactions.anchor.path === '/about'
      && audit.interactions.anchor.hash === '#contact'
      && audit.interactions.anchor.top >= audit.interactions.anchor.headerBottom,
  }
}

await writeFile(resolve(outputDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
await browser.close()

if (mode === 'after' && Object.values(audit.checks).some(value => !value)) {
  process.exitCode = 1
}

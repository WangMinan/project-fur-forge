import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V12_B_BASE_URL ?? 'http://127.0.0.1:3000/'
const variant = process.argv[2] === 'before'
  ? 'before'
  : process.env.V12_B_VARIANT ?? 'after'
const verify = process.argv.includes('--verify') || process.env.V12_B_VERIFY === '1'
const evidenceDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V12-B/${variant}`,
)
await mkdir(evidenceDirectory, { recursive: true })

const executablePath = process.env.V12_B_BROWSER_PATH ?? [
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
  { name: '2048x1080', width: 2048, height: 1080 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1023x900', width: 1023, height: 900 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
]

async function waitForVisuals(page, root) {
  await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__))
  await page.evaluate(() => document.fonts.ready)
  await root.locator('img').evaluateAll(async images => Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await Promise.race([
        new Promise(resolveLoad => {
          image.addEventListener('load', resolveLoad, { once: true })
          image.addEventListener('error', resolveLoad, { once: true })
        }),
        new Promise(resolveTimeout => setTimeout(resolveTimeout, 2500)),
      ])
    }
    if (image.naturalWidth > 0)
      await image.decode()
  })))
}

async function capture(viewport) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  const response = await page.goto(new URL('/about', baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  const root = page.locator('[data-testid="about-page"]')
  await root.waitFor()
  await waitForVisuals(page, root)
  await page.screenshot({
    animations: 'disabled',
    path: resolve(evidenceDirectory, `about-${viewport.name}.png`),
  })
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: resolve(evidenceDirectory, `about-${viewport.name}-full.png`),
  })

  const result = await root.evaluate((element, currentViewport) => {
    const intro = element.querySelector('.about-contact__intro')?.getBoundingClientRect()
    const directory = element.querySelector('.about-contact__directory')?.getBoundingClientRect()
    return {
      viewport: currentViewport,
      noHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      runningAnimations:
        element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
      channelCount: element.querySelectorAll('[data-testid="contact-channel-card"]').length,
      contactComposition: intro && directory
        ? currentViewport.width >= 1024
          ? intro.right <= directory.left
          : intro.bottom <= directory.top
        : null,
      images: [...element.querySelectorAll('img')].map(image => ({
        complete: image.complete,
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
      })),
    }
  }, viewport)
  result.responseStatus = response?.status() ?? null
  await context.close()
  return result
}

const audit = { variant, routes: {}, interactions: {} }
for (const viewport of viewports)
  audit.routes[viewport.name] = await capture(viewport)

if (variant === 'after') {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
  })
  await context.grantPermissions(
    ['clipboard-read', 'clipboard-write'],
    { origin: new URL(baseURL).origin },
  )
  const page = await context.newPage()
  await page.goto(new URL('/about', baseURL).href, { waitUntil: 'domcontentloaded' })
  const root = page.locator('[data-testid="about-page"]')
  await root.waitFor()
  await waitForVisuals(page, root)

  const cards = page.locator('[data-testid="contact-channel-card"]')
  const qrSizes = await cards.evaluateAll(elements => elements.map((element) => {
    const image = element.querySelector('.contact-channel-grid__qr')
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
  const firstAction = page.locator('#contact a, #contact button').first()
  await firstAction.focus()
  audit.interactions.mobile = {
    qrSizes,
    actionTargets,
    focusVisible: await firstAction.evaluate(element => element.matches(':focus-visible')),
  }

  const emailAddress = await page.locator('.email-actions__address').innerText()
  const mailtoHref = await page.locator('.email-actions__buttons a').getAttribute('href')
  await page.getByRole('button', { name: '复制邮箱' }).click()
  const copyFeedback = page.getByRole('status')
  await copyFeedback.waitFor()
  audit.interactions.email = {
    address: emailAddress,
    copyFeedback: await copyFeedback.innerText(),
    mailtoHref,
  }

  await cards.last().evaluate(element => element.remove())
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: resolve(evidenceDirectory, 'about-one-channel-390x844.png'),
  })
  audit.interactions.oneChannel = await page.locator('[data-testid="contact-channel-grid"]').evaluate((element) => {
    const card = element.querySelector('[data-testid="contact-channel-card"]')
    const gridRect = element.getBoundingClientRect()
    const cardRect = card?.getBoundingClientRect()
    return {
      count: element.children.length,
      contained: Boolean(cardRect && cardRect.right <= gridRect.right + 1),
    }
  })

  await cards.first().locator('.contact-channel-grid__account').evaluate((element) => {
    element.textContent = '12345678901234567890123456789012345678901234567890'
  })
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: resolve(evidenceDirectory, 'about-long-account-390x844.png'),
  })
  audit.interactions.longAccount = await cards.first().locator('.contact-channel-grid__account').evaluate((element) => {
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
  const contact = redirectPage.locator('#contact')
  await contact.waitFor()
  audit.interactions.anchor = await contact.evaluate((element) => ({
    hash: window.location.hash,
    path: window.location.pathname,
    top: element.getBoundingClientRect().top,
    headerBottom: document.querySelector('header')?.getBoundingClientRect().bottom ?? 0,
  }))
  audit.interactions.redirect = {
    location: redirectResponse.headers().location,
    status: redirectResponse.status(),
  }
  await redirectContext.close()
}

const routes = Object.values(audit.routes)
audit.checks = variant === 'after'
  ? {
      allRoutes200: routes.every(route => route.responseStatus === 200),
      allImagesDecoded: routes.every(route => (
        route.images.length > 0
        && route.images.every(image => image.complete && image.naturalWidth > 0)
      )),
      noHorizontalOverflow: routes.every(route => route.noHorizontalOverflow),
      staticUnderReducedMotion: routes.every(route => route.runningAnimations === 0),
      contactComposition: routes.every(route => route.contactComposition),
      qrReadable: audit.interactions.mobile.qrSizes.every(size => (
        size.decoded && size.width >= 128 && size.height >= 128
      )),
      actionTargets44: audit.interactions.mobile.actionTargets.every(target => (
        target.width >= 44 && target.height >= 44
      )),
      keyboardFocus: audit.interactions.mobile.focusVisible,
      emailActions: audit.interactions.email.address.length > 0
        && audit.interactions.email.mailtoHref === `mailto:${audit.interactions.email.address}`
        && audit.interactions.email.copyFeedback === '邮箱地址已复制到剪贴板。',
      oneChannel: audit.interactions.oneChannel.count === 1
        && audit.interactions.oneChannel.contained,
      longAccount: audit.interactions.longAccount.contained,
      redirect301: audit.interactions.redirect.status === 301
        && audit.interactions.redirect.location === '/about#contact',
      anchorOffset: audit.interactions.anchor.path === '/about'
        && audit.interactions.anchor.hash === '#contact'
        && audit.interactions.anchor.top >= audit.interactions.anchor.headerBottom,
    }
  : {}

await writeFile(
  resolve(evidenceDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
)
await browser.close()

if (verify && Object.values(audit.checks).some(value => !value))
  throw new Error('V12-B evidence checks failed.')

console.log(`[V12-B] ${variant} evidence complete`)

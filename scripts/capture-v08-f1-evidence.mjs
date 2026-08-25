import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V08_F1_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve('agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V08-F1/after')
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
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
]

function url(path) {
  return new URL(path, baseURL).href
}

async function capture(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: resolve(outputDirectory, `${name}.png`), fullPage: true })
}

async function open(page, path, selector) {
  const response = await page.goto(url(path), { waitUntil: 'domcontentloaded' })
  await page.locator(selector).waitFor()
  await page.waitForTimeout(250)
  return response?.status() ?? null
}

async function visualMetrics(page) {
  return page.evaluate(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))
}

const audit = {
  capturedAt: new Date().toISOString(),
  routes: {},
  interactions: {},
  checks: {},
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()

  const notFoundStatus = await open(page, '/__v08-f1-not-found', '[data-testid="public-error-page"]')
  await capture(page, `404-${viewport.name}`)
  audit.routes[`404-${viewport.name}`] = {
    status: notFoundStatus,
    title: await page.locator('h1').textContent(),
    ...await visualMetrics(page),
  }

  const noMatchStatus = await open(page, '/works?q=__v08_f1_no_match__', '[data-testid="public-empty-state"]')
  await capture(page, `works-no-match-${viewport.name}`)
  audit.routes[`works-no-match-${viewport.name}`] = {
    status: noMatchStatus,
    title: await page.locator('[data-testid="public-empty-state"] h2').textContent(),
    ...await visualMetrics(page),
  }

  await context.close()
}

const errorContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
const errorPage = await errorContext.newPage()
await open(errorPage, '/__v08-f1-keyboard', '[data-testid="public-error-page"]')
const returnHome = errorPage.getByRole('link', { name: '返回首页' })
await returnHome.focus()
audit.interactions.keyboard = {
  focusVisible: await returnHome.evaluate(element => element.matches(':focus-visible')),
  target: await returnHome.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }),
}
await capture(errorPage, '404-keyboard-390x844')
await errorContext.close()

const touchContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})
const touchPage = await touchContext.newPage()
await open(touchPage, '/__v08-f1-touch', '[data-testid="public-error-page"]')
await touchPage.getByRole('link', { name: '返回首页' }).tap()
await touchPage.waitForURL(url('/'))
audit.interactions.touch = { returnHome: new URL(touchPage.url()).pathname === '/' }
await touchContext.close()

const mediaContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
const mediaPage = await mediaContext.newPage()
await mediaPage.route('**/*', (route) => {
  if (route.request().resourceType() === 'image') {
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' })
  }
  return route.continue()
})
await open(mediaPage, '/', '[data-testid="public-hero"]')
await mediaPage.locator('.responsive-picture--failed').first().waitFor()
await capture(mediaPage, 'media-failure-390x844')
audit.routes.mediaFailure = {
  failedPictures: await mediaPage.locator('.responsive-picture--failed').count(),
  fallbackText: await mediaPage.locator('.responsive-picture__fallback').first().textContent(),
  ...await visualMetrics(mediaPage),
}
await mediaContext.close()

const noJavaScriptContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  javaScriptEnabled: false,
})
const noJavaScriptPage = await noJavaScriptContext.newPage()
await open(noJavaScriptPage, '/works', '.works-page')
await capture(noJavaScriptPage, 'works-no-javascript-390x844')
audit.routes.noJavaScript = {
  images: await noJavaScriptPage.locator('.responsive-picture img').count(),
  fallbackVisible: await noJavaScriptPage.locator('.responsive-picture__fallback').count(),
  ...await visualMetrics(noJavaScriptPage),
}
await noJavaScriptContext.close()

const reducedContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
})
const reducedPage = await reducedContext.newPage()
await open(reducedPage, '/__v08-f1-reduced', '[data-testid="public-error-page"]')
audit.interactions.reducedMotion = await reducedPage.evaluate(() => ({
  matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
  runningAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length,
}))
await reducedContext.close()

audit.checks = {
  errorsAre404: viewports.every(viewport => audit.routes[`404-${viewport.name}`].status === 404),
  noMatch: viewports.every(viewport => audit.routes[`works-no-match-${viewport.name}`].title?.trim() === '没有找到这个设定'),
  noOverflow: Object.values(audit.routes).every(route => route.noHorizontalOverflow),
  keyboard: audit.interactions.keyboard.focusVisible
    && audit.interactions.keyboard.target.width >= 44
    && audit.interactions.keyboard.target.height >= 44,
  touch: audit.interactions.touch.returnHome,
  mediaFailure: audit.routes.mediaFailure.failedPictures > 0
    && audit.routes.mediaFailure.fallbackText?.trim().startsWith('图片暂时无法显示'),
  noJavaScript: audit.routes.noJavaScript.images > 0
    && audit.routes.noJavaScript.fallbackVisible === 0,
  reducedMotion: audit.interactions.reducedMotion.matches
    && audit.interactions.reducedMotion.runningAnimations === 0,
}

await writeFile(resolve(outputDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
await browser.close()

if (Object.values(audit.checks).some(value => !value)) process.exitCode = 1

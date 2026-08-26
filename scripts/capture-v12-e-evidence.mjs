import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const mode = process.argv.includes('--before') ? 'before' : 'after'
const verify = process.argv.includes('--verify')
const baseURL = process.env.V12_E_BASE_URL ?? 'http://127.0.0.1:3001/'
const evidenceDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V12-E/${mode}`,
)
await mkdir(evidenceDirectory, { recursive: true })

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
  { name: '1440x900', width: 1440, height: 900 },
]
const states = [
  { name: '404', path: '/__v12-e-not-found', selector: '[data-testid="public-error-page"]' },
  { name: '500', path: '/__test__/page-error', selector: '[data-testid="public-error-page"]' },
  { name: 'empty', path: '/works?page=9999', selector: '[data-testid="public-empty-state"]' },
  { name: 'no-result', path: '/works?q=__v12_e_no_match__', selector: '[data-testid="public-empty-state"]' },
]

const audit = {
  mode,
  capturedAt: new Date().toISOString(),
  routes: {},
  interactions: {},
}

function url(path) {
  return new URL(path, baseURL).href
}

async function open(page, path, selector) {
  const response = await page.goto(url(path), { waitUntil: 'domcontentloaded' })
  await page.locator(selector).waitFor()
  await page.evaluate(() => document.fonts.ready)
  return response?.status() ?? null
}

async function capture(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: resolve(evidenceDirectory, `${name}.png`),
    fullPage: true,
  })
}

async function metrics(page, selector) {
  return page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector)
    const actions = [...document.querySelectorAll(`${targetSelector} a, ${targetSelector} button`)]
    const actionTargets = actions.map((action) => {
      const rect = action.getBoundingClientRect()
      return { height: rect.height, width: rect.width }
    })
    return {
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      targetText: target?.textContent?.replace(/\s+/gu, ' ').trim() ?? '',
      minActionHeight: actionTargets.length ? Math.min(...actionTargets.map(item => item.height)) : null,
      minActionWidth: actionTargets.length ? Math.min(...actionTargets.map(item => item.width)) : null,
      footerPresent: Boolean(document.querySelector('[data-testid="public-footer"]')),
      brandPresent: Boolean(document.querySelector('[data-testid="public-header"]')),
    }
  }, selector)
}

for (const state of states) {
  audit.routes[state.name] = {}
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const status = await open(page, state.path, state.selector)
    await capture(page, `${state.name}-${viewport.name}`)
    audit.routes[state.name][viewport.name] = {
      status,
      ...await metrics(page, state.selector),
    }
    await context.close()
  }
}

audit.routes.mediaFailure = {}
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.route('**/*', (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    if (request.resourceType() === 'image'
      && !requestUrl.pathname.startsWith('/brand/')
      && !requestUrl.pathname.startsWith('/filings/')) {
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' })
    }
    return route.continue()
  })
  await open(page, '/works', '.works-page')
  await page.locator('.responsive-picture--failed').first().waitFor()
  await capture(page, `media-failure-${viewport.name}`)
  audit.routes.mediaFailure[viewport.name] = {
    failedPictures: await page.locator('.responsive-picture--failed').count(),
    fallbackText: await page.locator('.responsive-picture__fallback').first().textContent(),
    ...await metrics(page, '.works-page'),
  }
  await context.close()
}

const keyboardContext = await browser.newContext({ viewport: viewports[0] })
const keyboardPage = await keyboardContext.newPage()
await open(keyboardPage, '/__v12-e-keyboard', '[data-testid="public-error-page"]')
const primaryRecovery = keyboardPage.getByRole('link', { name: '返回首页' })
await primaryRecovery.focus()
audit.interactions.keyboard = {
  focusVisible: await primaryRecovery.evaluate(element => element.matches(':focus-visible')),
  target: await primaryRecovery.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { height: rect.height, width: rect.width }
  }),
}
await capture(keyboardPage, '404-keyboard-390x844')
await keyboardContext.close()

const noJavaScriptContext = await browser.newContext({
  viewport: viewports[0],
  javaScriptEnabled: false,
})
const noJavaScriptPage = await noJavaScriptContext.newPage()
await open(noJavaScriptPage, '/works', '.works-page')
audit.interactions.noJavaScript = {
  images: await noJavaScriptPage.locator('.responsive-picture img').count(),
  fallbacks: await noJavaScriptPage.locator('.responsive-picture__fallback').count(),
}
await noJavaScriptContext.close()

const reducedContext = await browser.newContext({
  viewport: viewports[0],
  reducedMotion: 'reduce',
})
const reducedPage = await reducedContext.newPage()
await open(reducedPage, '/__v12-e-reduced', '[data-testid="public-error-page"]')
audit.interactions.reducedMotion = await reducedPage.evaluate(() => ({
  matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
  runningAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length,
}))
await reducedContext.close()

if (mode === 'after') {
  const routeStates = Object.values(audit.routes)
    .flatMap(route => Object.values(route))
  audit.checks = {
    statusCodes: viewports.every(viewport => (
      audit.routes['404'][viewport.name].status === 404
      && audit.routes['500'][viewport.name].status === 500
    )),
    noHorizontalOverflow: routeStates.every(route => route.noHorizontalOverflow),
    brandedErrors: viewports.every(viewport => (
      audit.routes['404'][viewport.name].brandPresent
      && audit.routes['500'][viewport.name].brandPresent
    )),
    emptyRecovery: viewports.every(viewport => (
      audit.routes.empty[viewport.name].targetText.includes('回到第一页')
    )),
    noResultRecovery: viewports.every(viewport => (
      audit.routes['no-result'][viewport.name].targetText.includes('清除搜索')
    )),
    actionTargets: Object.values(audit.routes)
      .flatMap(route => Object.values(route))
      .filter(route => route.minActionHeight !== null)
      .every(route => route.minActionHeight >= 44 && route.minActionWidth >= 44),
    mediaFailure: viewports.every(viewport => (
      audit.routes.mediaFailure[viewport.name].failedPictures > 0
      && audit.routes.mediaFailure[viewport.name].fallbackText?.includes('图片暂时无法显示')
    )),
    keyboard: audit.interactions.keyboard.focusVisible
      && audit.interactions.keyboard.target.height >= 44
      && audit.interactions.keyboard.target.width >= 44,
    noJavaScript: audit.interactions.noJavaScript.images > 0
      && audit.interactions.noJavaScript.fallbacks === 0,
    reducedMotion: audit.interactions.reducedMotion.matches
      && audit.interactions.reducedMotion.runningAnimations === 0,
  }
}

await writeFile(
  resolve(evidenceDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
)
await browser.close()

if (verify && Object.values(audit.checks ?? {}).some(value => !value)) {
  throw new Error('V12-E evidence checks failed.')
}

console.log(`[V12-E] ${mode} evidence complete`)

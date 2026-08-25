import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const baseURL = process.env.V06_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V06',
)
await mkdir(outputDirectory, { recursive: true })
const executablePath = process.env.V06_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})
const audit = { capturedAt: new Date().toISOString(), routes: {}, interactions: {} }

async function captureRoute(name, route, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const pageRoot = page.locator('.public-page, .adoptions-page')
  await pageRoot.waitFor({ state: 'visible' })
  const cards = page.locator('.work-card, .adoption-card')
  for (let index = 0; index < await cards.count(); index += 1) {
    const card = cards.nth(index)
    await card.scrollIntoViewIfNeeded()
    await card.locator('img').evaluate((image) => {
      if (image.complete && image.naturalWidth > 0) return
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true })
        image.addEventListener('error', resolve, { once: true })
      })
    })
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(100)
  await page.screenshot({
    path: resolve(outputDirectory, `${name}-${viewport.width}x${viewport.height}.png`),
    fullPage: true,
  })
  audit.routes[`${name}-${viewport.width}x${viewport.height}`] = await page.evaluate(() => {
    const images = [...document.querySelectorAll('img')]
    const cards = [...document.querySelectorAll('.work-card, .adoption-card')]
    return {
      imagesDecoded: images.every(image => image.complete && image.naturalWidth > 0),
      cardCount: cards.length,
      cardWidths: cards.map(card => Math.round(card.getBoundingClientRect().width)),
      orientations: [...document.querySelectorAll('[data-orientation]')]
        .map(element => element.getAttribute('data-orientation')),
      hasSearch: Boolean(document.querySelector('[role="search"] input[type="search"]')),
      hasPagination: Boolean(document.querySelector('.pagination')),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })
  await context.close()
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
]) {
  await captureRoute('works', '/works', viewport)
  await captureRoute('adoptions', '/adoptions', viewport)
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(new URL('/works', baseURL).href, { waitUntil: 'domcontentloaded' })
  const search = page.getByRole('search').locator('input[type="search"]')
  await search.focus()
  const keyboardStart = await page.evaluate(() => document.activeElement?.tagName ?? '')
  await page.keyboard.press('Tab')
  const keyboardNext = await page.evaluate(() => document.activeElement?.tagName ?? '')
  await page.keyboard.press('Shift+Tab')
  await search.fill('虾片')
  await search.press('Enter')
  await page.waitForURL(/\/works\?q=/u)
  audit.interactions.workSearch = {
    ...await page.evaluate(() => ({
    pathname: location.pathname,
    query: location.search,
    results: document.querySelectorAll('.work-card').length,
    hasSearch: Boolean(document.querySelector('[role="search"] input[type="search"]')),
    })),
    keyboardStart,
    keyboardNext,
  }
  await page.goto(new URL('/works?q=一个&q=两个', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="public-empty-state"]').waitFor({ state: 'visible' })
  await page.screenshot({ path: resolve(outputDirectory, 'works-invalid-search-390x844.png') })
  audit.interactions.workInvalidSearch = await page.evaluate(() => ({
    title: document.querySelector('.empty-state__title')?.textContent?.trim() ?? '',
    clearVisible: Boolean(document.querySelector('.empty-state a[href="/works"]')),
  }))
  await page.goto(new URL('/works?page=999', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="public-empty-state"]').waitFor({ state: 'visible' })
  await page.screenshot({ path: resolve(outputDirectory, 'works-out-of-range-390x844.png') })
  audit.interactions.workOutOfRange = await page.evaluate(() => ({
    title: document.querySelector('.empty-state__title')?.textContent?.trim() ?? '',
    firstPageVisible: Boolean(document.querySelector('.empty-state a[href="/works"]')),
  }))
  await page.goto(new URL('/adoptions?q=不存在的设定', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="public-empty-state"]').waitFor({ state: 'visible' })
  audit.interactions.adoptionEmpty = await page.evaluate(() => ({
    title: document.querySelector('.empty-state__title')?.textContent?.trim() ?? '',
    clearVisible: Boolean(document.querySelector('.empty-state a[href="/adoptions"]')),
  }))
  await context.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  await page.goto(new URL('/adoptions', baseURL).href, { waitUntil: 'domcontentloaded' })
  const search = page.getByRole('search').locator('input[type="search"]')
  await search.fill('常规')
  const targets = await page.locator('.catalog-search__input, .catalog-search__submit, .adoptions-page__contact-action')
    .evaluateAll(elements => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { height: Math.round(rect.height), width: Math.round(rect.width) }
    }))
  await page.getByRole('button', { name: '搜索' }).tap()
  await page.waitForURL(/\/adoptions\?q=/u)
  audit.interactions.adoptionTouchSearch = {
    results: await page.locator('.adoption-card').count(),
    targets,
  }
  await context.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(new URL('/works', baseURL).href, { waitUntil: 'domcontentloaded' })
  audit.interactions.reducedMotion = await page.locator('.work-card').first().evaluate(element => ({
    cardTransition: getComputedStyle(element).transitionDuration,
    imageTransition: getComputedStyle(element.querySelector('.work-card__image')).transitionDuration,
  }))
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(new URL('/adoptions', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.locator('.adoption-card').first().evaluate((card) => {
    const name = card.querySelector('.work-identity__name')
    const species = card.querySelector('.work-identity__species')
    if (name) name.textContent = '这是一个用于验证超长且没有空格角色名称不会溢出容器的设定名称'
    if (species) species.textContent = '这是一个同样需要安全换行的超长物种名称'
  })
  await page.screenshot({ path: resolve(outputDirectory, 'adoptions-long-identity-390x844.png') })
  audit.interactions.longIdentity = await page.locator('.adoption-card').first().evaluate((card) => {
    const identity = card.querySelector('.work-identity')
    const cardRect = card.getBoundingClientRect()
    const identityRect = identity?.getBoundingClientRect()
    return {
      contained: Boolean(identityRect
        && identityRect.left >= cardRect.left
        && identityRect.right <= cardRect.right + 1),
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    }
  })
  await context.close()
}

audit.checks = {
  allRouteViewports: Object.keys(audit.routes).length === 10,
  allImagesDecoded: Object.values(audit.routes).every(route => route.imagesDecoded),
  allRoutesSearchable: Object.values(audit.routes).every(route => route.hasSearch),
  noHorizontalOverflow: Object.values(audit.routes)
    .every(route => route.scrollWidth <= route.clientWidth + 1),
  mobileWorksSingleColumn: audit.routes['works-390x844']?.cardWidths.length === 0
    || new Set(audit.routes['works-390x844']?.cardWidths).size === 1,
  mixedWorkOrientations: new Set(audit.routes['works-1440x900']?.orientations).size >= 2,
  workSearch: audit.interactions.workSearch?.pathname === '/works'
    && audit.interactions.workSearch?.results > 0
    && audit.interactions.workSearch?.keyboardStart === 'INPUT'
    && audit.interactions.workSearch?.keyboardNext === 'BUTTON',
  workInvalidSearch: audit.interactions.workInvalidSearch?.title === '搜索条件无效'
    && audit.interactions.workInvalidSearch?.clearVisible === true,
  workOutOfRange: audit.interactions.workOutOfRange?.title === '这一页没有作品'
    && audit.interactions.workOutOfRange?.firstPageVisible === true,
  adoptionEmpty: audit.interactions.adoptionEmpty?.title === '没有找到这个设定'
    && audit.interactions.adoptionEmpty?.clearVisible === true,
  adoptionTouchSearch: audit.interactions.adoptionTouchSearch?.results > 0
    && audit.interactions.adoptionTouchSearch?.targets
      .every(target => target.height >= 44 && target.width >= 44),
  reducedMotion: audit.interactions.reducedMotion?.cardTransition === '0s'
    && audit.interactions.reducedMotion?.imageTransition === '0s',
  longIdentity: audit.interactions.longIdentity?.contained === true
    && audit.interactions.longIdentity?.noHorizontalOverflow === true,
}

await writeFile(
  resolve(outputDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)
await browser.close()
if (Object.values(audit.checks).some(value => value !== true)) process.exitCode = 1

import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const baseURL = process.env.V06_F1_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V06-F1',
)
const reviewDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/.design/screenshots',
)
await mkdir(outputDirectory, { recursive: true })
await mkdir(reviewDirectory, { recursive: true })
const executablePath = process.env.V06_F1_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})
const audit = { capturedAt: new Date().toISOString(), routes: {}, interactions: {} }

async function waitForImages(page) {
  const images = page.locator('img')
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index)
    await image.scrollIntoViewIfNeeded()
    await image.evaluate((element) => {
      if (element.complete && element.naturalWidth > 0) return
      return new Promise((resolve) => {
        element.addEventListener('load', resolve, { once: true })
        element.addEventListener('error', resolve, { once: true })
      })
    })
  }
}

async function waitForHydration(page) {
  await page.waitForFunction(() => Boolean(
    document.querySelector('#__nuxt')?.__vue_app__,
  ))
}

async function capture(name, route, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const response = await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="work-detail"]').waitFor({ state: 'visible' })
  await waitForImages(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(100)
  await page.screenshot({
    path: resolve(outputDirectory, `${name}-${viewport.width}x${viewport.height}.png`),
    fullPage: true,
  })
  audit.routes[`${name}-${viewport.width}x${viewport.height}`] = await page.evaluate(() => ({
    status: document.querySelector('[data-testid="work-detail"]') ? 200 : 0,
    imageCount: document.querySelectorAll('.work-gallery img').length,
    imagesDecoded: [...document.querySelectorAll('.work-gallery img')]
      .every(image => image.complete && image.naturalWidth > 0),
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    thumbCount: document.querySelectorAll('.work-gallery__thumb').length,
  }))
  audit.routes[`${name}-${viewport.width}x${viewport.height}`].responseStatus = response?.status() ?? 0
  await context.close()
}

async function captureReview(name, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(new URL('/works/return-xiapian', baseURL).href, { waitUntil: 'domcontentloaded' })
  await waitForImages(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(100)
  await page.screenshot({
    path: resolve(reviewDirectory, `review-work-detail-${name}.png`),
    fullPage: true,
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
  await capture('mixed-gallery', '/works/brand-assets-b', viewport)
}
await capture('single-landscape', '/works/adoption-regular-2', { width: 390, height: 844 })
await capture('single-landscape', '/works/adoption-regular-2', { width: 1440, height: 900 })
await capture('portrait-mixed', '/works/return-xiapian', { width: 390, height: 844 })
await capture('portrait-mixed', '/works/return-xiapian', { width: 1440, height: 900 })
await captureReview('mobile-375', { width: 375, height: 812 })
await captureReview('tablet-768', { width: 768, height: 1024 })
await captureReview('desktop-1280', { width: 1280, height: 800 })

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(new URL('/works/brand-assets-b', baseURL).href, { waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  const stage = page.locator('.work-gallery__stage')
  const thumbs = page.locator('.work-gallery__thumb')
  const mainImage = stage.locator('img')
  const before = {
    imageSrc: await mainImage.getAttribute('src'),
    stage: await stage.boundingBox(),
    thumbs: await page.locator('.work-gallery__thumbs').boundingBox(),
  }
  await thumbs.nth(1).focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(250)
  const after = {
    imageSrc: await mainImage.getAttribute('src'),
    stage: await stage.boundingBox(),
    thumbs: await page.locator('.work-gallery__thumbs').boundingBox(),
    selected: await thumbs.nth(1).getAttribute('aria-pressed'),
    focused: await thumbs.nth(1).evaluate(element => element === document.activeElement),
  }
  await page.screenshot({ path: resolve(outputDirectory, 'mixed-gallery-after-switch-1440x900.png') })
  audit.interactions.keyboardSwitch = { before, after }
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(new URL('/works/brand-assets-b', baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.locator('.work-detail__name').evaluate((element) => {
    element.textContent = '这是一个用于验证统一详情页超长且没有空格角色名称不会溢出的作品名称'
  })
  await page.locator('.work-detail__meta').evaluate((element) => {
    element.textContent = '这是一个同样需要安全换行的超长物种名称'
  })
  await page.screenshot({ path: resolve(outputDirectory, 'long-identity-390x844.png') })
  audit.interactions.longIdentity = await page.evaluate(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    nameContained: document.querySelector('.work-detail__name').scrollWidth
      <= document.querySelector('.work-detail__name').clientWidth + 1,
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
  await page.goto(new URL('/works/brand-assets-b', baseURL).href, { waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  const thumb = page.locator('.work-gallery__thumb').nth(2)
  const target = await thumb.boundingBox()
  await thumb.tap()
  await page.waitForTimeout(250)
  audit.interactions.touchSwitch = {
    selected: await thumb.getAttribute('aria-pressed'),
    target,
  }
  await context.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(new URL('/works/brand-assets-b', baseURL).href, { waitUntil: 'domcontentloaded' })
  await waitForHydration(page)
  await page.locator('.work-gallery__thumb').nth(1).click()
  audit.interactions.reducedMotion = {
    animationCount: await page.locator('.work-gallery__stage')
      .evaluate(element => element.getAnimations({ subtree: true }).length),
    selected: await page.locator('.work-gallery__thumb').nth(1).getAttribute('aria-pressed'),
  }
  await context.close()
}

const detailSource = await readFile('app/pages/works/[slug].vue', 'utf8')
audit.interactions.emptyGallery = {
  usesSharedEmptyState: detailSource.includes('<PublicEmptyState')
    && detailSource.includes('title="作品图片正在整理中。"'),
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const request = context.request
  const redirect = await request.get(new URL('/adoptions/adoption-green-dog-test', baseURL).href, {
    maxRedirects: 0,
  })
  const missing = await request.get(new URL('/works/v06-f1-missing-work', baseURL).href, {
    maxRedirects: 0,
  })
  audit.interactions.routes = {
    adoptionRedirect: {
      status: redirect.status(),
      location: redirect.headers().location,
    },
    missingStatus: missing.status(),
  }
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(new URL('/works/adoption-green-dog-test?from=adoptions', baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  const adoptionBack = await page.getByRole('link', { name: '返回设定领养' }).getAttribute('href')
  await page.goto(new URL('/works/brand-assets-b?view=home-featured', baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  const worksBack = await page.getByRole('link', { name: '返回作品展示' }).getAttribute('href')
  audit.interactions.backLinks = {
    adoption: adoptionBack,
    works: worksBack,
  }
  await context.close()
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  })
  const page = await context.newPage()
  await page.goto(new URL('/works/brand-assets-b', baseURL).href, { waitUntil: 'domcontentloaded' })
  audit.interactions.noJavaScript = {
    headingVisible: await page.getByRole('heading', { level: 1, name: '品牌素材测试 B' }).isVisible(),
    mainImageVisible: await page.locator('.work-gallery__stage img').isVisible(),
    backVisible: await page.getByRole('link', { name: '返回作品展示' }).isVisible(),
  }
  await context.close()
}

const closeEnough = (left, right) => Math.abs((left ?? 0) - (right ?? 0)) <= 1
const keyboard = audit.interactions.keyboardSwitch
audit.checks = {
  allRouteViewports: Object.keys(audit.routes).length === 9,
  allImagesDecoded: Object.values(audit.routes).every(route => route.imagesDecoded),
  noHorizontalOverflow: Object.values(audit.routes).every(route => route.noHorizontalOverflow),
  singleImageHasNoThumbs: audit.routes['single-landscape-390x844']?.thumbCount === 0,
  keyboardSwitch: keyboard?.before.imageSrc !== keyboard?.after.imageSrc
    && keyboard?.after.selected === 'true'
    && keyboard?.after.focused === true,
  stableMixedStage: closeEnough(keyboard?.before.stage?.x, keyboard?.after.stage?.x)
    && closeEnough(keyboard?.before.stage?.y, keyboard?.after.stage?.y)
    && closeEnough(keyboard?.before.stage?.width, keyboard?.after.stage?.width)
    && closeEnough(keyboard?.before.stage?.height, keyboard?.after.stage?.height)
    && closeEnough(keyboard?.before.thumbs?.x, keyboard?.after.thumbs?.x)
    && closeEnough(keyboard?.before.thumbs?.y, keyboard?.after.thumbs?.y),
  touchSwitch: audit.interactions.touchSwitch?.selected === 'true'
    && audit.interactions.touchSwitch?.target?.width >= 44
    && audit.interactions.touchSwitch?.target?.height >= 44,
  reducedMotion: audit.interactions.reducedMotion?.animationCount === 0
    && audit.interactions.reducedMotion?.selected === 'true',
  emptyGallery: audit.interactions.emptyGallery?.usesSharedEmptyState === true,
  longIdentity: audit.interactions.longIdentity?.noHorizontalOverflow === true
    && audit.interactions.longIdentity?.nameContained === true,
  adoptionRedirect: audit.interactions.routes?.adoptionRedirect.status === 301
    && audit.interactions.routes?.adoptionRedirect.location === '/works/adoption-green-dog-test',
  missing404: audit.interactions.routes?.missingStatus === 404,
  backLinks: audit.interactions.backLinks?.adoption === '/adoptions'
    && audit.interactions.backLinks?.works === '/works',
  noJavaScript: audit.interactions.noJavaScript?.headingVisible === true
    && audit.interactions.noJavaScript?.mainImageVisible === true
    && audit.interactions.noJavaScript?.backVisible === true,
}

await writeFile(
  resolve(outputDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)
await browser.close()
if (Object.values(audit.checks).some(value => value !== true)) process.exitCode = 1

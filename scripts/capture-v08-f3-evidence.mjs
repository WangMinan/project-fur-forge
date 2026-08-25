import { chromium } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ffmpegPath from 'ffmpeg-static'

const baseURL = process.env.V08_F3_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V08-F3/after',
)
await mkdir(outputDirectory, { recursive: true })

const repairedMedia = {
  commission: 'dev/web/212e33ca-fbf9-5bca-9571-4fcba7c8e1b7/site-display-v2/commission-hero-landscape/1920/fe56ac913da175832d4e7462e1fd634a2e4bc45e15c7808a0392043dd50a3453.webp',
  homeSecond: 'dev/web/b6ed3c80-08e5-5f11-a8fc-da20edd471f3/site-display-v2/home-hero-landscape/1920/20b70d5431831a42da58873679d4bdba3ade9408ef15f753b786165cfd5a410e.webp',
}
const localMediaRoot = resolve('.data/public-media')
const mediaBackupRoot = resolve(
  '.data/backups/v08-f3-site-display-cover-20260824/public-media',
)

const executablePath = process.env.V08_F3_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  timeout: 15_000,
})
console.log('[V08-F3] browser launched')

function activeSlide(page) {
  return page.evaluate(() => (
    [...document.querySelectorAll('.home-hero__dot')]
      .findIndex(dot => dot.classList.contains('home-hero__dot--active'))
  ))
}

function solidVerticalEdgeBands(path) {
  const width = 192
  const height = 108
  const result = spawnSync(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', path,
    '-frames:v', '1',
    '-vf', `scale=${width}:${height}`,
    '-pix_fmt', 'rgb24',
    '-f', 'rawvideo',
    'pipe:1',
  ], { windowsHide: true })
  if (result.status !== 0 || result.stdout.length !== width * height * 3) {
    throw new Error(`Unable to sample media pixels: ${path}`)
  }
  const columnDeviation = (x) => {
    const values = []
    for (let y = 0; y < height; y += 1) {
      const offset = (y * width + x) * 3
      values.push(
        result.stdout[offset] * 0.2126
        + result.stdout[offset + 1] * 0.7152
        + result.stdout[offset + 2] * 0.0722,
      )
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    return Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length,
    )
  }
  const countSolid = indices => indices.findIndex(x => columnDeviation(x) >= 2)
  const left = countSolid(Array.from({ length: width }, (_, x) => x))
  const right = countSolid(Array.from({ length: width }, (_, x) => width - 1 - x))
  return {
    leftColumns: left < 0 ? width : left,
    rightColumns: right < 0 ? width : right,
    sampleWidth: width,
  }
}

function compareMediaEdgeBands(objectKey) {
  return {
    before: solidVerticalEdgeBands(resolve(mediaBackupRoot, objectKey)),
    after: solidVerticalEdgeBands(resolve(localMediaRoot, objectKey)),
  }
}

async function openHome(viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(15_000)
  page.setDefaultTimeout(15_000)
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="public-hero"]').waitFor()
  return { context, page }
}

async function inspectCommission(viewport, screenshotName) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(15_000)
  page.setDefaultTimeout(15_000)
  const response = await page.goto(new URL('/commission', baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  const hero = page.locator('[data-testid="commission-hero"]')
  await hero.waitFor()
  await page.locator('[data-testid="commission-hero"] img').waitFor()
  await page.screenshot({
    path: resolve(outputDirectory, screenshotName),
    fullPage: false,
  })
  const result = await hero.evaluate((element) => {
    const media = element.querySelector('.commission-lead__media')
    const picture = element.querySelector('.responsive-picture')
    const image = element.querySelector('img')
    const dimensions = (node) => {
      if (!node) return null
      const rect = node.getBoundingClientRect()
      return { height: rect.height, width: rect.width }
    }
    const imageStyle = image ? getComputedStyle(image) : null
    return {
      decoded: Boolean(image?.complete && image.naturalWidth > 0),
      image: dimensions(image),
      imageHeight: image?.naturalHeight ?? null,
      imageWidth: image?.naturalWidth ?? null,
      media: dimensions(media),
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      objectFit: imageStyle?.objectFit ?? null,
      picture: dimensions(picture),
      source: image?.currentSrc ?? null,
    }
  })
  await context.close()
  return { responseStatus: response?.status() ?? null, ...result }
}

async function captureResponsiveReview(pathname, prefix) {
  for (const capture of [
    { name: 'desktop-1280', viewport: { height: 800, width: 1280 } },
    { name: 'tablet-768', viewport: { height: 1024, width: 768 } },
    { name: 'mobile-375', viewport: { height: 812, width: 375 } },
  ]) {
    const context = await browser.newContext({ viewport: capture.viewport })
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(15_000)
    page.setDefaultTimeout(15_000)
    await page.goto(new URL(pathname, baseURL).href, { waitUntil: 'domcontentloaded' })
    await page.locator('main').waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
      for (let y = 0; y <= document.documentElement.scrollHeight; y += 500) {
        window.scrollTo(0, y)
        await wait(80)
      }
      window.scrollTo(0, 0)
      await wait(300)
    })
    await page.locator('img').evaluateAll(images => Promise.all(
      images.map(image => image.decode().catch(() => undefined)),
    ))
    await page.screenshot({
      path: resolve(outputDirectory, `review-${prefix}-${capture.name}.png`),
      fullPage: true,
    })
    await context.close()
  }
}

const audit = {
  capturedAt: new Date().toISOString(),
  commission: {},
  hero: {},
  mediaPixels: {},
}

{
  const { context, page } = await openHome({ width: 1440, height: 900 })
  const title = page.locator('.home-hero__title')
  await title.waitFor()
  audit.hero.titleEntrance = {
    start: await title.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        animationName: style.animationName,
        clipPath: style.clipPath,
        fontFamily: style.fontFamily,
        opacity: style.opacity,
        transform: style.transform,
      }
    }),
  }
  audit.hero.font = await page.evaluate(() => ({
    criticalLoaded: document.fonts.check(
      '600 96px "Zhuohei Collage Critical"',
      '有点小狗工作室',
    ),
    status: document.fonts.status,
  }))
  await page.waitForTimeout(850)
  audit.hero.titleEntrance.terminal = await title.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      animationName: style.animationName,
      clipPath: style.clipPath,
      fontFamily: style.fontFamily,
      opacity: style.opacity,
      transform: style.transform,
    }
  })
  await page.screenshot({ path: resolve(outputDirectory, 'home-1440x900.png'), fullPage: false })
  await page.locator('.home-hero__dot').nth(1).click({ force: true })
  await page.waitForFunction(() => (
    [...document.querySelectorAll('.home-hero__dot')]
      .findIndex(dot => dot.classList.contains('home-hero__dot--active')) === 1
  ))
  await page.waitForTimeout(750)
  await page.screenshot({ path: resolve(outputDirectory, 'home-second-1440x900.png'), fullPage: false })
  await context.close()
  console.log('[V08-F3] desktop home captured')
}

{
  const context = await browser.newContext({
    recordVideo: { dir: outputDirectory, size: { height: 900, width: 1440 } },
    viewport: { height: 900, width: 1440 },
  })
  const page = await context.newPage()
  const video = page.video()
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="public-hero"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(900)
  await context.close()
  if (video) {
    await video.saveAs(resolve(outputDirectory, 'home-refresh-title-stability.webm'))
    await video.delete()
  }
}

{
  const { context, page } = await openHome({ width: 390, height: 844 })
  await page.waitForTimeout(850)
  await page.screenshot({ path: resolve(outputDirectory, 'home-390x844.png'), fullPage: false })
  await page.locator('.home-hero__dot').nth(1).click({ force: true })
  await page.waitForFunction(() => (
    [...document.querySelectorAll('.home-hero__dot')]
      .findIndex(dot => dot.classList.contains('home-hero__dot--active')) === 1
  ))
  await page.waitForTimeout(750)
  await page.screenshot({ path: resolve(outputDirectory, 'home-second-390x844.png'), fullPage: false })
  await context.close()
  console.log('[V08-F3] mobile home captured')
}

{
  const context = await browser.newContext({
    recordVideo: { dir: outputDirectory, size: { height: 900, width: 1440 } },
    viewport: { height: 900, width: 1440 },
  })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(15_000)
  page.setDefaultTimeout(15_000)
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="public-hero"]').waitFor()
  await page.getByRole('button', { name: '暂停自动轮播' }).waitFor()
  await page.waitForTimeout(750)
  const first = await activeSlide(page)
  await page.waitForFunction(
    previous => [...document.querySelectorAll('.home-hero__dot')]
      .findIndex(dot => dot.classList.contains('home-hero__dot--active')) !== previous,
    first,
    { polling: 50, timeout: 6_000 },
  )
  const advanced = await activeSlide(page)
  await page.getByRole('button', { name: '暂停自动轮播' }).click({ force: true })
  const paused = await activeSlide(page)
  await page.waitForTimeout(4_300)
  const remainedPaused = await activeSlide(page)
  const resumeStartedAt = Date.now()
  await page.getByRole('button', { name: '继续自动轮播' }).click({ force: true })
  await page.waitForFunction(
    previous => [...document.querySelectorAll('.home-hero__dot')]
      .findIndex(dot => dot.classList.contains('home-hero__dot--active')) !== previous,
    remainedPaused,
    { polling: 50, timeout: 5_500 },
  )
  const resumeElapsedMs = Date.now() - resumeStartedAt
  const resumed = await activeSlide(page)
  const video = page.video()
  await context.close()
  if (video) {
    await video.saveAs(resolve(outputDirectory, 'hero-4s-autoplay-pause-resume.webm'))
    await video.delete()
  }
  audit.hero.autoplay = {
    advanced,
    first,
    paused,
    remainedPaused,
    resumeElapsedMs,
    resumed,
  }
  console.log('[V08-F3] autoplay captured')
}

audit.commission.desktop = await inspectCommission(
  { height: 900, width: 1440 },
  'commission-1440x900.png',
)
audit.commission.mobile = await inspectCommission(
  { height: 844, width: 390 },
  'commission-390x844.png',
)
console.log('[V08-F3] commission captured')

await captureResponsiveReview('/', 'home')
await captureResponsiveReview('/commission', 'commission')
console.log('[V08-F3] responsive review captured')

audit.mediaPixels.commission = compareMediaEdgeBands(repairedMedia.commission)
audit.mediaPixels.homeSecond = compareMediaEdgeBands(repairedMedia.homeSecond)

{
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { height: 844, width: 390 },
  })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(15_000)
  page.setDefaultTimeout(15_000)
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="public-hero"]').waitFor()
  audit.hero.reducedMotion = await page.evaluate(() => ({
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    titleAnimation: getComputedStyle(document.querySelector('.home-hero__title')).animationName,
  }))
  await context.close()
}

audit.checks = {
  autoplayAdvanced: audit.hero.autoplay.first !== audit.hero.autoplay.advanced,
  autoplayPaused: audit.hero.autoplay.paused === audit.hero.autoplay.remainedPaused,
  autoplayResumed: audit.hero.autoplay.remainedPaused !== audit.hero.autoplay.resumed,
  autoplayResumeTiming: audit.hero.autoplay.resumeElapsedMs >= 3_800
    && audit.hero.autoplay.resumeElapsedMs <= 5_000,
  commissionDesktopFilled: audit.commission.desktop.decoded
    && audit.commission.desktop.objectFit === 'cover'
    && audit.commission.desktop.image.width === audit.commission.desktop.media.width
    && audit.commission.desktop.image.height === audit.commission.desktop.media.height,
  commissionMobileFilled: audit.commission.mobile.decoded
    && audit.commission.mobile.objectFit === 'cover'
    && audit.commission.mobile.image.width === audit.commission.mobile.media.width
    && audit.commission.mobile.image.height === audit.commission.mobile.media.height,
  commissionNoOverflow: audit.commission.desktop.noHorizontalOverflow
    && audit.commission.mobile.noHorizontalOverflow,
  titleEntrancePreserved: audit.hero.titleEntrance.start.animationName.includes('home-hero-title-in')
    && audit.hero.titleEntrance.terminal.opacity === '1'
    && ['inset(0px)', 'inset(0px 0px 0%)'].includes(audit.hero.titleEntrance.terminal.clipPath)
    && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(audit.hero.titleEntrance.terminal.transform)
    && audit.hero.font.criticalLoaded
    && audit.hero.font.status === 'loaded',
  mediaPixelBandsRemoved: Object.values(audit.mediaPixels).every(result => (
    result.before.leftColumns + result.before.rightColumns >= 20
    && result.after.leftColumns + result.after.rightColumns <= 2
  )),
  reducedMotion: audit.hero.reducedMotion.matches
    && audit.hero.reducedMotion.titleAnimation === 'none',
}

await writeFile(resolve(outputDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
await browser.close()
console.log('[V08-F3] evidence complete')

if (Object.values(audit.checks).some(value => !value)) {
  throw new Error('V08-F3 evidence checks failed.')
}

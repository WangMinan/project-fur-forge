import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.V12_F_BASE_URL ?? 'http://127.0.0.1:3000/'
const verify = process.argv.includes('--verify')
const output = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V12-F/after',
)
await mkdir(output, { recursive: true })

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
]
const scenes = {
  hero: '.home-hero',
  featured: '.featured-works',
  commission: '.home-commission',
  adoption: '.home-adoptions',
}
const audit = {
  capturedAt: new Date().toISOString(),
  viewports: {},
  motion: {},
}

async function settle(page) {
  await page.locator('[data-testid="public-home"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.locator('img').evaluateAll(async images => Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await Promise.race([
        new Promise(resolveLoad => {
          image.addEventListener('load', resolveLoad, { once: true })
          image.addEventListener('error', resolveLoad, { once: true })
        }),
        new Promise(resolveTimeout => setTimeout(resolveTimeout, 2000)),
      ])
    }
    if (image.naturalWidth > 0)
      await image.decode()
  })))
}

async function shot(locator, name) {
  await locator.scrollIntoViewIfNeeded()
  await locator.screenshot({
    animations: 'disabled',
    path: resolve(output, `${name}.png`),
  })
}

async function inspect(page, viewport) {
  return page.evaluate(({ sceneSelectors, viewportHeight }) => {
    const rootWidth = document.documentElement.clientWidth
    const sceneEntries = Object.entries(sceneSelectors).map(([name, selector]) => {
      const element = document.querySelector(selector)
      if (!element)
        return [name, { missing: true }]
      const rect = element.getBoundingClientRect()
      const interactive = [...element.querySelectorAll('button, a')]
        .filter(node => getComputedStyle(node).display !== 'none')
        .map((node) => {
          const bounds = node.getBoundingClientRect()
          return {
            label: node.getAttribute('aria-label') ?? node.textContent?.trim() ?? '',
            height: bounds.height,
            width: bounds.width,
            contained: bounds.left >= -1 && bounds.right <= rootWidth + 1,
          }
        })
      return [name, {
        height: rect.height,
        fitsViewport: rect.height <= viewportHeight + 1,
        scrollWidth: element.scrollWidth,
        interactive,
      }]
    })
    const title = document.querySelector('.home-hero__title')
    const titleStyle = title ? getComputedStyle(title) : null
    const featuredMedia = document.querySelector('.featured-works__media')
    const featuredImage = featuredMedia?.querySelector('.responsive-picture__image')
    const adoptionStepper = document.querySelector('.home-adoption-poster__stepper')
    const adoptionFolio = document.querySelector('.home-adoption-poster__folio')
    const stepperRect = adoptionStepper?.getBoundingClientRect()
    const folioRect = adoptionFolio?.getBoundingClientRect()
    return {
      noHorizontalOverflow: document.documentElement.scrollWidth <= rootWidth,
      scenes: Object.fromEntries(sceneEntries),
      allTargetsAtLeast44: sceneEntries.every(([, scene]) => (
        scene.missing || scene.interactive.every(target => target.height >= 43.9)
      )),
      allTargetsContained: sceneEntries.every(([, scene]) => (
        scene.missing || scene.interactive.every(target => target.contained)
      )),
      allImagesDecoded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
      hero: {
        reduced: document.querySelector('.home-hero')?.getAttribute('data-reduced-motion'),
        titleFont: titleStyle?.fontFamily ?? null,
        titleSize: titleStyle?.fontSize ?? null,
        titleWeight: titleStyle?.fontWeight ?? null,
        titleLineHeight: titleStyle?.lineHeight ?? null,
        titleLetterSpacing: titleStyle?.letterSpacing ?? null,
        titleAnimation: titleStyle?.animationName ?? null,
        continuationVisible: Boolean(document.querySelector('.home-hero__continuation')?.getBoundingClientRect().height),
        fontReady: document.fonts.check('600 40px "Zhuohei Collage Critical"', '有点小狗工作室'),
      },
      featured: {
        canvasRadius: featuredMedia ? getComputedStyle(featuredMedia).borderRadius : null,
        imageRadius: featuredImage ? getComputedStyle(featuredImage).borderRadius : null,
      },
      adoption: {
        stepperFolioCenterDelta: stepperRect && folioRect
          ? Math.abs((stepperRect.top + stepperRect.height / 2) - (folioRect.top + folioRect.height / 2))
          : null,
        selectorCount: document.querySelectorAll('.home-adoption-poster__selector-item').length,
      },
    }
  }, {
    sceneSelectors: scenes,
    viewportHeight: viewport.height,
  })
}

async function applyLongCopy(page) {
  const replacements = {
    '.home-hero__tagline': '不只做小狗毛，也认真完成每一处角色表情与毛流细节',
    '.featured-works__title': '暮光森林守望者返图记录',
    '.featured-works__species': '高山雪原幻想兽',
    '.home-commission__process': '先通过站内表单完整提交角色设定、制作范围与时间需求。工作室完成评估后，再通过官方 QQ 私聊逐项确认排期与制作细节。',
    '.home-adoption-poster__identity h3': '青岚森林守望者领养测试',
  }
  for (const [selector, text] of Object.entries(replacements))
    await page.locator(selector).evaluate((element, value) => { element.textContent = value }, text)
  await page.locator('.home-adoption-poster__identity')
    .evaluate(element => element.classList.add('home-adoption-poster__identity--long-name'))
  const facts = page.locator('.home-adoption-poster__facts dd')
  await facts.first().evaluate((element) => { element.textContent = '幻想兽族' })
  if (await facts.count() > 1)
    await facts.nth(1).evaluate((element) => { element.textContent = '¥12,888' })
  await page.locator('.home-adoption-poster__selector-item strong')
    .evaluateAll(elements => elements.forEach((element, index) => {
      element.textContent = `青岚森林守望者领养测试${index + 1}`
    }))
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await settle(page)

  for (const [name, selector] of Object.entries(scenes))
    await shot(page.locator(selector), `${name}-default-${viewport.name}`)
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: resolve(output, `homepage-boundary-${viewport.name}.png`),
  })

  await page.getByRole('button', { name: '下一项' }).click()
  await shot(page.locator(scenes.featured), `featured-multi-next-${viewport.name}`)
  await page.getByRole('button', { name: '下一个领养角色' }).click()
  await shot(page.locator(scenes.adoption), `adoption-multi-next-${viewport.name}`)

  await applyLongCopy(page)
  for (const name of ['hero', 'featured', 'commission', 'adoption'])
    await shot(page.locator(scenes[name]), `${name}-long-copy-${viewport.name}`)

  audit.viewports[viewport.name] = {
    ...await inspect(page, viewport),
    errors,
  }
  await context.close()
}

const motionContext = await browser.newContext({
  viewport: viewports[0],
  reducedMotion: 'no-preference',
})
const motionPage = await motionContext.newPage()
await motionPage.goto(baseURL, { waitUntil: 'domcontentloaded' })
await settle(motionPage)
const before = await motionPage.locator('.home-hero__live').innerText()
const titleAnimationStart = await motionPage.locator('.home-hero__title')
  .evaluate(element => element.getAnimations()[0]?.startTime ?? null)
await motionPage.waitForTimeout(4_300)
const after = await motionPage.locator('.home-hero__live').innerText()
const titleAnimationStartAfter = await motionPage.locator('.home-hero__title')
  .evaluate(element => element.getAnimations()[0]?.startTime ?? null)
audit.motion = {
  before,
  after,
  autoplayAdvancedAt4s: before !== after,
  titleEntranceDidNotRestart: titleAnimationStart === titleAnimationStartAfter,
}
await motionContext.close()
await browser.close()

const viewportAudits = Object.values(audit.viewports)
audit.checks = {
  bothViewports: viewportAudits.length === 2,
  noHorizontalOverflow: viewportAudits.every(result => result.noHorizontalOverflow),
  fourScenesFit: viewportAudits.every(result => (
    Object.values(result.scenes).every(scene => !scene.missing && scene.fitsViewport)
  )),
  touchTargets: viewportAudits.every(result => (
    result.allTargetsAtLeast44 && result.allTargetsContained
  )),
  imagesDecoded: viewportAudits.every(result => result.allImagesDecoded),
  heroBrandLock: viewportAudits.every(result => (
    result.hero.titleFont.includes('Zhuohei Collage Critical')
    && result.hero.titleWeight === '600'
    && ['normal', '0px'].includes(result.hero.titleLetterSpacing)
    && result.hero.reduced === 'true'
    && result.hero.titleAnimation === 'none'
    && result.hero.continuationVisible
    && result.hero.fontReady
  )),
  sharedRadii: viewportAudits.every(result => (
    result.featured.canvasRadius === '12px'
    && result.featured.imageRadius === '8px'
  )),
  adoptionControlRow: viewportAudits.every(result => (
    result.adoption.selectorCount === 3
    && result.adoption.stepperFolioCenterDelta < 1
  )),
  motionFactsPreserved: audit.motion.autoplayAdvancedAt4s
    && audit.motion.titleEntranceDidNotRestart,
  noRuntimeErrors: viewportAudits.every(result => result.errors.length === 0),
}

await writeFile(
  resolve(output, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)
console.log(JSON.stringify(audit.checks, null, 2))
if (verify && !Object.values(audit.checks).every(Boolean))
  process.exitCode = 1

import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const baseURL = process.env.V02_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  'agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V02',
)
await mkdir(outputDirectory, { recursive: true })

const executablePath = process.env.V02_BROWSER_PATH ?? [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync)
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
})
const audit = { capturedAt: new Date().toISOString(), viewports: {}, checks: {} }

async function capture(name, viewport, selector, route = '/') {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(350)
  const section = page.locator(selector)
  await section.waitFor({ state: 'visible' })
  await section.scrollIntoViewIfNeeded()
  await page.waitForFunction((targetSelector) => {
    const images = [...document.querySelectorAll(`${targetSelector} img`)]
    return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0)
  }, selector)
  await section.screenshot({ path: resolve(outputDirectory, `${name}.png`) })
  audit.viewports[name] = await section.evaluate(element => {
    const images = [...element.querySelectorAll('img')]
    const media = element.querySelector(
      '.home-commission__media, .home-adoption-poster__media, .commission-lead__media',
    )
    const image = images[0]
    return {
      imageDecoded: Boolean(image?.complete && image.naturalWidth > 0),
      imageObjectFit: image ? getComputedStyle(image).objectFit : null,
      mediaHeight: media?.getBoundingClientRect().height ?? 0,
      text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })
  await context.close()
}

for (const viewport of [
  { width: 1440, height: 900, label: 'desktop-1440x900' },
  { width: 390, height: 844, label: 'mobile-390x844' },
  { width: 430, height: 932, label: 'mobile-430x932' },
]) {
  await capture(`commission-${viewport.label}`, viewport, '[data-testid="home-business-entries"]')
  await capture(`adoption-${viewport.label}`, viewport, '[data-testid="home-current-adoptions"]')
}

await capture(
  'commission-page-mobile-390x844',
  { width: 390, height: 844 },
  '[data-testid="commission-hero"]',
  '/commission',
)

audit.checks = {
  noHorizontalOverflow: Object.values(audit.viewports)
    .every(view => view.scrollWidth <= view.clientWidth + 1),
  allImagesDecoded: Object.values(audit.viewports)
    .every(view => view.imageDecoded),
  adoptionUsesContain: Object.entries(audit.viewports)
    .filter(([name]) => name.startsWith('adoption-'))
    .every(([, view]) => view.imageObjectFit === 'contain'),
  commissionHasActions: Object.values(audit.viewports)
    .filter(view => view.text.includes('提交委托申请'))
    .length >= 4,
  adoptionHasIdentityAndActions: Object.values(audit.viewports)
    .filter(view => view.text.includes('查看当前角色') && view.text.includes('浏览设定领养'))
    .length >= 3,
}

await writeFile(
  resolve(outputDirectory, 'audit.json'),
  `${JSON.stringify(audit, null, 2)}\n`,
  'utf8',
)
await browser.close()
if (Object.values(audit.checks).some(value => value !== true)) {
  process.exitCode = 1
}

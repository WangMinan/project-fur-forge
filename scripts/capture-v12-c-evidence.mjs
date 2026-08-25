import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const mode = process.argv.includes('--before') ? 'before' : 'after'
const verify = process.argv.includes('--verify')
const baseURL = process.env.V12_C_BASE_URL ?? 'http://127.0.0.1:3000/'
const evidenceDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V12-C/${mode}`,
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
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
]

async function openApply(page) {
  const response = await page.goto(new URL('/commission/apply', baseURL).href, {
    waitUntil: 'networkidle',
  })
  await page.locator('[data-testid="commission-apply-page"]').waitFor()
  return response
}

async function capturePage(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: resolve(evidenceDirectory, `${name}.png`),
    fullPage: true,
  })
}

async function fillValid(page, { file = true } = {}) {
  await page.getByLabel(/称呼/u).fill('证据申请人')
  await page.getByLabel(/物种/u).fill('犬科')
  await page.getByLabel(/中国大陆手机号/u).fill('19900000009')
  await page.getByLabel(/^QQ/u).fill('765678159')
  await page.getByLabel(/身高/u).fill('170')
  await page.getByLabel(/体重/u).fill('60.5')
  if (file) {
    await page.locator('#commission-design-reference').setInputFiles(resolve('public/brand/og-default.png'))
    await page.getByText('og-default.png', { exact: true }).waitFor()
  }
  await page.getByLabel(/已年满 18 周岁/u).check()
  await page.getByLabel(/已阅读《隐私政策》/u).check()
}

const audit = { mode, capturedAt: new Date().toISOString(), routes: {}, states: {}, interactions: {} }

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const response = await openApply(page)
  await capturePage(page, `commission-apply-${viewport.name}`)
  audit.routes[viewport.name] = await page.evaluate((status) => ({
    status,
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    imageCount: document.images.length,
    imagesDecoded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
    fieldColumns: getComputedStyle(document.querySelector('.commission-apply__fields')).gridTemplateColumns,
  }), response?.status() ?? null)
  await context.close()
}

if (mode === 'after') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await openApply(page)
  await page.getByLabel(/称呼/u).fill('部分填写')
  await page.getByLabel(/物种/u).fill('犬科')
  await capturePage(page, 'commission-apply-partial-390x844')
  audit.states.partial = true

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '确认提交' }).click()
  await page.locator('[data-testid="commission-apply-validation-summary"]').waitFor()
  await capturePage(page, 'commission-apply-errors-390x844')
  audit.states.errors = await page.locator('.commission-apply__error').count()

  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('#commission-design-reference').setInputFiles(resolve('public/brand/og-default.png'))
  await page.getByText('og-default.png', { exact: true }).waitFor()
  await capturePage(page, 'commission-apply-ready-390x844')
  audit.states.ready = await page.getByAltText('所选设定图预览').isVisible()
  await context.close()

  const flowContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const flowPage = await flowContext.newPage()
  const sessionId = '11111111-1111-4111-8111-111111111111'
  const assetId = '22222222-2222-4222-8222-222222222222'
  const token = 'A'.repeat(43)
  const createdAt = '2026-08-25T00:00:00.000Z'
  const expiresAt = '2026-08-26T00:00:00.000Z'
  let submissionCount = 0
  await flowPage.route('**/api/public/v1/commission-upload-sessions', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      session: {
        uploadSessionId: sessionId,
        status: 'AWAITING_UPLOAD',
        version: 1,
        failureCode: null,
        failureStage: null,
        assetId: null,
        createdAt,
        expiresAt,
      },
      token,
      upload: {
        method: 'PUT',
        url: new URL('/__v12-c-upload', baseURL).href,
        expiresAt,
        headers: { 'Content-Type': 'image/png', 'Content-MD5': 'AAAAAAAAAAAAAAAAAAAAAA==', 'x-oss-meta-sha256': 'a'.repeat(64), 'x-oss-forbid-overwrite': 'true' },
      },
    } }),
  }))
  await flowPage.route('**/__v12-c-upload', route => route.fulfill({ status: 200, body: '' }))
  await flowPage.route('**/api/public/v1/commission-upload-sessions/*/complete', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { session: {
      uploadSessionId: sessionId,
      status: 'COMPLETED',
      version: 2,
      failureCode: null,
      failureStage: null,
      assetId,
      createdAt,
      expiresAt,
    } } }),
  }))
  await flowPage.route('**/api/public/v1/commission-submissions', route => {
    submissionCount += 1
    if (submissionCount === 1) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL_ERROR","message":"test"}}' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{"receiptCode":"DITE-V12-C"}}' })
  })
  await openApply(flowPage)
  await fillValid(flowPage)
  await flowPage.getByRole('button', { name: '确认提交' }).click()
  await flowPage.getByText('暂时无法提交。表单和图片仍保留在本页，请稍后重试。').waitFor()
  await capturePage(flowPage, 'commission-apply-submit-error-390x844')
  audit.states.submitError = await flowPage.getByAltText('所选设定图预览').isVisible()
  await flowPage.getByRole('button', { name: '确认提交' }).click()
  await flowPage.getByText('申请已收到').waitFor()
  await capturePage(flowPage, 'commission-apply-success-390x844')
  audit.states.success = await flowPage.getByText('DITE-V12-C', { exact: true }).isVisible()
  await flowContext.close()

  const unavailableContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const unavailablePage = await unavailableContext.newPage()
  await unavailablePage.route('**/api/public/v1/site-content', async route => {
    const response = await route.fetch()
    const body = await response.json()
    body.data.about.privacyPolicy = null
    await route.fulfill({ response, json: body })
  })
  await unavailablePage.goto(new URL('/commission', baseURL).href, { waitUntil: 'domcontentloaded' })
  await unavailablePage.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__))
  await unavailablePage.getByRole('link', { name: '提交委托申请', exact: true }).first().click({
    noWaitAfter: true,
  })
  await unavailablePage.locator('[data-testid="commission-apply-page"]').waitFor()
  await unavailablePage.getByText('委托申请暂不可提交').waitFor()
  await capturePage(unavailablePage, 'commission-apply-unavailable-390x844')
  audit.states.unavailable = await unavailablePage.locator('form').count() === 0
  await unavailableContext.close()

  const keyboardContext = await browser.newContext({ viewport: { width: 390, height: 500 } })
  const keyboardPage = await keyboardContext.newPage()
  await openApply(keyboardPage)
  const privacyCheckbox = keyboardPage.getByLabel(/已阅读《隐私政策》/u)
  await privacyCheckbox.scrollIntoViewIfNeeded()
  await privacyCheckbox.focus()
  audit.interactions.softKeyboard = await privacyCheckbox.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { focused: document.activeElement === element, top: rect.top, bottom: rect.bottom, viewport: innerHeight }
  })
  await keyboardPage.screenshot({
    path: resolve(evidenceDirectory, 'commission-apply-soft-keyboard-390x500.png'),
  })
  await keyboardContext.close()

  audit.checks = {
    allRoutes200: Object.values(audit.routes).every(route => route.status === 200),
    allImagesDecoded: Object.values(audit.routes).every(route => route.imagesDecoded),
    noHorizontalOverflow: Object.values(audit.routes).every(route => route.noHorizontalOverflow),
    desktopFieldColumns: audit.routes['1440x900'].fieldColumns.split(' ').length === 2,
    mobileFieldColumn: audit.routes['390x844'].fieldColumns.split(' ').length === 1,
    validationSummary: audit.states.errors > 0,
    preview: audit.states.ready,
    retainedAfterError: audit.states.submitError,
    successReceipt: audit.states.success,
    unavailable: audit.states.unavailable,
    softKeyboardSafe: audit.interactions.softKeyboard.focused
      && audit.interactions.softKeyboard.top >= 0
      && audit.interactions.softKeyboard.bottom <= audit.interactions.softKeyboard.viewport,
  }
}

await writeFile(resolve(evidenceDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
await browser.close()

if (verify && Object.values(audit.checks ?? {}).some(value => !value)) {
  throw new Error('V12-C evidence checks failed.')
}

console.log(`[V12-C] ${mode} evidence complete`)

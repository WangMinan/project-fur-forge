import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const mode = process.argv[2] === 'before' ? 'before' : 'after'
const baseURL = process.env.V08_BASE_URL ?? 'http://127.0.0.1:3000/'
const outputDirectory = resolve(
  `agent_docs/需求4-站点视觉升级与内容合规/implementation/evidence/V08/${mode}`,
)
const reviewDirectory = resolve('agent_docs/需求4-站点视觉升级与内容合规/.design/screenshots')
await mkdir(outputDirectory, { recursive: true })
await mkdir(reviewDirectory, { recursive: true })

const executablePath = process.env.V08_BROWSER_PATH ?? [
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

async function gotoApply(page) {
  const response = await page.goto(new URL('/commission/apply', baseURL).href, {
    waitUntil: 'domcontentloaded',
  })
  await page.locator('[data-testid="commission-apply-page"]').waitFor()
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => Boolean(
    document.querySelector('#__nuxt')?.__vue_app__,
  ))
  return response
}

async function reloadApply(page) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="commission-apply-page"]').waitFor()
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => Boolean(
    document.querySelector('#__nuxt')?.__vue_app__,
  ))
}

async function captureFullPage(page, path) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path, fullPage: true })
}

async function capture(viewport, directory = outputDirectory, name = `commission-apply-${viewport.name}`) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const response = await gotoApply(page)
  await captureFullPage(page, resolve(directory, `${name}.png`))
  const result = await page.evaluate(() => ({
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    formVisible: Boolean(document.querySelector('form')),
  }))
  await context.close()
  return { status: response?.status() ?? null, ...result }
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
  audit.routes[viewport.name] = await capture(viewport)
}

if (mode === 'after') {
  for (const viewport of [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1280', width: 1280, height: 800 },
  ]) {
    audit.routes[`review-${viewport.name}`] = await capture(
      viewport,
      reviewDirectory,
      `review-commission-apply-${viewport.name}`,
    )
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__v08Cls = 0
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        if (!entry.hadRecentInput) window.__v08Cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await gotoApply(page)

  await page.getByLabel(/称呼/u).fill('部分填写')
  await page.getByLabel(/物种/u).fill('犬科')
  await captureFullPage(page, resolve(outputDirectory, 'commission-apply-partial-390x844.png'))
  audit.states.partial = { captured: true }

  await reloadApply(page)
  await page.getByRole('button', { name: '确认提交' }).click()
  await page.locator('[data-testid="commission-apply-validation-summary"]').waitFor()
  await captureFullPage(page, resolve(outputDirectory, 'commission-apply-errors-390x844.png'))
  audit.states.errors = await page.evaluate(() => ({
    count: document.querySelectorAll('.commission-apply__error:not(:empty)').length,
    emptySlots: document.querySelectorAll('.commission-apply__error:empty').length,
    cls: window.__v08Cls,
  }))

  await reloadApply(page)
  await fillValid(page, { file: false })
  await page.locator('#commission-design-reference').setInputFiles({
    name: 'invalid.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  })
  await page.getByText('invalid.png', { exact: true }).waitFor()
  await page.getByRole('button', { name: '确认提交' }).click()
  const fileError = page.locator('#commission-design-reference-error')
  await fileError.waitFor()
  if (await fileError.textContent() !== '请选择可正常解码的 JPEG、PNG 或 WebP 图片') {
    throw new Error('Unexpected rejected-file message')
  }
  await captureFullPage(page, resolve(outputDirectory, 'commission-apply-file-rejected-390x844.png'))
  audit.states.fileRejected = { visible: true }

  await page.locator('#commission-design-reference').setInputFiles(resolve('public/brand/og-default.png'))
  await page.getByText('og-default.png', { exact: true }).waitFor()
  await captureFullPage(page, resolve(outputDirectory, 'commission-apply-ready-390x844.png'))
  audit.states.ready = { visible: true }

  const sessionId = '11111111-1111-4111-8111-111111111111'
  const assetId = '22222222-2222-4222-8222-222222222222'
  const token = 'A'.repeat(43)
  const createdAt = '2026-08-23T00:00:00.000Z'
  const expiresAt = '2026-08-24T00:00:00.000Z'
  let releaseUpload
  let releaseValidation
  let releaseSubmission
  const uploadGate = new Promise(resolvePromise => releaseUpload = resolvePromise)
  const validationGate = new Promise(resolvePromise => releaseValidation = resolvePromise)
  const submissionGate = new Promise(resolvePromise => releaseSubmission = resolvePromise)
  let submissionCount = 0
  await page.route('**/api/public/v1/commission-upload-sessions', route => route.fulfill({
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
        url: new URL('/__v08-upload', baseURL).href,
        expiresAt,
        headers: {
          'Content-Type': 'image/png',
          'Content-MD5': 'AAAAAAAAAAAAAAAAAAAAAA==',
          'x-oss-meta-sha256': 'a'.repeat(64),
          'x-oss-forbid-overwrite': 'true',
        },
      },
    } }),
  }))
  await page.route('**/__v08-upload', async (route) => {
    await uploadGate
    await route.fulfill({ status: 200, body: '' })
  })
  await page.route('**/api/public/v1/commission-upload-sessions/*/complete', async (route) => {
    await validationGate
    await route.fulfill({
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
    })
  })
  await page.route('**/api/public/v1/commission-submissions', async (route) => {
    submissionCount += 1
    if (submissionCount === 1) {
      await submissionGate
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL_ERROR","message":"test"}}' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"data":{"receiptCode":"DITE-EVIDENCE-08"}}',
    })
  })

  await page.getByRole('button', { name: '确认提交' }).click()
  await page.getByText(/正在上传私有设定图/u).waitFor()
  await captureFullPage(page, resolve(outputDirectory, 'commission-apply-uploading-390x844.png'))
  audit.states.uploading = { visible: true }
  releaseUpload()
  await page.getByText('正在核验图片…').waitFor()
  await captureFullPage(page, resolve(outputDirectory, 'commission-apply-validating-390x844.png'))
  audit.states.validating = { visible: true }
  releaseValidation()
  await page.getByText('正在提交申请…').waitFor()
  await captureFullPage(page, resolve(outputDirectory, 'commission-apply-submitting-390x844.png'))
  audit.states.submitting = { visible: true }
  releaseSubmission()
  await page.getByText('暂时无法提交。表单和图片仍保留在本页，请稍后重试。').waitFor()
  await captureFullPage(page, resolve(outputDirectory, 'commission-apply-submit-error-390x844.png'))
  audit.states.submitError = {
    imageRetained: await page.getByAltText('所选设定图预览').isVisible(),
  }
  await page.getByRole('button', { name: '确认提交' }).click()
  await page.getByText('申请已收到').waitFor()
  await captureFullPage(page, resolve(outputDirectory, 'commission-apply-success-390x844.png'))
  audit.states.success = {
    receipt: await page.getByText('DITE-EVIDENCE-08').textContent(),
  }

  await reloadApply(page)
  const firstInput = page.getByLabel(/称呼/u)
  await firstInput.focus()
  audit.interactions.keyboard = {
    focusVisible: await firstInput.evaluate(element => element.matches(':focus-visible')),
  }
  audit.interactions.targets = await page.evaluate(() => {
    const selectors = [
      '.commission-apply__field input',
      '.image-dropzone__picker',
      '.commission-apply__checkbox-row label',
      '.commission-apply__submit .public-action',
    ]
    return [...document.querySelectorAll(selectors.join(','))].map((element) => {
      const rect = element.getBoundingClientRect()
      return { height: rect.height, width: rect.width }
    })
  })
  await page.setViewportSize({ width: 390, height: 500 })
  const privacyCheckbox = page.getByLabel(/已阅读《隐私政策》/u)
  await privacyCheckbox.scrollIntoViewIfNeeded()
  await privacyCheckbox.focus()
  audit.interactions.softKeyboard = await privacyCheckbox.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { focused: document.activeElement === element, top: rect.top, bottom: rect.bottom, viewport: innerHeight }
  })
  await context.close()

  const unavailableContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const unavailablePage = await unavailableContext.newPage()
  await unavailablePage.route('**/api/public/v1/site-content', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.data.about.privacyPolicy = null
    await route.fulfill({ response, json: body })
  })
  await unavailablePage.goto(new URL('/commission', baseURL).href, { waitUntil: 'domcontentloaded' })
  await unavailablePage.waitForFunction(() => Boolean(
    document.querySelector('#__nuxt')?.__vue_app__,
  ))
  await unavailablePage.getByRole('link', { name: '提交委托申请', exact: true }).first().click({
    noWaitAfter: true,
  })
  await unavailablePage.locator('[data-testid="commission-apply-page"]').waitFor()
  await unavailablePage.getByText('委托申请暂不可提交').waitFor()
  await captureFullPage(unavailablePage, resolve(outputDirectory, 'commission-apply-unavailable-390x844.png'))
  audit.states.unavailable = { formHidden: await unavailablePage.locator('form').count() === 0 }
  await unavailableContext.close()

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const touchPage = await touchContext.newPage()
  await gotoApply(touchPage)
  const adultLabel = touchPage.locator('label[for="commission-adult-confirmed"]')
  await adultLabel.tap()
  audit.interactions.touch = { checked: await touchPage.getByLabel(/已年满 18 周岁/u).isChecked() }
  await touchContext.close()

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const reducedPage = await reducedContext.newPage()
  await gotoApply(reducedPage)
  audit.interactions.reducedMotion = await reducedPage.evaluate(() => ({
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    runningAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length,
  }))
  await reducedContext.close()

  audit.checks = {
    allRoutes200: Object.values(audit.routes).every(route => route.status === 200),
    noHorizontalOverflow: Object.values(audit.routes).every(route => route.noHorizontalOverflow),
    formsVisible: Object.values(audit.routes).every(route => route.formVisible),
    allStates: ['partial', 'errors', 'fileRejected', 'ready', 'uploading', 'validating', 'submitting', 'submitError', 'success', 'unavailable']
      .every(state => Boolean(audit.states[state])),
    noEmptyErrorSlots: audit.states.errors.emptySlots === 0,
    lowCls: audit.states.errors.cls < 0.1,
    retainedAfterError: audit.states.submitError.imageRetained,
    successReceipt: audit.states.success.receipt === 'DITE-EVIDENCE-08',
    unavailable: audit.states.unavailable.formHidden,
    keyboardFocus: audit.interactions.keyboard.focusVisible,
    targets44: audit.interactions.targets.every(target => target.width >= 44 && target.height >= 44),
    softKeyboard: audit.interactions.softKeyboard.focused
      && audit.interactions.softKeyboard.top >= 0
      && audit.interactions.softKeyboard.bottom <= audit.interactions.softKeyboard.viewport,
    touch: audit.interactions.touch.checked,
    reducedMotion: audit.interactions.reducedMotion.matches
      && audit.interactions.reducedMotion.runningAnimations === 0,
  }
}

await writeFile(resolve(outputDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
await browser.close()

if (mode === 'after' && Object.values(audit.checks).some(value => !value)) {
  process.exitCode = 1
}

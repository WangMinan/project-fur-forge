import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from './helpers/auth'
import { createWorkViaApi } from './helpers/admin-work'
import {
  resetFakeMedia,
  seedBrandingStage,
  setFakeMediaFlags,
  smallStudioPng,
} from './helpers/fake-media'
import { capture } from './helpers/screenshots'

// 站点级 profile 与作品保护图是全局状态，同文件串行避免用例互相改写。
test.describe.configure({ mode: 'serial' })

const SCREENSHOT_DIR = resolve(
  process.cwd(),
  'agent_docs/需求1-兽装工作室主页/implementation/notes/gate07-watermark/screenshots',
)

function snap(page: import('@playwright/test').Page, name: string) {
  return capture(page, name, SCREENSHOT_DIR)
}

async function gotoBranding(page: import('@playwright/test').Page) {
  await page.goto(`${adminBaseURL}/admin/site/branding`)
  await page.waitForSelector('.branding')
}

const opacityRange = (page: import('@playwright/test').Page) =>
  page.locator('#watermark-opacity-range')
const opacityNumber = (page: import('@playwright/test').Page) =>
  page.getByLabel('不透明度数值（10 到 90）')
const scaleNumber = (page: import('@playwright/test').Page) =>
  page.getByLabel('缩放数值（20 到 90）')
const refreshButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /保存并(?:启用水印|刷新全站)/, exact: true })
const operationRegion = (page: import('@playwright/test').Page) =>
  page.getByTestId('watermark-operation')

async function prepareOpacity(
  page: import('@playwright/test').Page,
  opacity: number,
  options: { keepSelection?: boolean } = {},
) {
  if (!options.keepSelection) {
    await page.locator('.branding-candidate', { hasText: '当前使用' }).click()
  }
  await opacityRange(page).fill(String(opacity))
  await expect(refreshButton(page)).toBeEnabled()
}

async function submitRefresh(page: import('@playwright/test').Page) {
  const label = (await refreshButton(page).textContent())?.trim() ?? ''
  await refreshButton(page).click()
  const dialog = page.getByRole('dialog', { name: `${label}？` })
  await expect(dialog).toContainText('切换前旧作品图保持可用')
  const response = page.waitForResponse(item =>
    item.url().endsWith('/api/admin/v1/site/branding/watermark')
    && item.request().method() === 'PUT',
  )
  await dialog.getByRole('button', { name: label }).click()
  expect((await response).status()).toBe(200)
}

async function saveAndRefreshWithOpacity(
  page: import('@playwright/test').Page,
  opacity: number,
  options: { keepSelection?: boolean } = {},
) {
  await prepareOpacity(page, opacity, options)
  await submitRefresh(page)
  await expect(operationRegion(page)).toContainText('已完成', { timeout: 20_000 })
  await expect(page.locator('.branding-active')).toContainText(
    new RegExp(`不透明度\\s*${opacity}%`),
  )
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await resetFakeMedia(page)
})

test.afterEach(async ({ page }) => {
  await resetFakeMedia(page)
})

test('未认证访问被重定向到登录页，品牌读写 API 返回 401', async ({ browser }) => {
  const context = await browser.newContext()
  const anonymous = await context.newPage()
  await anonymous.goto(`${adminBaseURL}/admin/site/branding`)
  await anonymous.waitForURL(/\/admin\/login/)
  const getResponse = await anonymous.request.get(
    `${adminBaseURL}/api/admin/v1/site/branding/watermark`,
  )
  const putResponse = await anonymous.request.put(
    `${adminBaseURL}/api/admin/v1/site/branding/watermark`,
    { data: { expectedVersion: 1, payload: {} } },
  )
  expect(getResponse.status()).toBe(401)
  expect(putResponse.status()).toBe(401)
  await context.close()
})

test('活动配置紧凑展示，品牌页不再提供真实预览或应用前置门槛', async ({ page }) => {
  await gotoBranding(page)

  await expect(page.getByRole('link', { name: '全局水印' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const active = page.locator('.branding-active')
  await expect(active).toContainText('brand-centered-v2')
  await expect(active).toContainText(/不透明度\s*50%/)
  await expect(active).toContainText(/缩放\s*60%/)
  await expect(active).toContainText('居中')
  const activeImage = active.locator('img')
  await expect(activeImage).toHaveJSProperty('complete', true)
  expect(await activeImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)

  await expect(opacityRange(page)).toHaveValue('50')
  await expect(page.locator('#watermark-scale-range')).toHaveValue('60')
  await expect(page.locator('.branding-params')).toContainText('居中（固定）')
  await expect(page.getByRole('heading', { name: '真实预览' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /生成真实预览|应用草稿到全站/ })).toHaveCount(0)
  await expect(page.locator('.branding-preview__figure')).toHaveCount(0)
  await expect(page.getByText(/预览后才能|需要先.*预览/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /关闭水印|禁用水印/ })).toHaveCount(0)
  await expect(page.getByLabel(/水印安全角/)).toHaveCount(0)
  await expect(refreshButton(page)).toBeDisabled()
  await snap(page, 'branding-single-flow-initial-1440x900')
})

test('上传透明 PNG 后一次确认即保存并刷新，不留下待处理草稿', async ({ page }) => {
  await gotoBranding(page)

  await page.getByLabel('选择水印 Logo 文件').setInputFiles({
    name: 'new-logo.png',
    mimeType: 'image/png',
    buffer: smallStudioPng(),
  })
  await page.getByRole('button', { name: '上传候选' }).click()

  const candidates = page.locator('.branding-candidate')
  await expect(candidates).toHaveCount(2)
  const newest = candidates.first()
  await expect(newest.locator('input[type=radio]')).toBeChecked()
  await expect(newest.locator('img')).toHaveAttribute('src', /^\/api\/admin\//)

  await saveAndRefreshWithOpacity(page, 55, { keepSelection: true })
  await expect(newest).toContainText('当前使用')
  await expect(page.getByText('草稿', { exact: true })).toHaveCount(0)
  await expect(refreshButton(page)).toBeDisabled()
  await snap(page, 'branding-upload-and-refresh-1440x900')
})

test('非法参数本地拦截，数字输入与滑块同步', async ({ page }) => {
  await gotoBranding(page)

  await opacityNumber(page).fill('5')
  await opacityNumber(page).press('Tab')
  const error = page.locator('#watermark-params-error')
  await expect(error).toContainText('不透明度需为 10–90 的整数')
  await expect(opacityNumber(page)).toHaveAttribute('aria-invalid', 'true')
  await expect(refreshButton(page)).toBeDisabled()
  await expect(page.locator('.branding-apply')).toContainText('请先修正水印参数')

  await opacityNumber(page).fill('66')
  await opacityNumber(page).press('Tab')
  await expect(error).toHaveCount(0)
  await expect(opacityRange(page)).toHaveValue('66')
  await expect(refreshButton(page)).toBeEnabled()

  await page.locator('#watermark-scale-range').fill('45')
  await expect(scaleNumber(page)).toHaveValue('45')
})

test('已有作品一次请求启动原子切换，展示影响、进度并阻止重复提交', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)
  await prepareOpacity(page, 57)

  const applyCard = page.locator('.branding-apply')
  await expect(applyCard).toContainText('受影响已发布作品')
  await expect(applyCard).toContainText('需要重做的作品保护图')
  await expect(applyCard).toContainText('不受影响的站点无水印图')
  await expect(applyCard).toContainText('准备保存')

  await submitRefresh(page)
  await expect(operationRegion(page).getByRole('progressbar', {
    name: /全站水印应用进度/,
  })).toBeVisible()
  await expect(operationRegion(page)).toContainText('已完成', { timeout: 20_000 })
  await expect(operationRegion(page)).toContainText('待清理 0')
  await expect(page.locator('.branding-active')).toContainText(/不透明度\s*57%/)
  await expect(refreshButton(page)).toBeDisabled()
  await snap(page, 'branding-refreshed-1440x900')
})

test('重新生成失败保持旧活动配置，持续显示并可重试', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)
  await prepareOpacity(page, 58)
  const previousOpacity = await page.locator('.branding-active__fact', {
    hasText: '不透明度',
  }).locator('dd').textContent()

  await setFakeMediaFlags(page, { failProcess: true })
  await submitRefresh(page)
  await expect(operationRegion(page)).toContainText('失败', { timeout: 20_000 })
  await expect(operationRegion(page)).toContainText(
    '公开图重新生成失败，当前公开站仍使用原水印配置，请重试。',
  )
  await expect(page.locator('.branding-active__fact', { hasText: '不透明度' }).locator('dd'))
    .toHaveText(previousOpacity ?? '')

  await setFakeMediaFlags(page, { failProcess: false })
  await operationRegion(page).getByRole('button', { name: '重试' }).click()
  await expect(operationRegion(page)).toContainText('已完成', { timeout: 20_000 })
  await expect(page.locator('.branding-active')).toContainText(/不透明度\s*58%/)
})

test('清理失败重载后保留新配置，重试只继续清理', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)
  await prepareOpacity(page, 59)

  await setFakeMediaFlags(page, { failDelete: true })
  await submitRefresh(page)
  await expect(operationRegion(page)).toContainText(
    '新水印已生效，但旧公开图未清理完，重试只会继续清理。',
    { timeout: 20_000 },
  )

  await page.reload()
  await page.waitForSelector('.branding')
  await expect(operationRegion(page)).toContainText('失败')
  await expect(page.locator('.branding-active')).toContainText(/不透明度\s*59%/)

  await setFakeMediaFlags(page, { failDelete: false })
  await operationRegion(page).getByRole('button', { name: '重试' }).click()
  await expect(operationRegion(page)).toContainText('已完成', { timeout: 20_000 })
  await expect(operationRegion(page)).toContainText('待清理 0')
})

test('品牌页 DOM 与图片 URL 不含私有 Key、Bucket、签名 URL 或预览对象', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)

  const dom = await page.content()
  for (const forbidden of [
    '/original/',
    '/preview/branding/',
    'x-oss-',
    'Signature=',
    'upload.test',
    'private-download.test',
    'e2e-fake-oss',
    'sys/saveas',
  ]) {
    expect(dom).not.toContain(forbidden)
  }
  const sources = await page.locator('.branding img').evaluateAll(images =>
    images.map(image => (image as HTMLImageElement).src),
  )
  expect(sources.length).toBeGreaterThan(0)
  for (const src of sources) {
    expect(new URL(src).origin).toBe(new URL(adminBaseURL).origin)
    expect(new URL(src).pathname).toMatch(/^\/api\/admin\//)
  }
})

test('作品编辑器承担可选真实水印预览，保存作品不要求返回品牌页', async ({ page }) => {
  const work = await createWorkViaApi(page, { characterName: '水印预览职责验证' })
  await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
  await page.waitForSelector('.editor-card')

  await expect(page.getByLabel('水印安全角')).toHaveCount(0)
  await page.getByLabel('选择出厂照文件').setInputFiles({
    name: 'studio.png',
    mimeType: 'image/png',
    buffer: smallStudioPng(),
  })
  await page.getByRole('button', { name: '上传出厂照' }).click()
  const card = page.locator('article.photo-card').first()
  await expect(card).toContainText('已就绪')
  const preview = card.getByTestId('watermarked-media-preview')
  await expect(preview).toContainText('使用当前站点水印')
  await preview.getByRole('button', { name: '生成预览' }).click()
  await expect(preview.locator('img')).toBeVisible()

  await card.getByLabel(/图片说明/).fill('预览职责验证图')
  await page.getByRole('button', { name: '保存出厂照' }).click()
  await expect(page.getByText('出厂照已保存。')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/admin/works/${work.id}$`))
})

test('三视口单列纵排且无横向溢出', async ({ page }) => {
  await seedBrandingStage(page)
  for (const [width, height, label] of [
    [390, 844, '390x844'],
    [768, 1024, '768x1024'],
    [1440, 900, '1440x900'],
  ] as const) {
    await page.setViewportSize({ width, height })
    await gotoBranding(page)
    await expect(page.locator('.branding-active')).toBeVisible()
    await expect(page.getByRole('heading', { name: '真实预览' })).toHaveCount(0)
    const workspaceLayout = await page.locator('.branding__workspace').evaluate(element => ({
      columns: getComputedStyle(element).gridTemplateColumns,
      width: element.getBoundingClientRect().width,
    }))
    expect(workspaceLayout.columns.split(' ').length).toBe(1)
    expect(Number.parseFloat(workspaceLayout.columns)).toBeCloseTo(workspaceLayout.width, 0)
    await snap(page, `branding-single-flow-${label}`)
    const overflow = await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${label} 品牌页不应横向溢出`).toBeLessThanOrEqual(1)
  }
})

test('键盘可达且 reduced-motion 下配置流程完整可用', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await loginAsAdmin(page)
  await resetFakeMedia(page)
  await seedBrandingStage(page)
  await gotoBranding(page)
  await prepareOpacity(page, 63)

  for (const locator of [
    page.getByRole('link', { name: '全局水印' }),
    page.getByRole('button', { name: '选择 PNG' }),
    page.locator('.branding-candidate input[type=radio]').first(),
    opacityRange(page),
    opacityNumber(page),
    scaleNumber(page),
    refreshButton(page),
  ]) {
    await locator.focus()
    await expect(locator).toBeFocused()
  }

  await submitRefresh(page)
  await expect(operationRegion(page)).toContainText('已完成', { timeout: 20_000 })
  await expect(page.locator('.branding-active')).toContainText(/不透明度\s*63%/)
  await snap(page, 'branding-single-flow-reduced-motion-1440x900')
  await resetFakeMedia(page)
  await context.close()
})

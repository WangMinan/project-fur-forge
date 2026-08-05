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

// GATE-07 站点品牌（居中水印）管理端真实浏览器验证。
// 串行：站点级水印 profile 是全局状态，后续用例依赖前面用例的草稿/活动配置。
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
const saveDraftButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: '保存草稿配置' })
const previewFigures = (page: import('@playwright/test').Page) =>
  page.locator('.branding-preview__figure')
const operationRegion = (page: import('@playwright/test').Page) =>
  page.getByTestId('watermark-operation')

// 保存一个与当前活动/草稿不同的草稿配置（不透明度取唯一值，避免跨用例身份命中）。
// 默认先选中“当前使用”候选：afterEach 的 reset 会清空 fake 对象，
// 只有随应用 Logo 的对象被恢复；早前上传的候选对象已不存在。
async function saveDraftWithOpacity(
  page: import('@playwright/test').Page,
  opacity: number,
  options: { keepSelection?: boolean } = {},
) {
  if (!options.keepSelection) {
    await page.locator('.branding-candidate', { hasText: '当前使用' }).click()
  }
  await opacityRange(page).fill(String(opacity))
  await expect(saveDraftButton(page)).toBeEnabled()
  await saveDraftButton(page).click()
  await expect(page.locator('.branding-active__draft')).toContainText(
    `不透明度 ${opacity}%`,
  )
}

async function generatePreview(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /生成真实预览|重新生成预览/ }).click()
  await expect(previewFigures(page)).toHaveCount(3)
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await resetFakeMedia(page)
})

test.afterEach(async ({ page }) => {
  await resetFakeMedia(page)
})

test('未认证访问被重定向到登录页，品牌 API 返回 401', async ({ browser }) => {
  const context = await browser.newContext()
  const anonymous = await context.newPage()
  await anonymous.goto(`${adminBaseURL}/admin/site/branding`)
  await anonymous.waitForURL(/\/admin\/login/)
  const response = await anonymous.request.get(
    `${adminBaseURL}/api/admin/v1/site/branding/watermark`,
  )
  expect(response.status()).toBe(401)
  await context.close()
})

test('初始状态：活动水印、默认 50/60、固定居中、无关闭与四角', async ({ page }) => {
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
  await expect(active.getByText('当前使用')).toBeVisible()
  const activeImage = active.locator('img')
  await expect(activeImage).toHaveJSProperty('complete', true)
  expect(await activeImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)

  // 参数默认值与固定居中；不提供关闭按钮与四角位置。
  await expect(opacityRange(page)).toHaveValue('50')
  await expect(page.locator('#watermark-scale-range')).toHaveValue('60')
  await expect(opacityNumber(page)).toHaveValue('50')
  await expect(scaleNumber(page)).toHaveValue('60')
  await expect(page.locator('.branding-params')).toContainText('居中（固定）')
  await expect(page.getByRole('button', { name: /关闭水印|禁用水印/ })).toHaveCount(0)
  await expect(page.getByLabel(/水印安全角/)).toHaveCount(0)
  await expect(page.getByText(/左上角|右上角|左下角|右下角/)).toHaveCount(0)

  // 候选列表：种子 Logo 标记为当前使用，缩略图为同源管理端 URL。
  const candidates = page.locator('.branding-candidate')
  await expect(candidates).toHaveCount(1)
  await expect(candidates.first()).toContainText('当前使用')
  const thumb = candidates.first().locator('img')
  await expect(thumb).toHaveAttribute('src', /^\/api\/admin\//)
  await snap(page, 'branding-initial-1440x900')
})

test('上传透明 PNG 候选、草稿选择与保存草稿', async ({ page }) => {
  await gotoBranding(page)

  const input = page.getByLabel('选择水印 Logo 文件')
  await input.setInputFiles({
    name: 'new-logo.png',
    mimeType: 'image/png',
    buffer: smallStudioPng(),
  })
  await page.getByRole('button', { name: '上传候选' }).click()

  // 服务端核验完成后候选出现并自动选为草稿选择。
  const candidates = page.locator('.branding-candidate')
  await expect(candidates).toHaveCount(2)
  const newest = candidates.first()
  await expect(newest.locator('input[type=radio]')).toBeChecked()
  await expect(newest.locator('img')).toHaveAttribute('src', /^\/api\/admin\//)

  await saveDraftWithOpacity(page, 55, { keepSelection: true })
  await expect(newest).toContainText('草稿')
  await expect(candidates.nth(1)).toContainText('当前使用')
  await snap(page, 'branding-draft-saved-1440x900')
})

test('非法参数本地拦截，数字输入与滑块同步', async ({ page }) => {
  await gotoBranding(page)

  // 数字输入越界 → 中文错误与控件程序化关联，保存被禁用。
  await opacityNumber(page).fill('5')
  await opacityNumber(page).press('Tab')
  const error = page.locator('#watermark-params-error')
  await expect(error).toContainText('不透明度需为 10–90 的整数')
  await expect(opacityNumber(page)).toHaveAttribute('aria-invalid', 'true')
  await expect(saveDraftButton(page)).toBeDisabled()

  await opacityNumber(page).fill('95')
  await opacityNumber(page).press('Tab')
  await expect(error).toContainText('不透明度需为 10–90 的整数')

  // 合法输入清除错误；滑块与数字输入双向同步。
  await opacityNumber(page).fill('66')
  await opacityNumber(page).press('Tab')
  await expect(error).toHaveCount(0)
  await expect(opacityRange(page)).toHaveValue('66')

  await page.locator('#watermark-scale-range').fill('45')
  await expect(scaleNumber(page)).toHaveValue('45')
})

test('三比例真实 OSS 预览、同源 URL 与放大查看', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)
  await saveDraftWithOpacity(page, 56)
  await generatePreview(page)

  // T34-F1：站点大图不打水印，预览只覆盖作品保护展示位。
  const captions = ['作品卡片 · 3:4', '作品详情 · 原比例', '领养设定图 · 原比例']
  for (const [index, caption] of captions.entries()) {
    const figure = previewFigures(page).nth(index)
    await expect(figure).toContainText(caption)
    const image = figure.locator('img')
    await expect(image).toHaveAttribute(
      'src',
      /^\/api\/admin\/v1\/site\/branding\/watermark-operations\//,
    )
    await expect(image).toHaveJSProperty('complete', true)
    expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
  }

  // 预览接口返回真实图片内容（同源、非签名 URL）。
  const src = await previewFigures(page).nth(0).locator('img').getAttribute('src')
  const response = await page.request.get(`${adminBaseURL}${src}`)
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('image/webp')
  expect((await response.body()).length).toBeGreaterThan(0)

  // 放大查看：按钮打开对话框，Escape 关闭并归还焦点。
  const zoomButton = page.getByRole('button', { name: '放大查看作品卡片预览' })
  await zoomButton.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: '作品卡片预览放大查看' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('img')).toHaveJSProperty('complete', true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(zoomButton).toBeFocused()
  await snap(page, 'branding-preview-1440x900')
})

test('应用确认、影响摘要、原子切换与防重复', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)
  await saveDraftWithOpacity(page, 57)
  await generatePreview(page)

  // 应用前的影响摘要（数量不写死，来自服务端 impact）。
  const applyCard = page.locator('.branding-apply')
  await expect(applyCard).toContainText('受影响已发布作品')
  // T34-F1：影响摘要区分作品保护图与站点无水印图。
  await expect(applyCard).toContainText('需要重做的作品保护图')
  await expect(applyCard).toContainText('不受影响的站点无水印图')
  await expect(applyCard).toContainText('当前公开配置')
  await expect(applyCard).toContainText('新草稿配置')

  await page.getByRole('button', { name: '应用草稿到全站' }).click()
  const dialog = page.getByRole('dialog', { name: '应用草稿水印到全站？' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('件已发布作品')
  // T34-F1：确认文案只计作品保护图，并声明站点大图不受影响。
  await expect(dialog).toContainText('张作品保护图')
  await expect(dialog).toContainText('首页与委托页大图不打水印')
  await expect(dialog).toContainText('不透明度 57%')
  await expect(dialog).toContainText('切换前旧作品图保持可用')
  // 对话框打开时焦点在确认按钮上（键盘可直接确认）。
  await expect(dialog.getByRole('button', { name: '确认应用' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(operationRegion(page).getByRole('progressbar', {
    name: /全站水印应用进度/,
  })).toBeVisible()
  await expect(operationRegion(page)).toContainText('已完成')
  await expect(operationRegion(page)).toContainText('待清理 0')
  const active = page.locator('.branding-active')
  await expect(active).toContainText(/不透明度\s*57%/)
  await expect(page.locator('.branding-apply')).toContainText(
    /当前公开站使用：brand-centered-v2 · 居中 · 不透明度 57%/,
  )
  // 草稿已切换为活动：无草稿时应用按钮禁用，阻止重复操作。
  await expect(page.getByRole('button', { name: '应用草稿到全站' })).toBeDisabled()
  await snap(page, 'branding-applied-1440x900')
})

test('重新生成失败保持旧活动配置，持续显示并可重试', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)
  await saveDraftWithOpacity(page, 58)
  await generatePreview(page)

  await setFakeMediaFlags(page, { failProcess: true })
  await page.getByRole('button', { name: '应用草稿到全站' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认应用' }).click()

  await expect(operationRegion(page)).toContainText('失败')
  await expect(operationRegion(page)).toContainText(
    '公开图重新生成失败，当前公开站仍使用原水印配置，请重试。',
  )
  // 旧活动 profile 保持不变。
  await expect(page.locator('.branding-active')).toContainText(/不透明度\s*57%/)
  await expect(page.locator('.branding-apply')).toContainText('不透明度 57% · 缩放 60%')

  await setFakeMediaFlags(page, { failProcess: false })
  await operationRegion(page).getByRole('button', { name: '重试' }).click()
  await expect(operationRegion(page)).toContainText('已完成')
  await expect(page.locator('.branding-active')).toContainText(/不透明度\s*58%/)
})

test('清理失败重载后恢复失败状态，重试仅继续清理', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)
  await saveDraftWithOpacity(page, 59)
  await generatePreview(page)

  await setFakeMediaFlags(page, { failDelete: true })
  await page.getByRole('button', { name: '应用草稿到全站' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认应用' }).click()
  await expect(operationRegion(page)).toContainText(
    '新水印已生效，但旧公开图未清理完，重试只会继续清理。',
  )

  // 页面重载后通过 lastOperationId 恢复操作状态：失败持续显示而非短暂 Toast。
  await page.reload()
  await page.waitForSelector('.branding')
  await expect(operationRegion(page)).toContainText('失败')
  await expect(operationRegion(page)).toContainText('重试只会继续清理')
  await expect(page.locator('.branding-active')).toContainText(/不透明度\s*59%/)

  await setFakeMediaFlags(page, { failDelete: false })
  await operationRegion(page).getByRole('button', { name: '重试' }).click()
  await expect(operationRegion(page)).toContainText('已完成')
  await expect(operationRegion(page)).toContainText('待清理 0')
})

test('DOM 与图片 URL 不含私有 Key、Bucket、签名 URL 或完整摘要', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)
  await saveDraftWithOpacity(page, 61)
  await generatePreview(page)

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

test('作品编辑器：四角控件与开发说明移除，保存不依赖旧水印位置', async ({ page }) => {
  const work = await createWorkViaApi(page, { characterName: '水印摘要验证' })
  await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
  await page.waitForSelector('.editor-card')

  await expect(page.getByLabel('水印安全角')).toHaveCount(0)
  await expect(page.getByTestId('watermark-summary')).toHaveCount(0)

  const input = page.getByLabel('选择出厂照文件')
  await input.setInputFiles({
    name: 'studio.png',
    mimeType: 'image/png',
    buffer: smallStudioPng(),
  })
  await page.getByRole('button', { name: '上传出厂照' }).click()
  const card = page.locator('article.photo-card').first()
  await expect(card).toContainText('已就绪')
  await expect(card).toContainText('公开衍生图未生成')
  await card.getByLabel(/图片说明/).fill('摘要验证图')
  await page.getByRole('button', { name: '保存出厂照' }).click()
  await expect(page.getByText('出厂照已保存。')).toBeVisible()
})

test('三视口：无横向溢出，390 提示使用桌面端完成应用', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)
  await saveDraftWithOpacity(page, 62)
  await generatePreview(page)

  for (const [width, height, label] of [
    [390, 844, '390x844'],
    [768, 1024, '768x1024'],
    [1440, 900, '1440x900'],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto(`${adminBaseURL}/admin/site/branding`)
    await page.waitForSelector('.branding')
    await expect(previewFigures(page)).toHaveCount(3)
    await snap(page, `branding-${label}`)
    const overflow = await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${label} 品牌页不应横向溢出`).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${adminBaseURL}/admin/site/branding`)
  await page.waitForSelector('.branding')
  await expect(page.getByText('建议改用桌面端完成应用操作')).toBeVisible()
  await expect(page.locator('.branding-active')).toBeVisible()
})

test('键盘可达：导航 Tab 顺序与主要控件聚焦', async ({ page }) => {
  await seedBrandingStage(page)
  await gotoBranding(page)

  // 全新加载后顺序 Tab：跳过链接 → 导航 → 会话区。
  const seen: string[] = []
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Tab')
    const descriptor = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
      if (!element || element === document.body) {
        return ''
      }
      return element.getAttribute('aria-label')
        ?? element.textContent?.trim().slice(0, 20)
        ?? element.tagName
    })
    if (descriptor) {
      seen.push(descriptor)
    }
  }
  expect(
    seen.some(text => text.includes('全局水印')),
    `键盘焦点应到达全局水印导航（实际路径：${seen.join(' → ')}）`,
  ).toBe(true)

  // 主要控件均可聚焦（原生可聚焦元素、非禁用、可见）。
  await saveDraftWithOpacity(page, 64)
  await generatePreview(page)
  await opacityRange(page).fill('65')
  for (const locator of [
    page.getByRole('link', { name: '全局水印' }),
    page.getByRole('button', { name: '选择 PNG' }),
    page.locator('.branding-candidate input[type=radio]').first(),
    opacityRange(page),
    opacityNumber(page),
    saveDraftButton(page),
    page.getByRole('button', { name: '重新生成预览' }),
    page.getByRole('button', { name: '放大查看作品卡片预览' }),
    page.getByRole('button', { name: '应用草稿到全站' }),
  ]) {
    await locator.focus()
    await expect(locator).toBeFocused()
  }
})

test('reduced-motion 下预览不自动切换，界面完整可用', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await loginAsAdmin(page)
  await resetFakeMedia(page)
  await seedBrandingStage(page)
  await gotoBranding(page)
  await saveDraftWithOpacity(page, 63)
  await generatePreview(page)

  await expect(previewFigures(page)).toHaveCount(3)
  const firstSrc = await previewFigures(page).nth(0).locator('img').getAttribute('src')
  await page.waitForTimeout(1_000)
  await expect(previewFigures(page)).toHaveCount(3)
  await expect(previewFigures(page).nth(0).locator('img')).toHaveAttribute('src', firstSrc!)
  await snap(page, 'branding-reduced-motion-1440x900')
  await resetFakeMedia(page)
  await context.close()
})

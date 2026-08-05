import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { adminBaseURL, loginAsAdmin, publicBaseURL } from './helpers/auth'
import { createWorkViaApi } from './helpers/admin-work'
import { capture } from './helpers/screenshots'
import {
  fakeMediaState,
  heroPng,
  lowResolutionHeroPng,
  resetFakeMedia,
  seedHomePublicationOperation,
  setFakeMediaFlags,
  setWatermarkProfileActive,
} from './helpers/fake-media'
import { seedHomeSlides, seedPublicCatalog } from './helpers/public-catalog'

// T20 大图管理 E2E：设置、轮播项 CRUD、横竖配对、启停与公开投影、排序、
// 关联作品、保存冲突、活动水印真实预览、水印 profile 阻断、响应式无横向溢出。
// 每个用例以 seedHomeSlides([]) 清空轮播并重置设置，保证互相隔离。

const DEFAULT_SETTINGS = {
  tagline: '不只做小狗毛',
  contactEmail: '3114559925@qq.com',
  contactQq: '3114559925',
  autoRotate: false,
  autoRotateIntervalMs: 6_000,
}

const SCREENSHOT_DIR =
  'agent_docs/需求1-兽装工作室主页/implementation/notes/t19-t22/t19-t20/screenshots'

async function gotoHomeAdmin(page: Page) {
  await page.goto(`${adminBaseURL}/admin/site/home`)
  await page.waitForSelector('[data-testid="home-admin"]')
  await expect(page).toHaveTitle(/大图管理/u)
  await expect(page.getByRole('heading', { name: '大图管理' })).toBeVisible()
}

async function csrfToken(page: Page) {
  const session = await page.request.get(`${adminBaseURL}/api/auth/session`)
  const body = await session.json() as { data: { csrfToken: string } }
  return body.data.csrfToken
}

async function adminHomeVersion(page: Page) {
  const response = await page.request.get(`${adminBaseURL}/api/admin/v1/site/home`)
  expect(response.status(), '读取首页配置应成功').toBe(200)
  const body = await response.json() as { data: { version: number } }
  return body.data.version
}

async function publicHomeAlts(page: Page) {
  const response = await page.request.get(`${publicBaseURL}/api/public/v1/home`)
  expect(response.status(), '公开首页投影应可用').toBe(200)
  const body = await response.json() as { data: { slides: Array<{ alt: string }> } }
  return body.data.slides.map(slide => slide.alt)
}

async function publicCommissionHeroAlt(page: Page) {
  const response = await page.request.get(
    `${publicBaseURL}/api/public/v1/commission-hero`,
  )
  expect(response.status(), '公开委托页大图投影应可用').toBe(200)
  const body = await response.json() as { data: { slide: { alt: string } | null } }
  return body.data.slide?.alt ?? null
}

async function uploadHeroPair(
  page: Page,
  card: ReturnType<Page['locator']>,
  pageLabel = '首页',
) {
  await card.getByLabel(`选择横版（16:9）${pageLabel}图文件`).setInputFiles({
    name: 'landscape.png',
    mimeType: 'image/png',
    buffer: heroPng('landscape'),
  })
  await expect(card.getByText(/新图已上传/)).toHaveCount(1)
  await card.getByLabel(`选择竖版（9:16）${pageLabel}图文件`).setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: heroPng('portrait'),
  })
  await expect(card.getByText(/新图已上传/)).toHaveCount(2)
}

async function createSlideViaUi(
  page: Page,
  input: { alt: string, sortOrder: number },
) {
  await page.getByRole('button', { name: '新增轮播项' }).click()
  const draft = page.locator('[data-testid="home-slide-draft"]')
  await uploadHeroPair(page, draft)
  await draft.getByLabel(/图片说明/).fill(input.alt)
  await draft.getByLabel(/顺位/).fill(String(input.sortOrder))
  await draft.getByRole('button', { name: '创建轮播项' }).click()
  const card = page.locator('article.slide-card', {
    hasText: `轮播项 · 顺位 ${input.sortOrder}`,
  })
  await expect(card).toBeVisible()
  return card
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await resetFakeMedia(page)
  await seedHomeSlides(page, [], DEFAULT_SETTINGS)
  await seedHomeSlides(page, [], undefined, 'commission')
})

test.afterEach(async ({ page }) => {
  await setWatermarkProfileActive(page, true)
  await seedHomeSlides(page, [], DEFAULT_SETTINGS)
  await seedHomeSlides(page, [], undefined, 'commission')
  await resetFakeMedia(page)
})

test('首屏设置：加载、修改保存、刷新后保持', async ({ page }) => {
  await gotoHomeAdmin(page)
  await expect(page.locator('#home-tagline')).toHaveValue('不只做小狗毛')
  await expect(page.locator('#home-contact-email')).toHaveValue('3114559925@qq.com')
  await expect(page.locator('#home-contact-qq')).toHaveValue('3114559925')
  await expect(page.locator('#home-auto-rotate')).not.toBeChecked()
  await expect(page.locator('#home-interval')).toBeDisabled()

  await page.locator('#home-tagline').fill('只做小狗毛（测试）')
  await page.locator('#home-contact-email').fill('hello@example.test')
  await page.locator('#home-contact-qq').fill('123456789')
  await page.locator('#home-auto-rotate').check()
  await page.locator('#home-interval').fill('8')
  await page.getByRole('button', { name: '保存设置' }).click()
  await expect(page.getByRole('button', { name: '保存设置' })).toBeDisabled()

  await page.reload()
  await page.waitForSelector('[data-testid="home-admin"]')
  await expect(page.locator('#home-tagline')).toHaveValue('只做小狗毛（测试）')
  await expect(page.locator('#home-contact-email')).toHaveValue('hello@example.test')
  await expect(page.locator('#home-contact-qq')).toHaveValue('123456789')
  await expect(page.locator('#home-auto-rotate')).toBeChecked()
  await expect(page.locator('#home-interval')).toHaveValue('8')

  await page.goto(`${publicBaseURL}/about#contact`)
  const contact = page.getByTestId('about-contact')
  await expect(contact.getByRole('link', { name: 'hello@example.test' })).toHaveAttribute(
    'href',
    'mailto:hello@example.test',
  )
  await expect(contact.getByText('123456789', { exact: true })).toBeVisible()

  const footer = page.getByTestId('public-footer')
  await expect(footer).not.toContainText('hello@example.test')
  await expect(footer).not.toContainText('QQ 123456789')
})

test('轮播项 CRUD：横竖上传创建、编辑保存、删除确认', async ({ page }) => {
  await gotoHomeAdmin(page)
  const card = await createSlideViaUi(page, { alt: '蓝湄的首页展示照', sortOrder: 0 })
  await expect(card.getByText('未启用')).toBeVisible()
  await expect(card.getByText(/启用时将生成 12 张/)).toBeVisible()

  await card.getByLabel(/图片说明/).fill('蓝湄的首页展示照（改）')
  await card.getByRole('button', { name: '保存修改' }).click()
  await expect(card.getByRole('button', { name: '保存修改' })).toBeDisabled()
  await page.reload()
  await page.waitForSelector('[data-testid="home-admin"]')
  const persisted = page.locator('article.slide-card', { hasText: '轮播项 · 顺位 0' })
  await expect(persisted.getByLabel(/图片说明/)).toHaveValue('蓝湄的首页展示照（改）')
  const savedImages = persisted.locator('[data-testid^="hero-slot-saved-image-"]')
  await expect(savedImages).toHaveCount(2)
  for (const image of await savedImages.all()) {
    await expect(image).toHaveJSProperty('complete', true)
    expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
    expect(await image.getAttribute('src')).toMatch(
      /^\/api\/admin\/v1\/media\/assets\/[0-9a-f-]+\/preview$/u,
    )
  }

  await persisted.getByRole('button', { name: '删除' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认删除' }).click()
  await expect(page.locator('article.slide-card')).toHaveCount(0)
  await expect(page.getByText('还没有轮播项')).toBeVisible()
})

test('委托页 Tab：独立上传、启用和全部停用不影响首页', async ({ page }) => {
  await seedHomeSlides(page, [
    { alt: '保留的首页图', sortOrder: 0, enabled: true },
  ], DEFAULT_SETTINGS)
  await gotoHomeAdmin(page)
  await page.getByRole('link', { name: '委托页大图' }).click()
  await expect(page).toHaveURL(/tab=commission/u)
  await expect(page.getByRole('link', { name: '委托页大图' }))
    .toHaveAttribute('aria-current', 'page')
  await expect(page.locator('#home-tagline')).toHaveCount(0)

  await page.getByRole('button', { name: '新增大图项' }).click()
  const draft = page.locator('[data-testid="home-slide-draft"]')
  await uploadHeroPair(page, draft, '委托页')
  await draft.getByLabel(/图片说明/).fill('独立委托页背景')
  await draft.getByRole('button', { name: '创建大图项' }).click()
  const card = page.locator('article.slide-card', { hasText: '大图项 · 顺位 0' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: '启用' }).click()
  await expect(card.getByText('已启用', { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  expect(await publicCommissionHeroAlt(page)).toBe('独立委托页背景')
  expect(await publicHomeAlts(page)).toEqual(['保留的首页图'])

  await page.goto(`${publicBaseURL}/commission`)
  await expect(page.getByTestId('commission-hero')
    .getByRole('img', { name: '独立委托页背景' })).toBeVisible()

  await page.goto(`${adminBaseURL}/admin/site/home?tab=commission`)
  await page.waitForSelector('[data-testid="home-admin"]')
  const persisted = page.locator('article.slide-card', { hasText: '大图项 · 顺位 0' })
  await persisted.getByRole('button', { name: '停用' }).click()
  await expect(persisted.getByText('未启用', { exact: true })).toBeVisible()
  expect(await publicCommissionHeroAlt(page)).toBeNull()
  expect(await publicHomeAlts(page)).toEqual(['保留的首页图'])
})

test('横竖配对约束：只上传一版时创建按钮保持禁用', async ({ page }) => {
  await gotoHomeAdmin(page)
  await page.getByRole('button', { name: '新增轮播项' }).click()
  const draft = page.locator('[data-testid="home-slide-draft"]')
  await draft.getByLabel('选择横版（16:9）首页图文件').setInputFiles({
    name: 'landscape.png',
    mimeType: 'image/png',
    buffer: heroPng('landscape'),
  })
  await expect(draft.getByText(/新图已上传/)).toHaveCount(1)
  await draft.getByLabel(/图片说明/).fill('只有横版的首页图')
  await expect(draft.getByRole('button', { name: '创建轮播项' })).toBeDisabled()
})

test('低分辨率大图：保存后提示，取消不处理，确认后 FFmpeg 适配并启用', async ({ page }) => {
  await gotoHomeAdmin(page)
  await page.getByRole('button', { name: '新增轮播项' }).click()
  const draft = page.locator('[data-testid="home-slide-draft"]')
  await draft.getByLabel('选择横版（16:9）首页图文件').setInputFiles({
    name: 'landscape-small.png',
    mimeType: 'image/png',
    buffer: lowResolutionHeroPng('landscape'),
  })
  await draft.getByLabel('选择竖版（9:16）首页图文件').setInputFiles({
    name: 'portrait-small.png',
    mimeType: 'image/png',
    buffer: lowResolutionHeroPng('portrait'),
  })
  await expect(draft.getByText(/低于推荐/)).toHaveCount(2)
  await draft.getByLabel(/图片说明/).fill('低分辨率适配首页图')
  await draft.getByRole('button', { name: '创建轮播项' }).click()

  const card = page.locator('article.slide-card', { hasText: '轮播项 · 顺位 0' })
  await expect(card.getByText(/插值只补足尺寸/)).toBeVisible()
  await card.getByRole('button', { name: '启用' }).click()
  const dialog = page.getByRole('dialog', { name: '确认放大适配这组图片？' })
  await expect(dialog).toContainText('不会恢复原图不存在的细节')
  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(card.getByText('未启用', { exact: true })).toBeVisible()
  expect((await fakeMediaState(page)).objects.some(key =>
    key.includes('/hero-upscale-lanczos-v1/'),
  )).toBe(false)

  await setFakeMediaFlags(page, { failGet: true })
  await card.getByRole('button', { name: '启用' }).click()
  await dialog.getByRole('button', { name: '确认并继续启用' }).click()
  await expect(card.getByRole('alert')).toContainText('大图适配失败', {
    timeout: 30_000,
  })

  await page.reload()
  await expect(card.getByRole('alert')).toContainText('大图适配失败')
  await expect(card.getByText(/插值只补足尺寸/)).toBeVisible()
  await setFakeMediaFlags(page, { failGet: false })
  await card.getByRole('button', { name: '重试适配' }).click()
  await expect(card.getByText('已启用', { exact: true })).toBeVisible({
    timeout: 30_000,
  })
  await expect(card.getByText(/已生成私有适配源/)).toBeVisible()
  const state = await fakeMediaState(page)
  expect(state.objects.filter(key =>
    key.includes('/hero-upscale-lanczos-v1/'),
  )).toHaveLength(2)
  expect(await publicHomeAlts(page)).toEqual(['低分辨率适配首页图'])
})

test('首页图按真实文件字节声明格式，不受扩展名或浏览器 MIME 误报影响', async ({ page }) => {
  await gotoHomeAdmin(page)
  await page.getByRole('button', { name: '新增轮播项' }).click()
  const draft = page.locator('[data-testid="home-slide-draft"]')

  await draft.getByLabel('选择横版（16:9）首页图文件').setInputFiles({
    name: 'landscape.jpg',
    mimeType: 'image/jpeg',
    buffer: heroPng('landscape'),
  })

  await expect(draft.getByText(/新图已上传/)).toHaveCount(1)
  const state = await fakeMediaState(page)
  expect(state.putRecords.at(-1)?.contentType).toBe('image/png')
})

test('首页图服务端核验失败时显示具体原因与阶段', async ({ page }) => {
  await gotoHomeAdmin(page)
  await page.getByRole('button', { name: '新增轮播项' }).click()
  const draft = page.locator('[data-testid="home-slide-draft"]')
  await setFakeMediaFlags(page, { omitSha256OnNextPut: true })

  await draft.getByLabel('选择横版（16:9）首页图文件').setInputFiles({
    name: 'digest.png',
    mimeType: 'image/png',
    buffer: heroPng('landscape'),
  })

  await expect(draft.getByRole('alert')).toContainText('文件摘要或元数据与声明不一致')
  await expect(draft.getByRole('alert')).toContainText('对象检查')
  await expect(draft.getByRole('alert')).not.toContainText('上传未通过服务端核验')
})

test('新项使用空闲顺位，重复顺位启用时提示真实原因并可修正', async ({ page }) => {
  await seedHomeSlides(page, [
    { alt: '已启用首页图', sortOrder: 0, enabled: true },
  ], DEFAULT_SETTINGS)
  await gotoHomeAdmin(page)

  await page.getByRole('button', { name: '新增轮播项' }).click()
  const draft = page.locator('[data-testid="home-slide-draft"]')
  await expect(draft.getByLabel(/顺位/)).toHaveValue('1')
  await uploadHeroPair(page, draft)
  await draft.getByLabel(/图片说明/).fill('待启用首页图')
  await draft.getByLabel(/顺位/).fill('0')
  await draft.getByRole('button', { name: '创建轮播项' }).click()

  const card = page.locator('article.slide-card', { hasText: '未启用' })
  await expect(card.getByLabel(/图片说明/)).toHaveValue('待启用首页图')
  await card.getByRole('button', { name: '启用' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '顺位 0 已被其他启用项占用' }))
    .toBeVisible()
  await expect(page.getByText('首页数据已在其他地方变化')).toHaveCount(0)
  await page.getByRole('alertdialog').getByRole('button', { name: '知道了' }).click()

  await card.getByLabel(/顺位/).fill('1')
  await card.getByRole('button', { name: '保存修改' }).click()
  await expect(card.getByRole('button', { name: '保存修改' })).toBeDisabled()

  const corrected = page.locator('article.slide-card', { hasText: '轮播项 · 顺位 1' })
  await corrected.getByRole('button', { name: '启用' }).click()
  await expect(corrected.getByText('已启用', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(corrected.getByText(/启用成功/)).toBeVisible()
})

test('启用后公开首页可见，停用后移除；启用过程有进度与成功反馈', async ({ page }) => {
  // 服务端契约要求至少保留一项启用轮播：预置常驻项后，新建项才能被停用。
  await seedHomeSlides(page, [
    { alt: '常驻首页图', sortOrder: 0, enabled: true },
  ], DEFAULT_SETTINGS)
  await gotoHomeAdmin(page)
  const card = await createSlideViaUi(page, { alt: '芝麻的首页展示照', sortOrder: 1 })
  expect(await publicHomeAlts(page)).toEqual(['常驻首页图'])

  await card.getByRole('button', { name: '启用' }).click()
  await expect(card.getByText('已启用', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(card.getByText(/启用成功/)).toBeVisible()
  await expect(card.getByRole('button', { name: '活动水印预览' })).toHaveCount(0)
  await expect(card.getByText('当前公开图已使用活动水印')).toBeVisible()
  expect(await publicHomeAlts(page)).toEqual(['常驻首页图', '芝麻的首页展示照'])

  // 启用后字段锁定，只能停用/排序；公开结果本身就是当前水印结果。
  await expect(card.getByLabel(/图片说明/)).toBeDisabled()
  await expect(card.getByRole('button', { name: '保存修改' })).toBeDisabled()

  await card.getByRole('button', { name: '停用' }).click()
  await expect(card.getByText('未启用')).toBeVisible()
  await expect(card.getByRole('button', { name: '活动水印预览' })).toBeVisible()
  expect(await publicHomeAlts(page)).toEqual(['常驻首页图'])
})

test('最后一个启用轮播项不可停用时显示业务门禁，而非版本冲突', async ({ page }) => {
  await seedHomeSlides(page, [
    { alt: '唯一启用的首页图', sortOrder: 0, enabled: true },
  ], DEFAULT_SETTINGS)
  await gotoHomeAdmin(page)

  const card = page.locator('article.slide-card').first()
  await expect(card.getByLabel(/图片说明/)).toHaveValue('唯一启用的首页图')
  await card.getByRole('button', { name: '停用' }).click()

  await expect(page.getByRole('alert').filter({
    hasText: '首页至少需要保留一个启用的轮播项',
  })).toBeVisible()
  await expect(page.getByText('首页数据已在其他地方变化')).toHaveCount(0)
  await expect(card.getByText('已启用', { exact: true })).toBeVisible()
})

test('启用任务刷新后恢复真实阶段与公开衍生图计数', async ({ page }) => {
  await seedHomeSlides(page, [
    { alt: '恢复中的首页图', sortOrder: 0, enabled: false },
  ], DEFAULT_SETTINGS)
  await seedHomePublicationOperation(page, '恢复中的首页图')

  await gotoHomeAdmin(page)
  const card = page.locator('article.slide-card').first()
  await expect(card.getByLabel(/图片说明/)).toHaveValue('恢复中的首页图')
  await expect(card.getByRole('status')).toContainText('正在生成公开图片')
  await expect(card.getByRole('progressbar', {
    name: '首页公开衍生图已就绪 0 / 12',
  })).toHaveAttribute('value', '0')

  await page.reload()
  await page.waitForSelector('[data-testid="home-admin"]')
  await expect(card.getByRole('status')).toContainText('当前活动 profile 已就绪 0 / 12')
})

test('已启用轮播项可上移/下移，公开首页顺序同步', async ({ page }) => {
  await gotoHomeAdmin(page)
  const first = await createSlideViaUi(page, { alt: '第一项首页图', sortOrder: 0 })
  const second = await createSlideViaUi(page, { alt: '第二项首页图', sortOrder: 1 })

  await first.getByRole('button', { name: '启用' }).click()
  await expect(first.getByText('已启用', { exact: true })).toBeVisible({ timeout: 15_000 })
  await second.getByRole('button', { name: '启用' }).click()
  await expect(second.getByText('已启用', { exact: true })).toBeVisible({ timeout: 15_000 })
  expect(await publicHomeAlts(page)).toEqual(['第一项首页图', '第二项首页图'])

  await second.getByRole('button', { name: /上移轮播项/ }).click()
  await expect(async () => {
    expect(await publicHomeAlts(page)).toEqual(['第二项首页图', '第一项首页图'])
  }).toPass()
})

test('关联作品：已发布作品可关联保存；未发布作品选项被禁用', async ({ page }) => {
  await seedPublicCatalog(page, [
    {
      slug: 'e2e-public-home-link',
      characterName: '链接蓝湄',
      photos: [{ alt: '链接蓝湄的出厂照' }],
    },
  ])
  const draftWork = await createWorkViaApi(page, { characterName: '草稿作品甲' })
  expect(draftWork.id).toBeTruthy()

  await gotoHomeAdmin(page)
  await page.getByRole('button', { name: '新增轮播项' }).click()
  const draft = page.locator('[data-testid="home-slide-draft"]')

  const draftOption = draft.locator('select option', { hasText: '草稿作品甲' })
  await expect(draftOption).toBeDisabled()

  const publishedValue = await draft
    .locator('select option', { hasText: '链接蓝湄' })
    .getAttribute('value')
  expect(publishedValue).toBeTruthy()
  await draft.getByLabel(/关联作品/).selectOption(publishedValue!)

  await uploadHeroPair(page, draft)
  await draft.getByLabel(/图片说明/).fill('关联蓝湄的首页图')
  await draft.getByLabel(/顺位/).fill('0')
  await draft.getByRole('button', { name: '创建轮播项' }).click()

  const card = page.locator('article.slide-card', { hasText: '轮播项 · 顺位 0' })
  await expect(card).toBeVisible()
  await expect(card.getByLabel(/关联作品/)).toHaveValue(publishedValue!)
})

test('保存冲突：其他地方修改后提交，提示冲突并重新加载', async ({ page }) => {
  await gotoHomeAdmin(page)
  const version = await adminHomeVersion(page)
  const response = await page.request.put(
    `${adminBaseURL}/api/admin/v1/site/home/settings`,
    {
      data: {
        expectedVersion: version,
        payload: {
          tagline: '别处修改的口号',
          contactEmail: DEFAULT_SETTINGS.contactEmail,
          contactQq: DEFAULT_SETTINGS.contactQq,
          autoRotate: false,
          autoRotateIntervalMs: 6_000,
        },
      },
      headers: {
        'Origin': adminBaseURL,
        'x-csrf-token': await csrfToken(page),
      },
    },
  )
  expect(response.status(), 'API 侧修改应成功').toBe(200)

  await page.locator('#home-tagline').fill('页面侧的口号')
  await page.getByRole('button', { name: '保存设置' }).click()
  await expect(page.getByRole('alert').filter({
    hasText: '首页数据已在其他地方变化',
  })).toBeVisible()
  await page.getByRole('alertdialog').getByRole('button', { name: '知道了' }).click()
  // 冲突后版本基线已推进但保留用户输入：确认内容后可重试并成功。
  await expect(page.locator('#home-tagline')).toHaveValue('页面侧的口号')
  await page.getByRole('button', { name: '保存设置' }).click()
  await expect(page.getByRole('button', { name: '保存设置' })).toBeDisabled()
  const latest = await page.request.get(`${adminBaseURL}/api/admin/v1/site/home`)
  const body = await latest.json() as { data: { tagline: string } }
  expect(body.data.tagline).toBe('页面侧的口号')
})

test('活动水印预览：横竖真实私有预览图可加载，DOM 不泄漏私有 Key', async ({ page }) => {
  await gotoHomeAdmin(page)
  const card = await createSlideViaUi(page, { alt: '预览用的首页图', sortOrder: 0 })

  await card.getByRole('button', { name: '活动水印预览' }).click()
  const preview = card.locator('[data-testid="hero-watermark-preview"]')
  await expect(preview).toBeVisible()
  const images = preview.locator('img')
  await expect(images).toHaveCount(2)
  for (const image of await images.all()) {
    await expect(image).toHaveJSProperty('complete', true)
    expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
    expect(await image.getAttribute('src')).toMatch(
      /^\/api\/admin\/v1\/site\/home\/slides\/[0-9a-f-]+\/preview\/(?:landscape|portrait)$/u,
    )
  }

  const dom = await page.content()
  expect(dom).not.toContain('/original/')
  expect(dom).not.toContain('/preview/home/')
  expect(dom).not.toContain('private_object_key')
  expect(dom).not.toContain('x-oss-')
  expect(dom).not.toContain('Signature=')
})

test('水印 profile 边界：无活动水印时预览被拒绝，但站点大图启用不再依赖水印', async ({ page }) => {
  await gotoHomeAdmin(page)
  const card = await createSlideViaUi(page, { alt: '阻断验证首页图', sortOrder: 0 })

  await setWatermarkProfileActive(page, false)
  try {
    // 水印预览渲染的是带水印的图，仍然需要活动 profile。
    await card.getByRole('button', { name: '活动水印预览' }).click()
    await expect(page.getByRole('alert').filter({
      hasText: '首页数据或活动水印已变化',
    })).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: '知道了' }).click()

    // T34-F1 起首页/委托页大图使用无水印 site-display-v1：
    // 没有活动水印 profile 也可以启用，不再报冲突。
    await card.getByRole('button', { name: '启用' }).click()
    await expect(card.getByText('已启用', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('alert').filter({
      hasText: '首页数据已在其他地方变化',
    })).toHaveCount(0)
  }
  finally {
    await setWatermarkProfileActive(page, true)
  }
})

test('响应式：390/768/1440 均无横向溢出', async ({ page }) => {
  await seedHomeSlides(page, [
    { alt: '溢出验证一', sortOrder: 0, enabled: false },
    { alt: '溢出验证二', sortOrder: 1, enabled: false },
  ])
  await gotoHomeAdmin(page)
  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    await expect(page.locator('article.slide-card').first()).toBeVisible()
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(metrics.scrollWidth, `视口 ${width} 不应横向溢出`)
      .toBeLessThanOrEqual(metrics.clientWidth + 1)
    await capture(page, `admin-home-${width}x${height}`, SCREENSHOT_DIR)
  }
})

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { adminBaseURL, loginAsAdmin, publicBaseURL } from './helpers/auth'
import { createWorkViaApi } from './helpers/admin-work'
import { capture } from './helpers/screenshots'
import {
  heroPng,
  resetFakeMedia,
  seedHomePublicationOperation,
  setWatermarkProfileActive,
} from './helpers/fake-media'
import { seedHomeSlides, seedPublicCatalog } from './helpers/public-catalog'

// T20 首页管理 E2E：设置、轮播项 CRUD、横竖配对、启停与公开投影、排序、
// 关联作品、保存冲突、活动水印真实预览、水印 profile 阻断、响应式无横向溢出。
// 每个用例以 seedHomeSlides([]) 清空轮播并重置设置，保证互相隔离。

const DEFAULT_SETTINGS = {
  tagline: '不只做小狗毛',
  autoRotate: false,
  autoRotateIntervalMs: 6_000,
}

const SCREENSHOT_DIR =
  'agent_docs/需求1-兽装工作室主页/implementation/notes/t19-t20/screenshots'

async function gotoHomeAdmin(page: Page) {
  await page.goto(`${adminBaseURL}/admin/site/home`)
  await page.waitForSelector('[data-testid="home-admin"]')
  await expect(page.getByRole('heading', { name: '首页管理' })).toBeVisible()
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

async function uploadHeroPair(page: Page, card: ReturnType<Page['locator']>) {
  await card.getByLabel('选择横版（16:9）首页图文件').setInputFiles({
    name: 'landscape.png',
    mimeType: 'image/png',
    buffer: heroPng('landscape'),
  })
  await expect(card.getByText(/新图已上传/)).toHaveCount(1)
  await card.getByLabel('选择竖版（9:16）首页图文件').setInputFiles({
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
})

test.afterEach(async ({ page }) => {
  await setWatermarkProfileActive(page, true)
  await seedHomeSlides(page, [], DEFAULT_SETTINGS)
  await resetFakeMedia(page)
})

test('首屏设置：加载、修改保存、刷新后保持', async ({ page }) => {
  await gotoHomeAdmin(page)
  await expect(page.locator('#home-tagline')).toHaveValue('不只做小狗毛')
  await expect(page.locator('#home-auto-rotate')).not.toBeChecked()
  await expect(page.locator('#home-interval')).toBeDisabled()

  await page.locator('#home-tagline').fill('只做小狗毛（测试）')
  await page.locator('#home-auto-rotate').check()
  await page.locator('#home-interval').fill('8')
  await page.getByRole('button', { name: '保存设置' }).click()
  await expect(page.getByRole('button', { name: '保存设置' })).toBeDisabled()

  await page.reload()
  await page.waitForSelector('[data-testid="home-admin"]')
  await expect(page.locator('#home-tagline')).toHaveValue('只做小狗毛（测试）')
  await expect(page.locator('#home-auto-rotate')).toBeChecked()
  await expect(page.locator('#home-interval')).toHaveValue('8')
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

  await persisted.getByRole('button', { name: '删除' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认删除' }).click()
  await expect(page.locator('article.slide-card')).toHaveCount(0)
  await expect(page.getByText('还没有轮播项')).toBeVisible()
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
  expect(await publicHomeAlts(page)).toEqual(['常驻首页图', '芝麻的首页展示照'])

  // 启用后字段锁定，只能停用/预览/排序。
  await expect(card.getByLabel(/图片说明/)).toBeDisabled()
  await expect(card.getByRole('button', { name: '保存修改' })).toBeDisabled()

  await card.getByRole('button', { name: '停用' }).click()
  await expect(card.getByText('未启用')).toBeVisible()
  expect(await publicHomeAlts(page)).toEqual(['常驻首页图'])
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
  }

  const dom = await page.content()
  expect(dom).not.toContain('/original/')
  expect(dom).not.toContain('private_object_key')
})

test('水印 profile 阻断：无活动水印时预览与启用都被拒绝', async ({ page }) => {
  await gotoHomeAdmin(page)
  const card = await createSlideViaUi(page, { alt: '阻断验证首页图', sortOrder: 0 })

  await setWatermarkProfileActive(page, false)
  try {
    await card.getByRole('button', { name: '活动水印预览' }).click()
    await expect(page.getByRole('alert').filter({
      hasText: '首页数据或活动水印已变化',
    })).toBeVisible()

    await card.getByRole('button', { name: '启用' }).click()
    await expect(page.getByRole('alert').filter({
      hasText: '首页数据已在其他地方变化',
    }).first()).toBeVisible()
    await expect(card.getByText('未启用')).toBeVisible()
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

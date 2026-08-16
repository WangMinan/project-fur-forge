import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { adminBaseURL, loginAsAdmin, publicBaseURL } from './helpers/auth'
import { fakeMediaState, heroPng, resetFakeMedia } from './helpers/fake-media'
import {
  seedHeroCollections,
  seedHomeSlides,
} from './helpers/public-catalog'

let csrfToken = ''

function heroItemByAlt(page: Page, alt: string) {
  return page.locator(`[data-testid="hero-collection-item"][data-alt="${alt}"]`)
}

async function gotoHeroAdmin(page: Page, tab?: string) {
  const query = tab ? `?tab=${tab}` : ''
  await page.goto(`${adminBaseURL}/admin/site/home${query}`)
  await expect(page.getByTestId('home-admin')).toBeVisible()
  await expect(page.getByRole('heading', { name: '大图管理', level: 1 }))
    .toBeVisible()
}

async function publicHomeAlts(page: Page, orientation: 'landscape' | 'portrait') {
  const response = await page.request.get(`${publicBaseURL}/api/public/v1/home`)
  expect(response.status()).toBe(200)
  const body = await response.json() as {
    data: Record<'landscape' | 'portrait', Array<{ alt: string }>>
  }
  return body.data[orientation].map(item => item.alt)
}

async function seedTwoHomeItems(page: Page) {
  await seedHeroCollections(page, {
    landscape: [
      { alt: '横版项 A', sortOrder: 0, enabled: true },
      { alt: '横版项 B', sortOrder: 1, enabled: true },
    ],
    portrait: [
      { alt: '竖版唯一项', sortOrder: 0, enabled: true },
    ],
  })
}

test.beforeEach(async ({ page }) => {
  csrfToken = (await loginAsAdmin(page)).csrfToken
  await resetFakeMedia(page)
  await seedHomeSlides(page, [])
  await seedHomeSlides(page, [], undefined, 'commission')
})

test.afterEach(async ({ page }) => {
  await seedHomeSlides(page, [])
  await seedHomeSlides(page, [], undefined, 'commission')
  await resetFakeMedia(page)
})

test('四个大图集合为独立标签和版本域', async ({ page }) => {
  await seedHeroCollections(page, {
    landscape: [{ alt: '首页横版', sortOrder: 0, enabled: true }],
    portrait: [{ alt: '首页竖版', sortOrder: 0, enabled: true }],
  })
  await seedHeroCollections(page, {
    placement: 'commission',
    landscape: [{ alt: '委托横版', sortOrder: 0, enabled: true }],
    portrait: [{ alt: '委托竖版', sortOrder: 0, enabled: true }],
  })
  await gotoHeroAdmin(page)

  for (const tab of [
    { key: 'home-landscape', label: '首页大图 / 横版', alt: '首页横版' },
    { key: 'home-portrait', label: '首页大图 / 竖版', alt: '首页竖版' },
    { key: 'commission-landscape', label: '委托页大图 / 横版', alt: '委托横版' },
    { key: 'commission-portrait', label: '委托页大图 / 竖版', alt: '委托竖版' },
  ]) {
    await page.getByRole('link', { name: tab.label }).click()
    await expect(page.getByRole('link', { name: tab.label }))
      .toHaveAttribute('aria-current', 'page')
    await expect(heroItemByAlt(page, tab.alt)).toBeVisible()
    await expect(page.getByText(/collection v\d+/u)).toBeVisible()
  }
})

test('单图上传、保存、预览、发布、停用与删除走完同一集合链路', async ({ page }) => {
  await seedHeroCollections(page, {
    landscape: [{ alt: '横版保留项', sortOrder: 0, enabled: true }],
    portrait: [{ alt: '竖版保留项', sortOrder: 0, enabled: true }],
  })
  await gotoHeroAdmin(page)
  await page.getByRole('button', { name: '新增大图项' }).click()
  const draft = page.getByTestId('hero-collection-item').filter({ hasText: '新大图项' })
  await draft.getByLabel('横版原图').setInputFiles({
    name: 'hero-landscape.png',
    mimeType: 'image/png',
    buffer: heroPng('landscape'),
  })
  await expect(draft.getByText('hero-landscape.png')).toBeVisible()
  await draft.getByRole('button', { name: '上传图片' }).click()
  await expect(draft.getByText('上传并校验完成，请保存。')).toBeVisible()
  await draft.getByLabel('替代文字').fill('新增独立横版')
  await draft.getByLabel('顺位（0–4）').fill('1')
  const uploadedPreview = draft.getByRole('img', { name: '新增独立横版管理预览' })
  await expect(uploadedPreview).toBeVisible()
  await expect(uploadedPreview).toHaveAttribute(
    'src',
    /^\/api\/admin\/v1\/media\/assets\/[0-9a-f-]+\/preview\?w=640$/u,
  )
  await draft.getByRole('button', { name: '新增', exact: true }).click()
  await expect(draft).toHaveCount(0)

  const item = heroItemByAlt(page, '新增独立横版')
  await expect(item).toBeVisible()
  const preview = item.getByRole('img', { name: '新增独立横版管理预览' })
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAttribute(
    'src',
    /^\/api\/admin\/v1\/media\/assets\/[0-9a-f-]+\/preview\?w=640$/u,
  )
  await expect.poll(async () => (await fakeMediaState(page)).privateProcessCalls)
    .toContainEqual({ process: 'image/auto-orient,1/resize,m_lfit,w_640' })
  await expect(item.getByRole('button', { name: '生成预览' })).toHaveCount(0)

  await item.getByRole('button', { name: '发布并启用' }).click()
  await expect(item.getByRole('progressbar', { name: /发布并启用进度/u }))
    .toBeVisible()
  await expect(item.getByText('发布完成，公开派生图已校验。'))
    .toBeVisible({ timeout: 20_000 })
  await expect.poll(() => publicHomeAlts(page, 'landscape'))
    .toEqual(['横版保留项', '新增独立横版'])

  await item.getByRole('button', { name: '停用并撤销公开图' }).click()
  await expect(item.getByText('停用完成，公开文件与缓存已撤销。'))
    .toBeVisible({ timeout: 20_000 })
  await item.getByRole('button', { name: '删除', exact: true }).click()
  await expect(heroItemByAlt(page, '新增独立横版'))
    .toHaveCount(0)
})

test('已启用大图默认展示低清管理预览且不读取原图', async ({ page }) => {
  await seedHeroCollections(page, {
    landscape: [{ alt: '即时预览横版', sortOrder: 0, enabled: true }],
    portrait: [{ alt: '即时预览竖版', sortOrder: 0, enabled: true }],
  })
  await gotoHeroAdmin(page)

  const item = heroItemByAlt(page, '即时预览横版')
  await expect(item).toContainText('已启用')
  const preview = item.getByRole('img', { name: '即时预览横版管理预览' })
  await expect(preview).toBeVisible()
  await expect(preview).not.toHaveAttribute('src', /^blob:/u)
  await expect(preview).toHaveAttribute('src', /\/preview\?w=640$/u)
  await expect(preview).not.toHaveAttribute('src', /original=1/u)
  await expect.poll(async () => (await fakeMediaState(page)).privateProcessCalls)
    .toContainEqual({ process: 'image/auto-orient,1/resize,m_lfit,w_640' })
  await expect(item.getByRole('button', { name: '生成预览' })).toHaveCount(0)
})

test('完整顺序写入产生 FLIP，旧 collection version 稳定返回 409', async ({ page }) => {
  await seedTwoHomeItems(page)
  await gotoHeroAdmin(page)
  await page.evaluate(() => {
    const state = window as Window & { __heroMoveSeen?: boolean }
    state.__heroMoveSeen = false
    const observer = new MutationObserver((entries) => {
      if (entries.some(entry => (
        entry.target instanceof HTMLElement
        && entry.target.classList.contains('hero-item-list-move')
      ))) {
        state.__heroMoveSeen = true
        observer.disconnect()
      }
    })
    observer.observe(document.querySelector('.hero-admin__items')!, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    })
  })
  const first = heroItemByAlt(page, '横版项 A')
  await first.getByRole('button', { name: '下移' }).click()
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __heroMoveSeen?: boolean }).__heroMoveSeen
  ))).toBe(true)
  await expect.poll(() => publicHomeAlts(page, 'landscape'))
    .toEqual(['横版项 B', '横版项 A'])

  const response = await page.request.put(
    `${adminBaseURL}/api/admin/v1/site/hero-collections/home/landscape/items/order`,
    {
      data: {
        expectedVersion: 1,
        payload: { itemIds: [] },
      },
      headers: {
        Origin: adminBaseURL,
        'x-csrf-token': csrfToken,
      },
    },
  )
  // 旧版本与非完整顺序都不会被服务端接受。
  expect(response.status()).toBe(400)

  const snapshot = await page.request.get(
    `${adminBaseURL}/api/admin/v1/site/hero-collections/home/landscape`,
  )
  const current = await snapshot.json() as { data: { items: Array<{ id: string }> } }
  const stale = await page.request.put(
    `${adminBaseURL}/api/admin/v1/site/hero-collections/home/landscape/items/order`,
    {
      data: {
        expectedVersion: 1,
        payload: { itemIds: current.data.items.map(item => item.id) },
      },
      headers: {
        Origin: adminBaseURL,
        'x-csrf-token': csrfToken,
      },
    },
  )
  expect(stale.status()).toBe(409)
  await expect(stale.json()).resolves.toMatchObject({
    error: { code: 'CONFLICT', reason: 'VERSION_CONFLICT' },
  })
})

test('管理端在移动与桌面宽度都无横向溢出', async ({ page }) => {
  await seedTwoHomeItems(page)
  for (const [width, height] of [[390, 844], [1024, 900], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    await gotoHeroAdmin(page)
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }
})

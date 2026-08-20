import { expect, test } from '@playwright/test'
import { createWorkViaApi } from '../e2e/helpers/admin-work'
import {
  adminBaseURL,
  E2E_ADMIN,
  loginAsAdmin,
  publicBaseURL,
} from '../e2e/helpers/auth'
import {
  fakeMediaState,
  publishableStudioPng,
  resetFakeMedia,
  smallStudioPng,
} from '../e2e/helpers/fake-media'
import {
  seedHeroCollections,
  seedPublicCatalog,
} from '../e2e/helpers/public-catalog'

async function seedSmokeCatalog(page: import('@playwright/test').Page) {
  await seedPublicCatalog(page, [
    {
      slug: 'e2e-public-smoke-work',
      characterName: '烟火',
      species: '赤狐',
      purpose: 'showcase',
      featured: true,
      sortOrder: 0,
      photos: [{ alt: '烟火出厂照' }],
    },
    {
      slug: 'e2e-public-smoke-available',
      characterName: '云雀',
      species: '犬科',
      purpose: 'adoption',
      adoptionStatus: 'available',
      featured: false,
      sortOrder: 1,
      adoptionCover: { alt: '云雀横版领养封面', width: 1920, height: 1080 },
      photos: [],
    },
    {
      slug: 'e2e-public-smoke-adopted',
      characterName: '月桂',
      species: '龙',
      purpose: 'adoption',
      adoptionStatus: 'adopted',
      featured: true,
      sortOrder: 2,
      adoptionCover: { alt: '月桂横版领养封面', width: 1920, height: 1080 },
      photos: [],
    },
  ])
}

async function fillCommission(
  page: import('@playwright/test').Page,
  input: { nickname: string, phone: string },
) {
  await page.goto(`${publicBaseURL}/commission/apply`)
  await expect(page.getByRole('heading', { level: 1, name: '提交委托申请' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.getByLabel(/称呼/u).fill(input.nickname)
  await page.getByLabel(/物种/u).fill('犬科')
  await page.getByLabel(/中国大陆手机号/u).fill(input.phone)
  await page.getByLabel(/^QQ/u).fill('999999')
  await page.getByLabel(/身高/u).fill('170')
  await page.getByLabel(/体重/u).fill('60.5')
  await expect(page.getByLabel(/称呼/u)).toHaveValue(input.nickname)
  await page.getByLabel('设定图', { exact: true }).setInputFiles({
    name: 'smoke-design-reference.png',
    mimeType: 'image/png',
    buffer: smallStudioPng(),
  })
  await expect(page.getByAltText('所选设定图预览')).toBeVisible()
}

async function confirmCommission(page: import('@playwright/test').Page) {
  await page.getByLabel(/已年满 18 周岁/u).check()
  await page.getByLabel(/已阅读《隐私政策》/u).check()
}

test('首页加载、主要入口与单项开放领养在三种视口可达', async ({ page }) => {
  await seedSmokeCatalog(page)
  await seedHeroCollections(page, {
    landscape: [{ alt: 'Smoke 首页横版', sortOrder: 0, enabled: true }],
    portrait: [{ alt: 'Smoke 首页竖版', sortOrder: 0, enabled: true }],
  })
  await seedHeroCollections(page, {
    placement: 'commission',
    landscape: [{ alt: 'Smoke 委托横版', sortOrder: 0, enabled: true }],
    portrait: [{ alt: 'Smoke 委托竖版', sortOrder: 0, enabled: true }],
  })

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByTestId('public-home')).toBeVisible()
    await expect(page.getByRole('link', { name: '查看全部作品' })).toBeVisible()
    await expect(page.getByRole('link', { name: /提交委托申请/u }).first()).toBeVisible()
    const current = page.getByTestId('home-current-adoptions')
    await expect(current).toBeVisible()
    await expect(current.getByRole('listitem')).toHaveCount(1)
    await expect(current).toContainText('云雀')
    await expect(current).not.toContainText('月桂')
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }
})

test('作品目录与作品详情可达', async ({ page }) => {
  await seedSmokeCatalog(page)
  await page.goto('/works')
  await expect(page.getByRole('heading', { level: 1, name: '作品展示' })).toBeVisible()
  await page.locator('[data-work-slug="e2e-public-smoke-work"]').click()
  await expect(page).toHaveURL(/\/works\/e2e-public-smoke-work$/u)
  await expect(page.getByRole('heading', { level: 1, name: '烟火' })).toBeVisible()
})

test('领养目录保持开放在前并可进入统一详情', async ({ page }) => {
  await seedSmokeCatalog(page)
  await page.goto('/adoptions')
  const cards = page.locator('.adoptions-page__grid [data-work-slug]')
  await expect(cards).toHaveCount(2)
  await expect(cards.first()).toContainText('云雀')
  await expect(cards.nth(1)).toContainText('月桂')
  await cards.first().click()
  await expect(page).toHaveURL(/\/works\/e2e-public-smoke-available$/u)
})

test('委托申请成功并且私有设定图不生成公开对象', async ({ page }) => {
  await resetFakeMedia(page)
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto(`${publicBaseURL}/commission/apply`)
    await expect(page.getByLabel(/已年满 18 周岁/u)).not.toBeChecked()
    await expect(page.getByLabel(/已阅读《隐私政策》/u)).not.toBeChecked()
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }
  await fillCommission(page, {
    nickname: 'Smoke 成功申请',
    phone: '19900000001',
  })
  await expect(page.getByLabel(/已年满 18 周岁/u)).not.toBeChecked()
  await expect(page.getByLabel(/已阅读《隐私政策》/u)).not.toBeChecked()
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('请确认已年满 18 周岁')).toBeVisible()
  await expect(page.getByText('请阅读隐私政策并确认')).toBeVisible()
  await expect(page.getByAltText('所选设定图预览')).toBeVisible()
  expect((await fakeMediaState(page)).putRecords).toHaveLength(0)
  await page.getByLabel(/已年满 18 周岁/u).focus()
  await page.keyboard.press('Space')
  await page.getByLabel(/已阅读《隐私政策》/u).focus()
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('申请已收到')).toBeVisible()
})

test('同手机号待处理申请拒绝重复提交并保留所选图片', async ({ page }) => {
  await resetFakeMedia(page)
  await fillCommission(page, {
    nickname: 'Smoke 首次申请',
    phone: '19900000002',
  })
  await confirmCommission(page)
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('申请已收到')).toBeVisible()

  await fillCommission(page, {
    nickname: 'Smoke 重复申请',
    phone: '19900000002',
  })
  await confirmCommission(page)
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('该手机号已有待处理的委托申请')).toBeVisible()
  await expect(page.getByAltText('所选设定图预览')).toBeVisible()
})

test('管理端对已拒绝申请先脱敏 dry-run，再单条删除', async ({ page, request }) => {
  await resetFakeMedia(page)
  const nickname = `Smoke 删除-${Date.now().toString(36)}`
  const phone = '19900000003'
  const qq = '999999'
  await fillCommission(page, { nickname, phone })
  await confirmCommission(page)
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('申请已收到')).toBeVisible()

  await loginAsAdmin(page)
  await page.goto(`${adminBaseURL}/admin/commissions`)
  await page.locator('.commission-inbox__item').filter({ hasText: nickname }).click()
  await expect(page).toHaveURL(/\/admin\/commissions\/[0-9a-f-]+$/u)
  await page.locator('#commission-status').selectOption('rejected')
  await page.getByRole('button', { name: '保存处理结果' }).click()
  await expect(page.getByRole('status')).toContainText('处理结果已保存')
  const submissionId = new URL(page.url()).pathname.split('/').at(-1)!

  await page.goto(`${adminBaseURL}/admin/commissions?status=rejected`)
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto(`${adminBaseURL}/admin/commissions?status=rejected`)
    const row = page.locator('.commission-inbox__row').filter({ hasText: nickname })
    await expect(row.getByRole('button', { name: '删除申请数据' })).toBeVisible()
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }
  const rejectedRow = page.locator('.commission-inbox__row').filter({ hasText: nickname })
  await rejectedRow.locator('.commission-inbox__item').click()
  await expect(page.getByRole('heading', { name: '删除申请数据' })).toBeVisible()

  const unauthenticated = await request.post(
    `${adminBaseURL}/api/admin/v1/commissions/${submissionId}/deletion`,
    {
      data: { execute: false },
      headers: { origin: adminBaseURL },
    },
  )
  expect(unauthenticated.status()).toBe(401)

  await page.getByRole('button', { name: '删除申请数据' }).click()
  const dialog = page.getByRole('dialog', { name: '确认删除这一条申请？' })
  await expect(dialog).toContainText('dry-run')
  await expect(dialog).toContainText('数据库直接关联行')
  await expect(dialog).toContainText('私有对象 Key：1')
  await expect(dialog).not.toContainText(phone)
  await expect(dialog).not.toContainText(qq)
  await expect(dialog).not.toContainText('test/commission')

  let executeRequests = 0
  let releaseExecute!: () => void
  const executeGate = new Promise<void>((resolve) => {
    releaseExecute = resolve
  })
  await page.route('**/api/admin/v1/commissions/*/deletion', async (route) => {
    executeRequests += 1
    await executeGate
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'synthetic deletion failure' },
      }),
    })
  }, { times: 1 })
  const confirm = dialog.locator('[data-confirm]')
  await confirm.evaluate((button) => {
    button.click()
    button.click()
  })
  await expect(confirm).toBeDisabled()
  await expect.poll(() => executeRequests).toBe(1)
  releaseExecute()

  await expect(dialog).toContainText('删除失败，数据库关系已保留或可安全重入')
  await expect(confirm).toBeEnabled()
  await confirm.click()

  await expect(page).toHaveURL(/\/admin\/commissions\?status=rejected$/u)
  await expect(page.locator('.commission-inbox__row').filter({ hasText: nickname })).toHaveCount(0)
  expect((await fakeMediaState(page)).objects.some(key => key.includes('/commission/'))).toBe(false)
})

test('管理员可通过登录表单进入后台', async ({ page }) => {
  await page.goto(`${adminBaseURL}/admin/login`)
  await page.getByLabel('用户名').fill(E2E_ADMIN.username)
  await page.getByLabel('密码', { exact: true }).fill(E2E_ADMIN.password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/\/admin\/works/u)
  await expect(page.getByTestId('admin-shell')).toBeVisible()
})

test('作品上传显示真实 XHR determinate 进度，并可发布和下架', async ({ page }) => {
  test.setTimeout(120_000)
  await loginAsAdmin(page)
  await resetFakeMedia(page)
  const work = await createWorkViaApi(page, { characterName: 'Smoke 发布作品' })
  await page.goto(`${adminBaseURL}/admin/works/${work.id}`)

  let releasePut!: () => void
  let markPutSeen!: () => void
  let markPutHandled!: () => void
  const putGate = new Promise<void>((resolve) => {
    releasePut = resolve
  })
  const putSeen = new Promise<void>((resolve) => {
    markPutSeen = resolve
  })
  const putHandled = new Promise<void>((resolve) => {
    markPutHandled = resolve
  })
  await page.route('**/api/e2e-fake-oss/**', async (route) => {
    if (route.request().method() === 'PUT') {
      markPutSeen()
      await putGate
    }
    await route.continue()
    if (route.request().method() === 'PUT') {
      markPutHandled()
    }
  })

  await page.getByLabel('选择出厂照文件').setInputFiles({
    name: 'smoke-upload.png',
    mimeType: 'image/png',
    buffer: publishableStudioPng(),
  })
  await page.getByRole('button', { name: '上传出厂照' }).click()
  await putSeen
  const uploadProgress = page.getByTestId('admin-task-progress')
    .filter({ hasText: 'smoke-upload.png' })
  await expect(uploadProgress).toBeVisible()
  const nativeProgress = uploadProgress.locator('progress')
  await expect(nativeProgress).toBeVisible()
  await expect(nativeProgress).toHaveAttribute('max', '1')
  await expect(nativeProgress).toHaveAttribute('value')
  releasePut()
  await putHandled
  await page.unroute('**/api/e2e-fake-oss/**')

  const photo = page.locator('article.photo-card').first()
  await expect(photo).toBeVisible()
  await photo.getByLabel(/图片说明/u).fill('Smoke 发布图')
  await page.getByRole('button', { name: '保存出厂照' }).click()
  await expect(page.getByText('出厂照已保存。')).toBeVisible()

  const panel = page.getByTestId('publication-panel')
  await panel.getByRole('button', { name: '发布', exact: true }).click()
  await expect(panel.getByTestId('admin-task-progress')).toContainText('作品发布')
  await expect(panel).toContainText('发布成功', { timeout: 60_000 })

  await panel.getByRole('button', { name: '下架', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认下架' }).click()
  await expect(panel).toContainText('已下架', { timeout: 60_000 })
})

test('隐私、服务条款和开源软件声明可读', async ({ page }) => {
  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]] as const) {
    await page.setViewportSize({ width, height })
    for (const [path, heading] of [
      ['/privacy', '隐私政策'],
      ['/service', '服务条款'],
      ['/licenses', '开源软件声明'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(page.locator('body')).not.toContainText('{{controller_name}}')
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ))).toBeLessThanOrEqual(1)
      if (path === '/licenses') {
        await expect(page.getByText(/Linux 发布镜像内实际二进制/u)).toBeVisible()
        await expect(page.getByRole('link', { name: '下载完整 TXT 声明' }))
          .toHaveAttribute('href', '/THIRD_PARTY_NOTICES.txt')
        await expect(page.locator('body')).not.toContainText('gyan.dev')
        await expect(page.locator('body')).not.toContainText('e38092ef93')
        await expect(page.locator('body')).not.toContainText('以下组件以 MIT 或 Apache-2.0 发布')
      }
    }
  }
})

import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from './helpers/auth'
import { bumpWorkViaApi, createWorkViaApi } from './helpers/admin-work'
import {
  fakeMediaState,
  lowResolutionDesignSheetPng,
  publishableStudioPng,
  resetFakeMedia,
  setFakeMediaFlags,
  smallStudioPng,
  uploadAdoptionCoverToEditor,
  uploadDesignSheetToEditor,
  uploadFileToEditor,
} from './helpers/fake-media'
import { capture } from './helpers/screenshots'

const photoCards = (page: import('@playwright/test').Page) =>
  page.locator('article.photo-card')

async function gotoEditor(page: import('@playwright/test').Page, workId: string) {
  await page.goto(`${adminBaseURL}/admin/works/${workId}`)
  await page.waitForSelector('.editor-card')
}

// 上传一张出厂照、填写说明并保存关系，使作品满足发布条件。
async function makePublishable(page: import('@playwright/test').Page) {
  await uploadFileToEditor(page, publishableStudioPng(), 'publish.png')
  await expect(photoCards(page)).toHaveCount(1)
  await photoCards(page).first().getByLabel(/图片说明/).fill('发布用出厂照')
  await page.getByRole('button', { name: '保存出厂照' }).click()
  await expect(page.getByText('出厂照已保存。')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  // dev 服务器首次编译发布链路的 API 路由较慢，放宽测试级超时。
  test.setTimeout(90_000)
  await loginAsAdmin(page)
  await resetFakeMedia(page)
})

test.afterEach(async ({ page }) => {
  await resetFakeMedia(page)
})

test('发布检查阻断项中文映射与发布按钮禁用', async ({ page }) => {
  const work = await createWorkViaApi(page, { characterName: '检查验证' })
  await gotoEditor(page, work.id)

  const panel = page.getByTestId('publication-panel')
  await expect(panel).toContainText('暂不可发布')
  await expect(panel).toContainText('至少需要一张出厂照')
  await expect(panel.getByRole('button', { name: '发布', exact: true })).toBeDisabled()

  await makePublishable(page)
  await expect(panel).toContainText('可以发布')
  await expect(panel).toContainText(/发布时将生成 12 张带水印公开图片/)
  await expect(panel.getByRole('button', { name: '发布', exact: true })).toBeEnabled()
})

test('发布会先自动保存基础信息、三类媒体，再完成领养作品发布', async ({ page }) => {
  const work = await createWorkViaApi(page, {
    characterName: '领养作品发布验证',
    purpose: 'adoption',
    adoptionStatus: 'available',
    priceCnyMinor: 12_800_00,
  })
  await gotoEditor(page, work.id)

  const panel = page.getByTestId('publication-panel')
  await expect(panel).toContainText('领养作品必须保存一张独立横版封面')
  await expect(panel.getByRole('button', { name: '发布', exact: true })).toBeDisabled()

  // 空态下横版封面的操作行不能贴着虚线图像框，和「领养设定图」一致留出间距。
  const coverGap = await page.evaluate(() => {
    const frame = document.querySelector('.cover__empty')!.getBoundingClientRect()
    const actions = document.querySelector('.editor-card > .cover__actions')!
      .getBoundingClientRect()
    return Math.round(actions.top - frame.bottom)
  })
  expect(coverGap).toBeGreaterThanOrEqual(8)

  await uploadAdoptionCoverToEditor(page, publishableStudioPng(), 'adoption-cover.png')
  const adoptionCover = page.locator('.cover__entry')
  await expect(adoptionCover).toHaveCount(1)
  await adoptionCover.getByLabel(/图片说明/).fill('领养作品独立横版封面')
  await uploadDesignSheetToEditor(page, publishableStudioPng(), 'adoption-design.png')
  const designSheet = page.locator('.design-sheet__entry')
  await expect(designSheet).toHaveCount(1)
  await designSheet.getByLabel(/图片说明/).fill('领养作品完整设定图')
  await uploadFileToEditor(page, publishableStudioPng(), 'adoption-photo.png')
  await expect(photoCards(page)).toHaveCount(1)
  await photoCards(page).getByLabel(/图片说明/).fill('领养作品出厂照')
  await page.getByLabel(/角色名/).fill('领养作品自动保存验证')

  await expect(page.getByText('有未保存更改', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: '发布', exact: true })).toBeEnabled()
  await panel.getByRole('button', { name: '发布', exact: true }).click()
  await expect(panel).toContainText('发布成功', { timeout: 60_000 })
  await expect(page.getByLabel(/角色名/)).toHaveValue('领养作品自动保存验证')
  await expect(adoptionCover.getByLabel(/图片说明/)).toHaveValue('领养作品独立横版封面')
  await expect(designSheet.getByLabel(/图片说明/)).toHaveValue('领养作品完整设定图')
  await expect(photoCards(page).getByLabel(/图片说明/)).toHaveValue('领养作品出厂照')
  await expect(page.getByTestId('public-preview')).toContainText(`/works/${work.slug}`)

  await page.reload()
  await page.waitForSelector('.editor-card')
  await expect(page.getByLabel(/角色名/)).toHaveValue('领养作品自动保存验证')
  await expect(page.locator('.cover__entry').getByLabel(/图片说明/)).toHaveValue('领养作品独立横版封面')
  await expect(page.locator('.design-sheet__entry').getByLabel(/图片说明/)).toHaveValue('领养作品完整设定图')
  await expect(photoCards(page).getByLabel(/图片说明/)).toHaveValue('领养作品出厂照')
})

test('低分辨率出厂照保留原图、明确提示并经 FFmpeg 适配后发布', async ({ page }) => {
  test.setTimeout(120_000)
  const work = await createWorkViaApi(page, { characterName: '低分辨率出厂照验证' })
  await gotoEditor(page, work.id)
  await uploadFileToEditor(page, smallStudioPng(), 'small.png')
  await expect(photoCards(page)).toHaveCount(1)
  await photoCards(page).first().getByLabel(/图片说明/).fill('低分辨率出厂照')
  await page.getByRole('button', { name: '保存出厂照' }).click()
  await expect(page.getByText('出厂照已保存。')).toBeVisible()
  await expect(page.locator('#studio-photos')).toContainText('低分辨率照片也可以上传和保存')
  await expect(page.locator('#studio-photos')).toContainText('完整原图会保留')

  const panel = page.getByTestId('publication-panel')
  await expect(panel).toContainText('有出厂照原图分辨率较低，但可以发布')
  await expect(panel).not.toContainText('有出厂照尺寸不足')
  await expect(panel.getByRole('button', { name: '发布', exact: true })).toBeEnabled()

  await setFakeMediaFlags(page, { failPut: true })
  let releaseStudioPublish!: () => void
  const studioPublishGate = new Promise<void>((resolve) => {
    releaseStudioPublish = resolve
  })
  await page.route(`**/api/admin/v1/works/${work.id}/publish`, async (route) => {
    await studioPublishGate
    await route.continue()
  }, { times: 1 })
  await panel.getByRole('button', { name: '发布', exact: true }).click()
  await expect(panel.getByTestId('ffmpeg-progress')).toBeVisible()
  await expect(panel.getByTestId('ffmpeg-progress')).toContainText('已等待')
  releaseStudioPublish()
  await expect(panel.getByRole('alert')).toContainText(
    '出厂照尺寸适配失败，完整原图已保留',
    { timeout: 60_000 },
  )
  await expect(panel).toContainText('草稿')

  await setFakeMediaFlags(page, { failPut: false })
  await panel.getByRole('button', { name: '发布', exact: true }).click()
  await expect(panel).toContainText('发布成功', { timeout: 60_000 })

  const state = await fakeMediaState(page)
  expect(state.objects.some(key =>
    key.includes('/studio-photo-upscale-lanczos-v1/'),
  )).toBe(true)
  expect(state.objects.some(key => key.includes('/original/'))).toBe(true)
  expect(state.publicObjects.filter(key => key.includes('/web/'))).toHaveLength(12)
})

test('低分辨率设定图保留原图、明确提示并经 FFmpeg 适配后发布', async ({ page }) => {
  test.setTimeout(120_000)
  const work = await createWorkViaApi(page, {
    characterName: '低分辨率设定图验证',
    purpose: 'adoption',
    adoptionStatus: 'available',
  })
  await gotoEditor(page, work.id)
  await uploadAdoptionCoverToEditor(page, publishableStudioPng(), 'design-test-cover.png')
  await page.locator('.cover__entry').getByLabel(/图片说明/).fill('低分辨率测试横版封面')
  await page.getByRole('button', { name: '保存横版封面' }).click()
  await makePublishable(page)
  await uploadDesignSheetToEditor(
    page,
    lowResolutionDesignSheetPng(),
    'low-resolution-design.png',
  )
  const designSheet = page.locator('.design-sheet__entry')
  await expect(designSheet).toHaveCount(1)
  await designSheet.getByLabel(/图片说明/).fill('低分辨率完整设定图')
  await page.getByRole('button', { name: '保存设定图' }).click()
  await expect(designSheet).toContainText('仍可保存和发布')
  await expect(designSheet).toContainText('发布时会用 FFmpeg Lanczos 生成私有适配源，然后才会执行上传')

  const panel = page.getByTestId('publication-panel')
  await expect(panel).toContainText('设定图原图分辨率较低，但可以发布')
  await expect(panel).not.toContainText('设定图尺寸不足，无法生成公开图片')
  await expect(panel.getByRole('button', { name: '发布', exact: true })).toBeEnabled()

  await setFakeMediaFlags(page, { failPut: true })
  let releaseDesignPublish!: () => void
  const designPublishGate = new Promise<void>((resolve) => {
    releaseDesignPublish = resolve
  })
  await page.route(`**/api/admin/v1/works/${work.id}/publish`, async (route) => {
    await designPublishGate
    await route.continue()
  }, { times: 1 })
  await panel.getByRole('button', { name: '发布', exact: true }).click()
  await expect(panel.getByTestId('ffmpeg-progress')).toBeVisible()
  await expect(panel.getByTestId('ffmpeg-progress')).toContainText('已等待')
  releaseDesignPublish()
  await expect(panel.getByRole('alert')).toContainText(
    '设定图尺寸适配失败，完整原图已保留',
    { timeout: 60_000 },
  )
  await expect(panel).toContainText('草稿')

  await setFakeMediaFlags(page, { failPut: false })
  await panel.getByRole('button', { name: '发布', exact: true }).click()
  await expect(panel).toContainText('发布成功', { timeout: 60_000 })

  const state = await fakeMediaState(page)
  expect(state.objects.some(key =>
    key.includes('/design-sheet-upscale-lanczos-v1/'),
  )).toBe(true)
  expect(state.objects.some(key => key.includes('/original/'))).toBe(true)
  expect(state.publicObjects.filter(key => key.includes('/web/'))).toHaveLength(24)
})

test('发布成功：状态翻转、编辑锁定、公开预览媒体就绪', async ({ page }) => {
  const work = await createWorkViaApi(page, { characterName: '发布验证' })
  await gotoEditor(page, work.id)
  await makePublishable(page)

  let releasePublish!: () => void
  const publishGate = new Promise<void>((resolve) => {
    releasePublish = resolve
  })
  await page.route(`**/api/admin/v1/works/${work.id}/publish`, async (route) => {
    await publishGate
    await route.continue()
  })
  await page.getByRole('button', { name: '发布', exact: true }).click()
  const panel = page.getByTestId('publication-panel')
  await expect(panel.getByRole('progressbar')).toBeVisible()
  await expect(panel).toContainText('已生成 0 / 12，剩余 12 张')
  releasePublish()
  await expect(panel).toContainText('发布成功', { timeout: 60_000 })
  await expect(panel.getByRole('progressbar')).toHaveCount(0)
  await expect(panel).toContainText('已发布')
  await expect(page.getByText(/作品已发布：基础信息与图片为只读/)).toBeVisible()
  await expect(page.getByLabel(/角色名/)).toBeDisabled()
  await expect(page.getByTestId('public-preview')).toContainText('媒体就绪')

  // fake 公开 Bucket 收到 12 张衍生对象；公开预览地址出现在面板中。
  const state = await fakeMediaState(page)
  expect(state.processCalls).toBe(12)
  expect(state.publicObjects.filter(key => key.includes('/web/'))).toHaveLength(12)
  await expect(page.getByTestId('public-preview')).toContainText(`/works/${work.slug}`)

  // 刷新后发布状态持久。
  await page.reload()
  await page.waitForSelector('.editor-card')
  await expect(page.getByTestId('publication-panel')).toContainText('已发布')
  await capture(page, 'work-published-1440x900')
})

test('公开生成失败：持久错误反馈，恢复后可重新发布', async ({ page }) => {
  const work = await createWorkViaApi(page, { characterName: '失败验证' })
  await gotoEditor(page, work.id)
  await makePublishable(page)

  await setFakeMediaFlags(page, { failProcess: true })
  await page.getByRole('button', { name: '发布', exact: true }).click()
  const panel = page.getByTestId('publication-panel')
  await expect(panel.getByRole('alert')).toContainText('公开图片生成失败', { timeout: 60_000 })
  // 失败反馈持久显示，不自动消失；作品仍为草稿。
  await expect(panel).toContainText('草稿')
  await expect(panel.getByRole('alert')).toBeVisible()
  await capture(page, 'publish-failed-1440x900')

  await setFakeMediaFlags(page, { failProcess: false })
  await page.getByRole('button', { name: '发布', exact: true }).click()
  await expect(panel).toContainText('发布成功', { timeout: 60_000 })
})

test('下架确认、公开影响说明与下架后恢复可编辑', async ({ page }) => {
  const work = await createWorkViaApi(page, { characterName: '下架验证' })
  await gotoEditor(page, work.id)
  await makePublishable(page)
  await page.getByRole('button', { name: '发布', exact: true }).click()
  await expect(page.getByTestId('publication-panel')).toContainText('已发布', { timeout: 60_000 })

  await page.getByRole('button', { name: '下架', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('下架后公开页面立即对访客不可见')
  await expect(dialog).toContainText('完整原图与作品内容保留')
  await dialog.getByRole('button', { name: '确认下架' }).click()

  const panel = page.getByTestId('publication-panel')
  await expect(panel).toContainText('已下架', { timeout: 60_000 })
  await expect(panel).toContainText('已下架：公开页面不再可访问')
  // 公开对象已删除；编辑器恢复可编辑。
  const state = await fakeMediaState(page)
  expect(state.publicObjects).toHaveLength(0)
  await expect(page.getByLabel(/角色名/)).toBeEnabled()
})

test('下架清理失败：持久“待清理”反馈与重试清理成功', async ({ page }) => {
  const work = await createWorkViaApi(page, { characterName: '清理验证' })
  await gotoEditor(page, work.id)
  await makePublishable(page)
  await page.getByRole('button', { name: '发布', exact: true }).click()
  await expect(page.getByTestId('publication-panel')).toContainText('已发布', { timeout: 60_000 })

  await setFakeMediaFlags(page, { failDelete: true })
  await page.getByRole('button', { name: '下架', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认下架' }).click()

  const panel = page.getByTestId('publication-panel')
  await expect(panel.getByRole('alert')).toContainText(
    '作品已下架，但公开文件或 ESA 缓存撤销未完成',
    { timeout: 60_000 },
  )
  await expect(panel.getByRole('alert')).toContainText('作品不会重新公开')
  await capture(page, 'unpublish-cleanup-pending-1440x900')

  // 清理失败时公开对象仍在；重试清理成功后删除。
  const before = await fakeMediaState(page)
  expect(before.publicObjects.length).toBeGreaterThan(0)
  await setFakeMediaFlags(page, { failDelete: false })
  await panel.getByRole('button', { name: '重试清理公开文件' }).click()
  await expect(panel).toContainText('公开文件与 ESA 缓存撤销完成', { timeout: 60_000 })
  const after = await fakeMediaState(page)
  expect(after.publicObjects).toHaveLength(0)
})

test('发布版本冲突：操作按发布检查失败持久呈现，作品不变', async ({ page }) => {
  const work = await createWorkViaApi(page, { characterName: '冲突发布' })
  await gotoEditor(page, work.id)
  await makePublishable(page)

  await bumpWorkViaApi(page, work, { characterName: '远端改动' })
  await page.getByRole('button', { name: '发布', exact: true }).click()
  const panel = page.getByTestId('publication-panel')
  // 服务端对过期版本返回 FAILED operation（发布检查阶段），作品保持草稿且反馈持久。
  await expect(panel.getByRole('alert')).toContainText('发布检查未通过')
  await expect(panel).toContainText('草稿')
  // 页面随即刷新作品：发布按钮恢复到最新版本可用状态。
  await expect(panel.getByRole('button', { name: '发布', exact: true })).toBeEnabled()
  await expect(page.getByLabel(/角色名/)).toHaveValue('远端改动')
})

test('发布区域三视口截图', async ({ page }) => {
  const work = await createWorkViaApi(page, { characterName: '发布视口' })
  await gotoEditor(page, work.id)
  await makePublishable(page)

  for (const [width, height, label] of [
    [390, 844, '390x844'],
    [768, 1024, '768x1024'],
    [1440, 900, '1440x900'],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')
    await expect(page.getByTestId('publication-panel')).toContainText('可以发布')
    await capture(page, `publication-panel-${label}`)
    const overflow = await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${label} 发布区域不应横向溢出`).toBeLessThanOrEqual(1)
  }
})

import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from './helpers/auth'
import { createWorkViaApi } from './helpers/admin-work'
import {
  fakeMediaState,
  largeStudioPng,
  resetFakeMedia,
  setFakeMediaFlags,
  smallStudioPng,
  uploadFileToEditor,
} from './helpers/fake-media'
import { capture } from './helpers/screenshots'

async function gotoEditor(page: import('@playwright/test').Page, workId: string) {
  await page.goto(`${adminBaseURL}/admin/works/${workId}`)
  await page.waitForSelector('.editor-card')
}

// 出厂照关系卡片（article.photo-card）定位。
const photoCards = (page: import('@playwright/test').Page) =>
  page.locator('article.photo-card')

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
  await resetFakeMedia(page)
})

test.afterEach(async ({ page }) => {
  await resetFakeMedia(page)
})

test.describe('出厂照上传链路', () => {
  test('上传成功：摘要、进度、服务端校验、READY、PUT 条件头与保存持久化', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '上传验证' })
    await gotoEditor(page, work.id)

    // 延迟 fake PUT 以观察“私有上传中”与进度条。
    let releasePut!: () => void
    const putGate = new Promise<void>((resolvePromise) => {
      releasePut = resolvePromise
    })
    await page.route('**/api/e2e-fake-oss/**', async (route) => {
      await putGate
      await route.continue()
    })

    const content = smallStudioPng()
    await uploadFileToEditor(page, content, 'front.png')
    await expect(page.getByRole('button', { name: '处理中…' })).toBeVisible()
    await expect(page.getByText(/私有上传中/)).toBeVisible()
    await expect(page.getByRole('progressbar')).toBeVisible()
    releasePut()

    // READY 后进入出厂照关系列表。
    await expect(photoCards(page)).toHaveCount(1)
    await expect(photoCards(page).first()).toContainText('READY')
    await expect(photoCards(page).first()).toContainText('主图')
    await expect(page.getByText('出厂照有未保存更改')).toBeVisible()

    // fake OSS 收到的 PUT 条件头符合契约（MD5/SHA-256/禁止覆盖/Content-Type）。
    const state = await fakeMediaState(page)
    expect(state.putRecords).toHaveLength(1)
    const put = state.putRecords[0]!
    expect(put.contentMd5).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    expect(put.sha256Metadata).toMatch(/^[0-9a-f]{64}$/)
    expect(put.forbidOverwrite).toBe('true')
    expect(put.contentType).toBe('image/png')
    expect(put.byteSize).toBe(content.length)
    expect(state.objects.some(key => key.includes('/original/'))).toBe(true)

    // 填写说明并保存出厂照。
    await photoCards(page).first().getByLabel(/图片说明/).fill('正面全身，自然光')
    await page.getByRole('button', { name: '保存出厂照' }).click()
    await expect(page.getByText('出厂照已保存。')).toBeVisible()
    await expect(page.getByText('出厂照有未保存更改')).toHaveCount(0)

    // 刷新后通过 assetId 换取短时签名 GET，继续显示私有原图预览。
    await page.reload()
    await page.waitForSelector('.editor-card')
    await expect(photoCards(page)).toHaveCount(1)
    await expect(photoCards(page).first()).toContainText('READY')
    await expect(photoCards(page).first().getByLabel(/图片说明/)).toHaveValue('正面全身，自然光')
    await expect(photoCards(page).first().getByTestId('photo-preview')).toBeVisible()
    await expect(photoCards(page).first().locator('img')).toHaveAttribute(
      'src',
      /\/api\/e2e-fake-oss\//,
    )
    await expect(page.getByText('未更改')).toBeVisible()
  })

  test('浏览器预检查拒绝不支持的类型与解码失败文件', async ({ page }) => {
    const work = await createWorkViaApi(page)
    await gotoEditor(page, work.id)

    const input = page.getByLabel('选择出厂照文件')
    await input.setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    })
    await page.getByRole('button', { name: '上传出厂照' }).click()
    await expect(page.getByRole('alert')).toContainText('仅支持 JPEG、PNG 或 WebP')

    await input.setInputFiles({
      name: 'broken.png',
      mimeType: 'image/png',
      buffer: Buffer.from('definitely not png bytes'),
    })
    await page.getByRole('button', { name: '上传出厂照' }).click()
    await expect(page.getByRole('alert').last()).toContainText('无法解码')

    // 预检查失败从未创建上传会话。
    const state = await fakeMediaState(page)
    expect(state.putRecords).toHaveLength(0)
  })

  test('摘要/元数据不一致：失败阶段可读，新会话重新上传成功', async ({ page }) => {
    const work = await createWorkViaApi(page)
    await gotoEditor(page, work.id)

    await setFakeMediaFlags(page, { omitSha256OnNextPut: true })
    await uploadFileToEditor(page, smallStudioPng(), 'digest.png')

    await expect(page.getByRole('alert')).toContainText('文件摘要或元数据与声明不一致')
    await expect(page.getByRole('alert')).toContainText('对象检查')

    await page.getByRole('button', { name: '重新上传' }).click()
    await expect(photoCards(page)).toHaveCount(1)
    await expect(photoCards(page).first()).toContainText('READY')
  })

  test('图片格式/尺寸核验失败：显示安全失败文案与阶段', async ({ page }) => {
    const work = await createWorkViaApi(page)
    await gotoEditor(page, work.id)

    // 在 complete 到达前注入伪造的 OSS 图片信息（格式 bmp）。
    await page.route('**/api/admin/v1/media/upload-sessions/*/complete', async (route) => {
      const state = await fakeMediaState(page)
      const key = state.objects.at(-1)
      if (key) {
        await setFakeMediaFlags(page, {}, {
          key,
          info: {
            fileSize: 41_092,
            format: 'bmp',
            height: 64,
            orientation: 1,
            width: 160,
          },
        })
      }
      await route.continue()
    })

    await uploadFileToEditor(page, smallStudioPng(), 'format.png')
    await expect(page.getByRole('alert')).toContainText('图片尺寸或格式不符合要求')
    await expect(page.getByRole('alert')).toContainText('图片信息')
  })

  test('签名过期：OSS 以 403 拒绝 PUT，界面显示已过期且不复用旧 URL', async ({ page }) => {
    const work = await createWorkViaApi(page)
    await gotoEditor(page, work.id)

    await setFakeMediaFlags(page, { rejectNextPut403: true })
    await uploadFileToEditor(page, smallStudioPng(), 'expire.png')

    await expect(page.getByRole('alert')).toContainText('上传签名已过期')
    // 过期 PUT 未写入对象；界面提供重新上传入口（新会话、新签名 URL）。
    const state = await fakeMediaState(page)
    expect(state.putRecords).toHaveLength(0)
    await expect(page.getByRole('button', { name: '重新上传' })).toBeVisible()
  })
})

test.describe('大原图私有处理源', () => {
  test.setTimeout(120_000)

  test('20 MB 以上原图经内嵌 FFmpeg 生成处理源后 READY', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '大图验证' })
    await gotoEditor(page, work.id)

    const content = largeStudioPng()
    expect(content.length).toBeGreaterThan(20_000_000)
    await uploadFileToEditor(page, content, 'large.png')

    // 校验/预处理阶段文案（不把 100% PUT 当成 READY）。
    await expect(page.getByText(/服务端校验中/)).toBeVisible()
    await expect(photoCards(page)).toHaveCount(1)
    const card = photoCards(page).first()
    await expect(card).toContainText('READY', { timeout: 90_000 })

    await card.getByLabel(/图片说明/).fill('大尺寸全身照')
    await page.getByRole('button', { name: '保存出厂照' }).click()
    await expect(page.getByText('出厂照已保存。')).toBeVisible()
  })

  test('预处理失败：保留卡片与失败阶段，重试处理后 READY', async ({ page }) => {
    const work = await createWorkViaApi(page)
    await gotoEditor(page, work.id)

    await setFakeMediaFlags(page, { failPut: true })
    await uploadFileToEditor(page, largeStudioPng(), 'fail-large.png')

    const uploadCard = page.locator('article.upload-card').first()
    await expect(uploadCard).toContainText('处理失败', { timeout: 90_000 })
    await expect(photoCards(page)).toHaveCount(0)

    await setFakeMediaFlags(page, { failPut: false })
    await uploadCard.getByRole('button', { name: '重试处理' }).click()
    await expect(photoCards(page)).toHaveCount(1, { timeout: 90_000 })
    await expect(photoCards(page).first()).toContainText('READY')
  })
})

test.describe('出厂照关系编辑', () => {
  async function uploadTwoPhotos(page: import('@playwright/test').Page) {
    await uploadFileToEditor(page, smallStudioPng(), 'first.png')
    await expect(photoCards(page)).toHaveCount(1)
    await uploadFileToEditor(page, smallStudioPng(), 'second.png')
    await expect(photoCards(page)).toHaveCount(2)
  }

  test('主图、排序、alt 与焦点保存并持久化', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '关系验证' })
    await gotoEditor(page, work.id)
    await uploadTwoPhotos(page)

    const first = photoCards(page).nth(0)
    const second = photoCards(page).nth(1)
    await expect(first).toContainText('主图')

    // 第二张设为主图 → 唯一主图转移。
    await second.getByRole('button', { name: '设为主图' }).click()
    await expect(second).toContainText('主图')

    // 第二张上移 → 顺序交换（现在它是第一张）。
    await second.getByRole('button', { name: '上移' }).click()

    const head = photoCards(page).nth(0)
    await head.getByLabel(/图片说明/).fill('新的首图说明')
    await photoCards(page).nth(1).getByLabel(/图片说明/).fill('次图说明')

    // 焦点滑杆。
    await head.getByLabel(/焦点水平/).fill('25')
    await head.getByLabel(/焦点垂直/).fill('75')

    await page.getByRole('button', { name: '保存出厂照' }).click()
    await expect(page.getByText('出厂照已保存。')).toBeVisible()

    await page.reload()
    await page.waitForSelector('.editor-card')
    const persistedHead = photoCards(page).nth(0)
    await expect(persistedHead).toContainText('主图')
    await expect(persistedHead.getByLabel(/图片说明/)).toHaveValue('新的首图说明')
    await expect(persistedHead.getByLabel(/焦点水平/)).toHaveValue('25')
    await expect(persistedHead.getByLabel(/焦点垂直/)).toHaveValue('75')
    await expect(photoCards(page).nth(1).getByLabel(/图片说明/)).toHaveValue('次图说明')
  })

  test('移除关系后保存生效，原图不从私有库删除', async ({ page }) => {
    const work = await createWorkViaApi(page)
    await gotoEditor(page, work.id)
    await uploadTwoPhotos(page)

    await photoCards(page).nth(1).getByRole('button', { name: '移除' }).click()
    await expect(photoCards(page)).toHaveCount(1)
    await photoCards(page).first().getByLabel(/图片说明/).fill('保留的出厂照')
    await page.getByRole('button', { name: '保存出厂照' }).click()
    await expect(page.getByText('出厂照已保存。')).toBeVisible()

    await page.reload()
    await page.waitForSelector('.editor-card')
    await expect(photoCards(page)).toHaveCount(1)

    // 解除关系不删除私有原图。
    const state = await fakeMediaState(page)
    expect(state.deletedPrivateKeys.filter(key => key.includes('/original/'))).toHaveLength(0)
  })

  test('主图被移除时首张自动补位，保持唯一主图', async ({ page }) => {
    const work = await createWorkViaApi(page)
    await gotoEditor(page, work.id)
    await uploadTwoPhotos(page)

    await photoCards(page).nth(0).getByRole('button', { name: '移除' }).click()
    await expect(photoCards(page)).toHaveCount(1)
    await expect(photoCards(page).first()).toContainText('主图')
  })
})

test.describe('出厂照区域：泄漏边界与三视口', () => {
  test('DOM 与响应不渲染私有 Key 或签名 URL；本地预览不含水印声明', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '边界检查' })
    await gotoEditor(page, work.id)
    await uploadFileToEditor(page, smallStudioPng(), 'leak.png')
    await expect(photoCards(page)).toHaveCount(1)

    const dom = await page.content()
    expect(dom).not.toContain('/original/')
    expect(dom).not.toContain('/api/e2e-fake-oss/')
    expect(dom).not.toContain('x-oss-')
    expect(dom).not.toContain('Signature=')
    await expect(photoCards(page).first()).toContainText('不含水印')

    await page.getByLabel(/图片说明/).fill('边界图')
    await page.getByRole('button', { name: '保存出厂照' }).click()
    await expect(page.getByText('出厂照已保存。')).toBeVisible()
    const domAfterSave = await page.content()
    expect(domAfterSave).not.toContain('/original/')
    expect(domAfterSave).not.toContain('/api/e2e-fake-oss/')
  })

  test('编辑器出厂照区域三视口截图与横向溢出检查', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '视口验证' })
    await gotoEditor(page, work.id)
    await uploadFileToEditor(page, smallStudioPng(), 'viewport.png')
    await expect(photoCards(page)).toHaveCount(1)
    await photoCards(page).first().getByLabel(/图片说明/).fill('视口图')
    await page.getByRole('button', { name: '保存出厂照' }).click()
    await expect(page.getByText('出厂照已保存。')).toBeVisible()

    for (const [width, height, label] of [
      [390, 844, '390x844'],
      [768, 1024, '768x1024'],
      [1440, 900, '1440x900'],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
      await page.waitForSelector('.editor-card')
      await expect(photoCards(page)).toHaveCount(1)
      await capture(page, `work-editor-${label}`)
      const overflow = await page.evaluate(() =>
        document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${label} 编辑页不应横向溢出`).toBeLessThanOrEqual(1)
    }
  })

  test('手机视口：创建、文字、单图上传完整可用', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const work = await createWorkViaApi(page, { characterName: '手机验证' })
    await gotoEditor(page, work.id)

    await page.getByLabel(/角色名/).fill('手机验证改')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByText('已保存。')).toBeVisible()

    await uploadFileToEditor(page, smallStudioPng(), 'mobile.png')
    await expect(photoCards(page)).toHaveCount(1)
    await expect(photoCards(page).first()).toContainText('READY')
    await capture(page, 'work-editor-mobile-upload-390x844')
  })
})

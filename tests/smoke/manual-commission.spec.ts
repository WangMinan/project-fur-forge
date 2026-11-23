import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { adminBaseURL, E2E_DATABASE_FILE, loginAsAdmin } from '../e2e/helpers/auth'
import { openFixtureDatabase } from '../e2e/helpers/fixture-db'
import { smallStudioPng, setFakeMediaFlags } from '../e2e/helpers/fake-media'
import { createWorkViaApi } from '../e2e/helpers/admin-work'

test.use({ hasTouch: true })
async function hydrated(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as HTMLElement & { __vue_app__?: unknown })?.__vue_app__))
}
function minimum() {
  return { nickname: '虚构接口申请', channel: 'qq', channelLabel: null, species: null, phone: null, qq: '88001177', otherContact: null,
    heightCm: null, weightKg: null, originalAppliedOn: null, historicalHandledOn: null, status: 'pending', internalNote: null,
    offlineAdultConfirmed: false, offlinePrivacyConfirmed: false }
}

test('manual entry, confirmed duplicate, private image, acceptance and PDF work together without mail', async ({ page }, info) => {
  test.setTimeout(180_000)
  const session = await loginAsAdmin(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${adminBaseURL}/admin/commissions`)
  await hydrated(page)
  await page.getByRole('link', { name: '录入申请', exact: true }).click()
  await page.getByLabel('称呼', { exact: false }).fill('虚构补录浏览器测试')
  await page.getByLabel('QQ号', { exact: false }).fill('88112277')
  await page.getByRole('button', { name: '保存并继续录入', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '可以继续录入下一条' })).toBeVisible()
  await expect(page.getByLabel('称呼', { exact: false })).toHaveValue('')
  await page.getByLabel('称呼', { exact: false }).fill('虚构第二套委托')
  await page.getByLabel('QQ号', { exact: false }).fill('88112277')
  await page.getByRole('button', { name: '保存并查看', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '发现相同联系方式的申请' })
  await expect(dialog).toContainText('QQ相同')
  await expect(dialog.getByRole('button', { name: '返回修改' })).toBeFocused()
  await page.screenshot({ path: info.outputPath('conflict.png'), fullPage: true })
  await dialog.getByRole('button', { name: '返回修改' }).click()
  await expect(page.getByLabel('称呼', { exact: false })).toHaveValue('虚构第二套委托')
  await page.getByRole('button', { name: '保存并查看', exact: true }).click()
  await dialog.getByRole('button', { name: '确认继续录入' }).click()
  await expect(page).toHaveURL(/\/admin\/commissions\/[0-9a-f-]+$/u)
  const id = page.url().split('/').at(-1)!
  await expect(page.getByText('后台录入 · 无需邮件。', { exact: false })).toBeVisible()
  await expect(page.getByText('暂未上传设定图。', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '编辑申请', exact: true }).click()
  await page.getByLabel('选择设定图', { exact: false }).setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: smallStudioPng() })
  await expect(page.getByRole('status').filter({ hasText: '图片已核验' })).toBeVisible()
  await expect(page.getByRole('img', { name: '委托申请私有设定图' })).toBeVisible()
  expect(await page.getByRole('img', { name: '委托申请私有设定图' }).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
  await page.getByRole('combobox', { name: '处理状态' }).click()
  await page.getByRole('option', { name: '已接受', exact: true }).click()
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(page.getByText('接受前请确认申请人已成年')).toBeVisible()
  await page.getByLabel('已在线下确认申请人已成年').check()
  await page.getByLabel('已在线下确认资料用于委托处理').check()
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(page.getByRole('button', { name: '导出制作单', exact: true })).toBeVisible()
  const editPosition = await page.getByRole('button', { name: '编辑申请', exact: true }).boundingBox()
  const exportPosition = await page.getByRole('button', { name: '导出制作单', exact: true }).boundingBox()
  expect(exportPosition!.x - editPosition!.x - editPosition!.width, '详情页操作应靠右相邻，不被space-between分散').toBeLessThanOrEqual(16)
  expect(editPosition!.y).toBe(exportPosition!.y)
  const pdf = await page.request.get(`${adminBaseURL}/api/admin/v1/commissions/${id}/work-order`)
  expect(pdf.status()).toBe(200)
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')
  const retry = await page.request.post(`${adminBaseURL}/api/admin/v1/commissions/${id}/email-retry`, {
    data: { notificationId: randomUUID() }, headers: { Origin: adminBaseURL, 'x-csrf-token': session.csrfToken },
  })
  expect(retry.status()).toBe(409)
  const db = openFixtureDatabase(E2E_DATABASE_FILE)
  try { expect(db.prepare('SELECT count(*) FROM commission_email_notifications WHERE submission_id = ?').pluck().get(id)).toBe(0) }
  finally { db.close() }
  await page.screenshot({ path: info.outputPath('detail.png'), fullPage: true })
  await page.getByRole('button', { name: '编辑申请', exact: true }).click()
  await page.getByRole('button', { name: '移除设定图', exact: true }).click()
  await page.getByRole('dialog', { name: '移除设定图？' }).getByRole('button', { name: '移除，保存后生效' }).click()
  await page.getByRole('combobox', { name: '处理状态' }).click()
  await page.getByRole('option', { name: '已拒绝', exact: true }).click()
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(page.getByText('暂未上传设定图。', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '删除申请数据', exact: true }).click()
  await page.getByRole('dialog', { name: '确认删除这一条申请？' }).getByRole('button', { name: '确认永久删除' }).click()
  await expect(page).toHaveURL(/\/admin\/commissions\?status=rejected$/u)
  expect(errors).toEqual([])
})

test('entry form handles narrow layouts, keyboard, leave protection and missing contact validation', async ({ page }, info) => {
  test.setTimeout(120_000)
  await loginAsAdmin(page)
  await page.goto(`${adminBaseURL}/admin/commissions/new`)
  await hydrated(page)
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  for (const width of [320, 390, 768, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: '保存并查看' })).toBeVisible()
    if (width === 390 || width === 1440) await page.screenshot({ path: info.outputPath(`form-${width}.png`), fullPage: true })
  }
  await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
  await page.getByRole('button', { name: '保存并查看' }).click()
  await expect(page.getByLabel('称呼', { exact: false })).toBeFocused()
  await expect(page.getByText('请至少填写一种联系方式')).toBeVisible()
  await page.getByLabel('称呼', { exact: false }).fill('虚构未保存内容')
  await page.getByRole('link', { name: '返回申请列表' }).click()
  const dialog = page.getByRole('dialog', { name: '放弃未保存的修改？' })
  await expect(dialog.getByRole('button', { name: '继续编辑' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('称呼', { exact: false })).toHaveValue('虚构未保存内容')
  expect(pageErrors).toEqual([])
})

test('lost creation response is reconciled with the same operation and does not duplicate a no-image record', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto(`${adminBaseURL}/admin/commissions/new`)
  await hydrated(page)
  let interrupted = false
  await page.route('**/api/admin/v1/commissions', async (route) => {
    if (route.request().method() === 'POST' && !interrupted) {
      interrupted = true
      await route.fetch()
      return route.abort('failed')
    }
    return route.continue()
  })
  await page.getByLabel('称呼', { exact: false }).fill('虚构响应丢失测试')
  await page.getByLabel('其他联系方式', { exact: false }).fill('fictional-contact')
  await page.getByRole('button', { name: '保存并查看' }).click()
  await expect(page.getByText('保存结果尚未确认', { exact: false })).toBeVisible()
  await expect(page.getByLabel('称呼', { exact: false })).toBeDisabled()
  await page.getByRole('button', { name: '核对本次保存结果' }).click()
  await expect(page).toHaveURL(/\/admin\/commissions\/[0-9a-f-]+$/u)
  const db = openFixtureDatabase(E2E_DATABASE_FILE)
  try { expect(db.prepare("SELECT count(*) FROM commission_submissions WHERE nickname = '虚构响应丢失测试'").pluck().get()).toBe(1) }
  finally { db.close() }
})

test('manual API rejects anonymous, cross-origin, missing CSRF and forged origin', async ({ page, request }) => {
  const url = `${adminBaseURL}/api/admin/v1/commissions`
  const data = { requestId: randomUUID(), fields: minimum() }
  expect((await request.post(url, { data })).status()).toBe(401)
  const session = await loginAsAdmin(page)
  expect((await page.request.post(url, { data, headers: { Origin: adminBaseURL } })).status()).toBe(403)
  expect((await page.request.post(url, { data, headers: { Origin: 'https://untrusted.invalid', 'x-csrf-token': session.csrfToken } })).status()).toBe(403)
  expect((await page.request.post(url, { data: { ...data, origin: 'website' }, headers: { Origin: adminBaseURL, 'x-csrf-token': session.csrfToken } })).status()).toBe(400)
  const list = await (await page.request.get(`${url}?status=all&source=qq`)).json()
  expect(list.data.every((item: { origin: string, channel: string }) => item.origin === 'manual' && item.channel === 'qq')).toBe(true)
  expect((await page.request.get(`${url}?source=qq&source=wechat`)).status()).toBe(400)
})

test('concurrent editing preserves the draft until explicitly reloaded', async ({ page }) => {
  const session = await loginAsAdmin(page)
  const headers = { Origin: adminBaseURL, 'x-csrf-token': session.csrfToken }
  const fields = { ...minimum(), qq: '88117888', nickname: '虚构并发测试' }
  const created = await (await page.request.post(`${adminBaseURL}/api/admin/v1/commissions`, { headers, data: { requestId: randomUUID(), fields } })).json()
  const url = `${adminBaseURL}/api/admin/v1/commissions/${created.data.id}`
  await page.goto(`${adminBaseURL}/admin/commissions/${created.data.id}`)
  await hydrated(page)
  await page.getByRole('button', { name: '编辑申请', exact: true }).click()
  await page.getByLabel('称呼', { exact: false }).fill('虚构尚未保存的修改')
  expect((await page.request.put(url, { headers, data: { expectedVersion: created.data.version, fields: { ...fields, nickname: '虚构另一处已保存' } } })).status()).toBe(200)
  await page.getByRole('button', { name: '保存修改' }).click()
  const conflict = page.getByRole('dialog', { name: '申请已在其他位置更新' })
  await conflict.getByRole('button', { name: '保留当前输入' }).click()
  await expect(page.getByLabel('称呼', { exact: false })).toHaveValue('虚构尚未保存的修改')
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(conflict).toBeVisible()
  let finishReload!: () => void
  const held = new Promise<void>(resolve => { finishReload = resolve })
  await page.route(url, async (route) => {
    await held
    await route.fulfill({ status: 503, body: '' })
  })
  await conflict.getByRole('button', { name: '重新载入（放弃当前修改）', exact: true }).click()
  await expect(conflict.getByRole('button', { name: '保留当前输入' })).toBeDisabled()
  await expect(conflict.getByRole('button', { name: '正在重新载入…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(conflict).toBeVisible()
  finishReload()
  await expect(conflict.getByRole('alert')).toContainText('重新载入失败')
  await expect(conflict.getByRole('button', { name: '保留当前输入' })).toBeEnabled()
  await expect(page.getByLabel('称呼', { exact: false })).toHaveValue('虚构尚未保存的修改')
  await page.unroute(url)
  await conflict.getByRole('button', { name: '重新载入（放弃当前修改）', exact: true }).click()
  await expect(page.getByText('虚构另一处已保存', { exact: true })).toBeVisible()
})

test('manual editor uses the work editor card, field and column geometry', async ({ page }, info) => {
  await loginAsAdmin(page)
  const work = await createWorkViaApi(page, { characterName: '虚构样式对照作品' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
  await hydrated(page)
  const measure = async (label: string, region: string) => {
    const input = await page.getByLabel(label, { exact: false }).evaluate((element) => {
      const style = getComputedStyle(element)
      const label = document.querySelector(`label[for="${element.id}"]`)!
      const labelStyle = getComputedStyle(label)
      return { height: element.getBoundingClientRect().height, font: style.fontSize, padding: style.padding,
        border: style.border, radius: style.borderRadius, labelFont: labelStyle.fontSize, labelWeight: labelStyle.fontWeight }
    })
    const card = await page.getByRole('region', { name: region, exact: true }).evaluate((element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      const heading = element.querySelector('h2')!
      return { x: rect.x, width: rect.width, padding: style.padding, radius: style.borderRadius,
        titleFont: getComputedStyle(heading).fontSize, titleInset: heading.getBoundingClientRect().x - rect.x }
    })
    const header = await page.getByRole('heading', { level: 1 }).evaluate(title => {
      const style = getComputedStyle(title)
      const bar = getComputedStyle(title.closest('header')!)
      return { fontSize: style.fontSize, weight: style.fontWeight, gap: bar.gap, wrap: bar.flexWrap, alignment: bar.alignItems }
    })
    return { input, card, header }
  }
  const reference = await measure('角色名', '基础信息')
  await page.goto(`${adminBaseURL}/admin/commissions/new`)
  await hydrated(page)
  expect(await measure('称呼', '申请资料')).toEqual(reference)
  const basics = await page.getByRole('region', { name: '申请资料', exact: true }).boundingBox()
  const image = await page.getByRole('region', { name: '设定图', exact: true }).boundingBox()
  expect(basics!.y).toBe(image!.y)
  await page.screenshot({ path: info.outputPath('aligned-editor-1440.png'), fullPage: true })
})

test('local preview verifies JPEG, WebP and EXIF rotation and clears failed validation progress', async ({ page }) => {
  test.setTimeout(120_000)
  const cancellationStatuses: number[] = []
  page.on('response', response => {
    if (/\/commission-upload-sessions\/[^/]+\/cancel$/u.test(response.url())) cancellationStatuses.push(response.status())
  })
  await loginAsAdmin(page)
  await page.goto(`${adminBaseURL}/admin/commissions/new`)
  await hydrated(page)
  const file = page.getByLabel('选择设定图', { exact: false })
  for (const [mimeType, width, height, rotated] of [
    ['image/jpeg', 3427, 2064, false], ['image/webp', 960, 640, false], ['image/jpeg', 320, 192, true],
  ] as const) {
    const base64 = await page.evaluate(({ mimeType, width, height }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const context = canvas.getContext('2d')!
      context.fillStyle = '#436a94'; context.fillRect(0, 0, width, height)
      context.fillStyle = '#eacb86'; context.fillRect(0, 0, width / 3, height / 2)
      return canvas.toDataURL(mimeType, 0.85).split(',')[1]!
    }, { mimeType, width, height })
    let bytes = Buffer.from(base64, 'base64')
    if (rotated) {
      // JPEG APP1: little-endian TIFF with Orientation=6 (90 degrees clockwise).
      const exif = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000', 'hex')
      bytes = Buffer.concat([bytes.subarray(0, 2), exif, bytes.subarray(2)])
    }
    await file.setInputFiles({ name: rotated ? 'synthetic-rotated.jpg' : mimeType === 'image/jpeg' ? 'synthetic.jpg' : 'synthetic.webp', mimeType, buffer: bytes })
    await expect(page.getByRole('status').filter({ hasText: '图片已核验' })).toBeVisible()
    const image = page.getByRole('img', { name: '委托申请私有设定图' })
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight])).toEqual(rotated ? [height, width] : [width, height])
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
  await setFakeMediaFlags(page, { failImageInfo: true })
  try {
    await file.setInputFiles({ name: 'synthetic-failure.png', mimeType: 'image/png', buffer: smallStudioPng() })
    await expect(page.getByRole('alert')).toContainText('服务端未能核验图片')
    await expect(page.getByRole('alert')).toContainText('当前设定图仍保留')
    await expect(page.getByRole('status').filter({ hasText: '正在' })).toHaveCount(0)
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '更换设定图', exact: true })).toBeEnabled()
  }
  finally { await setFakeMediaFlags(page, { failImageInfo: false }) }
  await file.setInputFiles({ name: 'synthetic-retry.png', mimeType: 'image/png', buffer: smallStudioPng() })
  await expect(page.getByRole('status').filter({ hasText: '图片已核验' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect.poll(() => cancellationStatuses).toEqual([200, 200, 200])
})

test('manual upload distinguishes local decode, expired session and network failures', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto(`${adminBaseURL}/admin/commissions/new`)
  await hydrated(page)
  const file = page.getByLabel('选择设定图', { exact: false })
  const alert = page.getByRole('alert')
  await file.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid') })
  await expect(alert).toContainText('浏览器无法解码')

  const png = { name: 'fixture.png', mimeType: 'image/png', buffer: smallStudioPng() }
  await page.route('**/commission-upload-sessions/*/complete', route => route.fulfill({
    status: 409, json: { error: { code: 'CONFLICT', reason: 'UPLOAD_SESSION_EXPIRED' } },
  }), { times: 1 })
  await file.setInputFiles(png)
  await expect(alert).toContainText('图片上传会话已过期')
  await page.route('**/api/e2e-fake-oss/**', route => route.abort('failed'), { times: 1 })
  await file.setInputFiles(png)
  await expect(alert).toContainText('图片传输中断')
})

for (const [phase, target, stage] of [
  ['create', '**/api/admin/v1/commission-upload-sessions', '正在创建上传会话'],
  ['put', '**/api/e2e-fake-oss/**', '正在上传图片'],
  ['complete', '**/api/admin/v1/commission-upload-sessions/*/complete', '正在核验图片'],
] as const) {
  test(`discard during upload ${phase} cancels the session without starting another stage`, async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(`${adminBaseURL}/admin/commissions/new`)
    await hydrated(page)
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    await page.route(target, async route => {
      const response = await route.fetch()
      await held
      await route.fulfill({ response })
    })
    let puts = 0
    let completions = 0
    page.on('request', r => {
      if (r.method() === 'PUT') puts++
      if (r.url().endsWith('/complete')) completions++
    })
    await Promise.all([
      page.waitForRequest(target),
      page.getByLabel('选择设定图', { exact: false }).setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: smallStudioPng() }),
    ])
    await expect(page.getByTestId('admin-task-progress')).toContainText(stage)
    const cancelled = page.waitForResponse('**/commission-upload-sessions/*/cancel')
    await page.getByRole('link', { name: '返回申请列表' }).click()
    await page.getByRole('button', { name: '放弃修改并离开' }).click()
    await expect(page).toHaveURL(/\/admin\/commissions$/u)
    release()
    expect((await cancelled).status()).toBe(200)
    expect(puts).toBe(phase === 'create' ? 0 : 1)
    expect(completions).toBe(phase === 'complete' ? 1 : 0)
  })
}

test('detail actions remain grouped through all status/image combinations, long content and responsive layouts', async ({ page }, info) => {
  test.setTimeout(180_000)
  const session = await loginAsAdmin(page)
  const headers = { Origin: adminBaseURL, 'x-csrf-token': session.csrfToken }
  let fields = { ...minimum(), qq: '88117666', nickname: '虚构长称呼用于验证对齐'.repeat(3), otherContact: 'demo-contact-'.repeat(15),
    internalNote: '虚构内部备注，长文本必须换行。'.repeat(70), offlineAdultConfirmed: true, offlinePrivacyConfirmed: true }
  let current = (await (await page.request.post(`${adminBaseURL}/api/admin/v1/commissions`, { headers, data: { requestId: randomUUID(), fields } })).json()).data
  const detailUrl = `${adminBaseURL}/admin/commissions/${current.id}`
  const apiUrl = `${adminBaseURL}/api/admin/v1/commissions/${current.id}`
  await page.goto(detailUrl)
  await hydrated(page)
  for (const hasImage of [false, true]) {
    if (hasImage) {
      await page.getByRole('button', { name: '编辑申请', exact: true }).click()
      await page.getByLabel('选择设定图', { exact: false }).setInputFiles({ name: 'layout.png', mimeType: 'image/png', buffer: smallStudioPng() })
      await expect(page.getByRole('status').filter({ hasText: '图片已核验' })).toBeVisible()
      await page.getByRole('button', { name: '保存修改', exact: true }).click()
      await expect(page.getByRole('button', { name: '编辑申请', exact: true })).toBeFocused()
      current = (await (await page.request.get(apiUrl)).json()).data
    }
    for (const status of ['pending', 'accepted', 'rejected']) {
      fields = { ...fields, status }
      const updated = await page.request.put(apiUrl, { headers, data: { expectedVersion: current.version, fields } })
      expect(updated.status()).toBe(200)
      current = (await updated.json()).data
      await page.goto(detailUrl)
      await hydrated(page)
      const edit = page.getByRole('button', { name: '编辑申请', exact: true })
      const exportButton = page.getByRole('button', { name: '导出制作单', exact: true })
      await expect(edit).toBeVisible()
      await expect(exportButton).toHaveCount(hasImage && status === 'accepted' ? 1 : 0)
      for (const width of [320, 390, 768, 1023, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${status}, image=${hasImage}, width=${width}`).toBe(true)
        const rect = (await edit.boundingBox())!
        const header = (await page.locator('.commission-detail__header').boundingBox())!
        expect(rect.x).toBeGreaterThanOrEqual(header.x)
        expect(rect.x + rect.width).toBeLessThanOrEqual(header.x + header.width + 1)
        if (hasImage && status === 'accepted') {
          const exported = (await exportButton.boundingBox())!
          expect(exported.x - rect.x - rect.width).toBeLessThanOrEqual(16)
          expect(exported.x - rect.x - rect.width).toBeGreaterThanOrEqual(0)
          expect(exported.y).toBe(rect.y)
          expect(exported.height).toBe(rect.height)
          expect(exported.x + exported.width).toBeCloseTo(header.x + header.width, 0)
          if (width === 390 || width === 1440) await page.screenshot({ path: info.outputPath(`detail-actions-${width}.png`), fullPage: true })
        }
        else expect(rect.x + rect.width).toBeCloseTo(header.x + header.width, 0)
      }
    }
  }
})

test('image and export failure/retry keep usable actions and stable header geometry', async ({ page }) => {
  test.setTimeout(120_000)
  await loginAsAdmin(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${adminBaseURL}/admin/commissions/new`)
  await hydrated(page)
  await page.getByLabel('称呼', { exact: false }).fill('虚构失败重试布局')
  await page.getByLabel('QQ号', { exact: false }).fill('88117555')
  await page.getByLabel('选择设定图', { exact: false }).setInputFiles({ name: 'retry.png', mimeType: 'image/png', buffer: smallStudioPng() })
  await expect(page.getByRole('status').filter({ hasText: '图片已核验' })).toBeVisible()
  await page.getByRole('combobox', { name: '处理状态' }).click()
  await page.getByRole('option', { name: '已接受', exact: true }).click()
  await page.getByLabel('已在线下确认申请人已成年').check()
  await page.getByLabel('已在线下确认资料用于委托处理').check()
  await page.getByRole('button', { name: '保存并查看', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/commissions\/[0-9a-f-]+$/u)
  let failImage = true
  await page.route('**/design-reference?w=1280', route => failImage ? route.fulfill({ status: 503, body: '' }) : route.continue())
  await page.reload()
  await expect(page.getByText('设定图预览加载失败', { exact: false })).toBeVisible()
  failImage = false
  await page.getByRole('button', { name: '重试图片', exact: true }).click()
  await expect.poll(() => page.getByRole('img', { name: '委托申请私有设定图' }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  let failExport = true
  let release: (() => void) | undefined
  await page.route('**/work-order', async (route) => {
    if (failExport) return route.fulfill({ status: 503, json: { error: { code: 'INTERNAL_ERROR', message: 'Synthetic failure' } } })
    await new Promise<void>((resolve) => { release = resolve })
    return route.continue()
  })
  const edit = page.getByRole('button', { name: '编辑申请', exact: true })
  const exportButton = page.getByRole('button', { name: '导出制作单', exact: true })
  const baseline = (await edit.boundingBox())!
  await exportButton.click()
  await expect(page.getByText('制作单导出失败，请重试。')).toBeVisible()
  expect((await edit.boundingBox())!.x).toBe(baseline.x)
  failExport = false
  await exportButton.click()
  await expect(page.getByText('正在生成制作单…')).toBeVisible()
  await expect(edit).toBeDisabled()
  await expect(page.getByRole('button', { name: '导出中…' })).toBeDisabled()
  expect((await edit.boundingBox())!.x).toBe(baseline.x)
  const download = page.waitForEvent('download')
  release!()
  expect((await download).suggestedFilename()).toMatch(/^commission-work-order-DD-.*\.pdf$/u)
  await expect(edit).toBeEnabled()
  await expect(page.getByText('制作单导出失败，请重试。')).toHaveCount(0)
  expect((await edit.boundingBox())!.x).toBe(baseline.x)
})

import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { adminBaseURL, loginAsAdmin, publicBaseURL } from './helpers/auth'
import {
  fakeMediaState,
  resetFakeMedia,
  smallStudioPng,
} from './helpers/fake-media'

test('本地真实浏览器完成单图私密申请、管理查看与 409 停止点', async ({ page, request }) => {
  await resetFakeMedia(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', error => browserErrors.push(error.message))

  const suffix = Date.now().toString(36)
  const nickname = `合成申请-${suffix}`
  const species = '犬科'
  const phone = '19900000000'
  const qq = '999999'

  await page.goto(`${publicBaseURL}/commission/apply`)
  await expect(page.getByRole('heading', { name: '提交委托申请' })).toBeVisible()
  await page.getByLabel(/称呼/u).fill(nickname)
  await page.getByLabel(/物种/u).fill(species)
  await page.getByLabel(/中国大陆手机号/u).fill(phone)
  await page.getByLabel(/^QQ/u).fill(qq)
  await page.getByLabel(/身高/u).fill('170')
  await page.getByLabel(/体重/u).fill('60.5')
  await page.getByLabel(/设定图/u).setInputFiles({
    name: 'synthetic-design-reference.png',
    mimeType: 'image/png',
    buffer: smallStudioPng(),
  })
  await expect(page.getByAltText('所选设定图预览')).toBeVisible()
  await page.getByRole('button', { name: '确认提交' }).click()

  await expect(page.getByText('申请已收到')).toBeVisible()
  await expect(page.locator('.commission-apply__receipt')).toHaveText(/^[A-Z0-9-]+$/u)
  expect(page.url()).toBe(`${publicBaseURL}/commission/apply`)
  expect(await page.evaluate(() => JSON.stringify({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }))).not.toMatch(new RegExp(`${phone}|${qq}|${nickname}`, 'u'))
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1)

  const media = await fakeMediaState(page)
  expect(media.putRecords).toHaveLength(1)
  expect(media.putRecords[0]).toMatchObject({
    contentMd5: expect.any(String),
    contentType: 'image/png',
    forbidOverwrite: 'true',
    sha256Metadata: expect.any(String),
  })
  expect(media.processCalls).toBe(0)
  expect(media.publicObjects).toEqual([])

  // 同一手机号仍有 pending 申请时，第二次提交停在 409；表单与私有预览保留。
  await page.goto(`${publicBaseURL}/commission/apply`)
  await page.getByLabel(/称呼/u).fill(`${nickname}-重复`)
  await page.getByLabel(/物种/u).fill(species)
  await page.getByLabel(/中国大陆手机号/u).fill(phone)
  await page.getByLabel(/^QQ/u).fill(qq)
  await page.getByLabel(/身高/u).fill('170')
  await page.getByLabel(/体重/u).fill('60.5')
  await page.getByLabel(/设定图/u).setInputFiles({
    name: 'synthetic-design-reference-repeat.png',
    mimeType: 'image/png',
    buffer: smallStudioPng(),
  })
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('未重复提交')).toBeVisible()
  await expect(page.getByText('该手机号已有待处理的委托申请')).toBeVisible()
  await expect(page.getByAltText('所选设定图预览')).toBeVisible()
  await expect(page.getByText('申请已收到')).toHaveCount(0)

  const session = await loginAsAdmin(page)
  await page.goto(`${adminBaseURL}/admin/commissions`)
  const row = page.locator('.commission-inbox__item').filter({ hasText: nickname })
  await expect(row).toBeVisible()
  await expect(row).toContainText(`${nickname} · ${species}`)
  expect(await row.evaluate(element => getComputedStyle(element).backgroundColor))
    .toBe('rgb(255, 255, 255)')

  // 查找：昵称/物种/回执编号命中；无命中时给出空态与清除入口。
  await page.getByLabel('查找申请').fill('不存在的角色')
  await expect(page.locator('.commission-inbox__item')).toHaveCount(0)
  await expect(page.getByText('没有符合条件的申请。')).toBeVisible()
  await page.getByRole('button', { name: '清除查找' }).click()
  await expect(row).toBeVisible()
  await expect(page.getByRole('navigation', { name: '委托申请分页' })).toBeVisible()

  await row.click()
  await expect(page.getByRole('heading', { name: '委托申请详情' })).toBeVisible()
  await expect(page.getByText(nickname, { exact: true })).toBeVisible()
  await expect(page.getByText(species, { exact: true })).toBeVisible()
  await expect(page.getByText(`+86 ${phone}`, { exact: true })).toBeVisible()
  await expect(page.getByText(qq, { exact: true })).toBeVisible()

  // 缓存说明是实现细节，不再贴给操作员看。
  await expect(page.getByText('响应禁止缓存')).toHaveCount(0)
  // 未接受的申请不给导出：制作单只在接受后才有意义。
  await expect(page.getByRole('button', { name: '导出制作单' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '设定图' })).toBeVisible()
  await expect(page.getByRole('link', { name: /放大预览原图/u }))
    .toHaveAttribute('href', /\/design-reference$/u)

  const image = page.getByAltText('委托申请私有设定图')
  await expect(image).toHaveJSProperty('complete', true)
  expect(await image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  const previewPath = await image.getAttribute('src')
  expect(previewPath).toMatch(/^\/api\/admin\/v1\/commissions\/[0-9a-f-]+\/design-reference$/u)
  const anonymousPreview = await request.get(`${adminBaseURL}${previewPath}`)
  expect(anonymousPreview.status()).toBe(401)
  const authenticatedPreview = await page.request.get(`${adminBaseURL}${previewPath}`)
  expect(authenticatedPreview.status()).toBe(200)
  expect(authenticatedPreview.headers()['cache-control']).toContain('no-store')

  const submissionId = new URL(page.url()).pathname.split('/').at(-1)!
  const currentResponse = await page.request.get(
    `${adminBaseURL}/api/admin/v1/commissions/${submissionId}`,
  )
  const current = await currentResponse.json()
  const competingUpdate = await page.request.put(
    `${adminBaseURL}/api/admin/v1/commissions/${submissionId}`,
    {
      headers: {
        origin: adminBaseURL,
        'x-csrf-token': session.csrfToken,
      },
      data: {
        expectedVersion: current.data.version,
        payload: { status: 'accepted', internalNote: null },
      },
    },
  )
  expect(competingUpdate.status()).toBe(200)

  await page.getByLabel('状态').selectOption('rejected')
  await page.getByLabel('内部备注').fill('合成冲突草稿')
  await page.getByRole('button', { name: '保存处理结果' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('申请已在其他位置更新')
  await expect(page.getByRole('alertdialog')).toContainText('当前保存已停止')
  await page.getByRole('button', { name: '知道了，重新载入' }).click()
  await expect(page.getByLabel('状态')).toHaveValue('accepted')
  await expect(page.getByLabel('内部备注')).toHaveValue('')

  // 已接受：出现导出按钮，服务端直接给两页 A4 横版 PDF（不依赖操作员的打印机）。
  await expect(page.getByRole('button', { name: '导出制作单' })).toBeVisible()
  const workOrderPath = `/api/admin/v1/commissions/${submissionId}/work-order`
  expect((await request.get(`${adminBaseURL}${workOrderPath}`)).status()).toBe(401)
  const workOrder = await page.request.get(`${adminBaseURL}${workOrderPath}`)
  expect(workOrder.status()).toBe(200)
  expect(workOrder.headers()['content-type']).toContain('application/pdf')
  expect(workOrder.headers()['cache-control']).toContain('no-store')
  expect(workOrder.headers()['content-disposition']).toContain('attachment')
  const pdfBytes = await workOrder.body()
  expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  // 真解析：两页，且都是 A4 横版（841.89 × 595.28 pt）。
  const document = await PDFDocument.load(pdfBytes)
  expect(document.getPageCount()).toBe(2)
  for (const pdfPage of document.getPages()) {
    expect(Math.round(pdfPage.getWidth())).toBe(842)
    expect(Math.round(pdfPage.getHeight())).toBe(595)
  }

  await page.getByLabel('内部备注').fill('合成保存反馈')
  await page.getByRole('button', { name: '保存处理结果' }).click()
  await expect(page.getByRole('status')).toContainText('处理结果已保存')

  expect(browserErrors.some(message => message.includes('status of 409'))).toBe(true)
  expect(browserErrors.filter(message => !message.includes('status of 409'))).toEqual([])
  expect(JSON.stringify(browserErrors)).not.toMatch(new RegExp(`${phone}|${qq}|${nickname}`, 'u'))
})

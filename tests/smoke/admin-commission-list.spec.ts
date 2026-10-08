import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { adminBaseURL, E2E_DATABASE_FILE, loginAsAdmin } from '../e2e/helpers/auth'
import { openFixtureDatabase } from '../e2e/helpers/fixture-db'

test.use({ hasTouch: true })

test('commission all-status API preserves filters, validation and private list fields', async ({ page, request }) => {
  const session = await loginAsAdmin(page)
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
  const ids = ['pending', 'accepted', 'rejected'].map(() => randomUUID())
  try {
    for (const [index, status] of ['pending', 'accepted', 'rejected'].entries()) {
      const id = ids[index]!
      sqlite.prepare(`
        INSERT INTO assets (
          id, role, status, private_object_key, sha256, byte_size,
          mime_type, width, height, fit_mode, created_at, updated_at
        ) VALUES (?, 'commission_design_reference', 'READY', ?, ?, 128,
          'image/png', 640, 480, 'contain', 1, 1)
      `).run(id, `test/commission/${id}.png`, 'a'.repeat(64))
      sqlite.prepare(`
        INSERT INTO commission_submissions (
          id, receipt_code, nickname, phone_country_code, phone_number, qq,
          height_cm, weight_kg_tenths, design_asset_id, status, created_at, updated_at, handled_at, handled_by
        ) VALUES (?, ?, '虚构筛选测试', '+86', ?, '100001', 170, 600, ?, ?, ?, ?, ?, ?)
      `).run(id, `DD-${id.slice(0, 8).toUpperCase()}`, `1990000000${index}`, id, status, index + 1, index + 1,
        status === 'pending' ? null : index + 1, status === 'pending' ? null : session.user.id)
    }
    for (const status of ['all', 'pending', 'accepted', 'rejected']) {
      const response = await page.request.get(`${adminBaseURL}/api/admin/v1/commissions?status=${status}`)
      expect(response.status()).toBe(200)
      const { data } = await response.json()
      const rows = data.filter((item: { id: string }) => ids.includes(item.id))
      expect(rows).toHaveLength(status === 'all' ? 3 : 1)
      if (status === 'all') expect(rows.map((item: { id: string }) => item.id)).toEqual([...ids].reverse())
      else expect(rows[0].status).toBe(status)
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual(['createdAt', 'emailNotificationStatus', 'id', 'nickname', 'receiptCode', 'species', 'status', 'version'])
      }
    }
    const legacyDefault = await (await page.request.get(`${adminBaseURL}/api/admin/v1/commissions`)).json()
    expect(legacyDefault.data.every((item: { status: string }) => item.status === 'pending')).toBe(true)
    expect((await page.request.get(`${adminBaseURL}/api/admin/v1/commissions?status=invalid`)).status()).toBe(400)
    expect((await page.request.get(`${adminBaseURL}/api/admin/v1/commissions?status=all&status=pending`)).status()).toBe(400)
    expect((await request.get(`${adminBaseURL}/api/admin/v1/commissions?status=all`)).status()).toBe(401)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${adminBaseURL}/admin/commissions`)
    await expect(page.getByRole('combobox', { name: '处理状态' })).toContainText('全部状态')
    await expect(page.locator('tbody tr').filter({ hasText: '虚构筛选测试' })).toHaveCount(3)
  }
  finally {
    for (const id of ids) {
      sqlite.prepare('DELETE FROM commission_submissions WHERE id = ?').run(id)
      sqlite.prepare('DELETE FROM assets WHERE id = ?').run(id)
    }
    sqlite.close()
  }
})

test('commission table filters, paginates and recovers across responsive layouts', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  const consoleErrors: string[] = []
  const networkErrors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('503')) consoleErrors.push(message.text())
  })
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') networkErrors.push(request.failure()?.errorText ?? 'unknown')
  })
  await loginAsAdmin(page)
  let fail = false
  let empty = false
  let delayed = false
  let release: (() => void) | undefined
  await page.route('**/api/admin/v1/commissions?status=*', async (route) => {
    if (delayed) await new Promise<void>((resolve) => { release = resolve })
    if (fail) return route.fulfill({ status: 503, json: { error: { code: 'INTERNAL_ERROR', message: 'Synthetic failure' } } })
    const status = new URL(route.request().url()).searchParams.get('status')!
    await route.fulfill({ json: { data: empty ? [] : Array.from({ length: 12 }, (_, i) => ({
      id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, '0')}`,
      receiptCode: `DD-TEST-${String(i + 1).padStart(4, '0')}`,
      nickname: i === 0 ? '虚构测试申请人长名称'.repeat(3) : `虚构申请 ${i + 1}`,
      species: i === 0 ? null : '测试物种',
      status: status === 'all' ? ['pending', 'accepted', 'rejected'][i % 3] : status,
      emailNotificationStatus: ['sent', 'failed', 'pending', 'partial'][i % 4],
      createdAt: '2026-10-08T00:00:00Z',
      version: 1,
    })) } })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${adminBaseURL}/admin/commissions`)
  await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as HTMLElement & { __vue_app__?: unknown })?.__vue_app__))
  const table = page.getByRole('table', { name: '委托申请表格' })
  const rows = page.locator('.commission-inbox__row:visible')
  const pagination = page.getByRole('navigation', { name: '委托申请分页' })
  await expect(table).toBeVisible()
  await expect(table.getByRole('columnheader')).toHaveText(['申请人', '物种', '提交时间', '处理状态', '回执编号', '邮件通知', '操作'])
  await expect(rows).toHaveCount(10)
  await expect(page.getByText('联系方式在详情中按需查看。')).toHaveCount(0)
  const status = page.getByRole('combobox', { name: '处理状态', exact: true })
  await expect(status).toContainText('全部状态')
  for (const label of ['待处理', '已接受', '已拒绝']) await expect(rows.filter({ hasText: label }).first()).toBeVisible()
  await status.click()
  await page.getByRole('option', { name: '待处理', exact: true }).click()
  await expect(page.getByRole('button', { name: '删除申请数据' })).toHaveCount(0)
  await pagination.getByRole('button', { name: '下一页' }).click()
  await expect(rows).toHaveCount(2)
  await expect(pagination).toContainText('显示 11–12')
  const input = page.getByRole('searchbox', { name: '查找申请' })
  await input.fill('DD-TEST-0001')
  await expect(rows).toHaveCount(2)
  await input.press('Tab')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('物种待补录')
  await expect(pagination).toContainText('第 1 / 1 页')
  await expect(page).not.toHaveURL(/DD-TEST/u)
  await page.getByRole('button', { name: '清除', exact: true }).click()
  await expect(input).toBeFocused()
  await expect(rows).toHaveCount(10)
  await pagination.getByRole('combobox', { name: '每页', exact: true }).click()
  await page.getByRole('option', { name: '20 条' }).click()
  await expect(rows).toHaveCount(12)
  await status.focus()
  await status.press('Enter')
  await status.press('End')
  await status.press('Enter')
  await expect(page).toHaveURL(/status=rejected/u)
  await expect(rows.first()).toContainText('已拒绝')
  await expect(rows.first().getByRole('button', { name: '删除申请数据' })).toBeVisible()
  await expect(rows.first().getByRole('link', { name: '查看详情' })).toHaveAttribute('href', /\/admin\/commissions\/11111111-/u)
  for (const width of [320, 390, 768, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(rows).toHaveCount(12)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(table).toBeVisible({ visible: width >= 1024 })
    if (width === 390) {
      await status.tap()
      await page.getByRole('option', { name: '已接受', exact: true }).tap()
      await expect(rows.first()).toContainText('已接受')
      await status.tap()
      await page.getByRole('option', { name: '已拒绝', exact: true }).tap()
      await expect(rows.first()).toContainText('已拒绝')
    }
    if ([390, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`commissions-${width}.png`), fullPage: true })
  }
  await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
  await page.getByRole('button', { name: '清除', exact: true }).click()
  await expect(status).toContainText('全部状态')
  await expect(page).not.toHaveURL(/status=/u)
  await status.click()
  await page.getByRole('option', { name: '已接受', exact: true }).click()
  await expect(rows.first()).toContainText('已接受')
  await expect(page.getByRole('button', { name: '删除申请数据' })).toHaveCount(0)
  empty = true
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(page.getByText('当前状态下没有申请。')).toBeVisible()
  await expect(pagination).toContainText('共 0 条')
  await expect(pagination.getByRole('button', { name: '下一页' })).toBeDisabled()
  fail = true
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('申请列表加载失败')
  fail = false
  empty = false
  delayed = true
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.getByText('正在加载申请…')).toBeVisible()
  await expect(status).toBeDisabled()
  await expect.poll(() => Boolean(release)).toBe(true)
  release!()
  await expect(rows).toHaveCount(12)
  expect(errors).toEqual([])
  expect(consoleErrors).toEqual([])
  expect(networkErrors).toEqual([])
})

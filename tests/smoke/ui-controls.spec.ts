import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin, publicBaseURL } from '../e2e/helpers/auth'
import { seedPublicCatalog } from '../e2e/helpers/public-catalog'

async function hydrated(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as HTMLElement & { __vue_app__?: unknown })?.__vue_app__))
}

test('shared select supports keyboard, dismissal, numeric pagination and required disabled choices', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await loginAsAdmin(page)
  await seedPublicCatalog(page, Array.from({ length: 12 }, (_, i) => ({
    slug: `e2e-public-controls-${i}` as const, characterName: `界面验收 ${i}`, purpose: 'showcase' as const, photos: [{ alt: `测试图片 ${i}` }],
  })))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${adminBaseURL}/admin/works`)
  await hydrated(page)
  const purpose = page.getByRole('combobox', { name: '用途', exact: true })
  await expect(purpose).toContainText('全部用途')
  await purpose.focus()
  await purpose.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  const selected = page.getByRole('option', { name: '全部用途', exact: true })
  const hovered = page.getByRole('option', { name: '委托作品', exact: true })
  await hovered.hover()
  await expect(selected).not.toContainText('✓')
  expect(await selected.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(await hovered.evaluate(el => getComputedStyle(el).backgroundColor))
  expect((await hovered.boundingBox())!.y - ((await selected.boundingBox())!.y + (await selected.boundingBox())!.height)).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('select-states.png') })
  await purpose.press('End')
  await purpose.press('Enter')
  await expect(purpose).toContainText('纯展示')
  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(purpose).toBeFocused()
  await purpose.click()
  await purpose.press('Home')
  await purpose.press('Escape')
  await expect(purpose).toContainText('纯展示')
  await purpose.click()
  await page.getByRole('heading', { name: '作品管理', exact: true }).click()
  await expect(page.getByRole('listbox')).toBeHidden()
  await purpose.click()
  await purpose.press('Tab')
  await expect(page.getByRole('listbox')).toBeHidden()
  const pageSize = page.getByRole('combobox', { name: '每页', exact: true })
  await pageSize.click()
  await page.getByRole('option', { name: '20 件', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(12)
  await expect(pageSize).toContainText('20 件')
  const row = page.locator('tbody tr').first()
  await row.hover()
  expect(await row.locator('td').first().evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(await page.locator('.admin-surface').first().evaluate(el => getComputedStyle(el).backgroundColor))
  await expect(page.locator('table')).toHaveCSS('border-radius', '12px')
  await purpose.click()
  await page.screenshot({ path: testInfo.outputPath('admin-desktop.png') })
  await purpose.press('Escape')
  await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await purpose.click()
    const box = await page.getByRole('listbox').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
    await purpose.press('Escape')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('link', { name: '编辑', exact: true }).first().click()
  await expect(page.getByRole('combobox', { name: /内部用途/u })).toBeDisabled()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${adminBaseURL}/admin/works/new`)
  await hydrated(page)
  await page.getByRole('combobox', { name: /内部用途/u }).click()
  await page.getByRole('option', { name: '领养作品', exact: true }).click()
  const adoption = page.getByRole('combobox', { name: /领养状态/u })
  await adoption.click()
  await expect(page.getByRole('option', { name: '请人工确认' })).toHaveAttribute('aria-disabled', 'true')
  await adoption.press('Home')
  await adoption.press('Enter')
  await expect(adoption).toContainText('可领养')
  await adoption.click()
  await page.screenshot({ path: testInfo.outputPath('admin-mobile.png') })
  await adoption.press('Escape')
  expect(errors).toEqual([])
})

test('public actions and media share radius across locales and viewports', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await seedPublicCatalog(page, [{ slug: 'e2e-public-controls-gallery', characterName: '圆角验收', purpose: 'adoption', adoptionStatus: 'available', photos: [{ alt: '正面' }, { alt: '侧面' }], adoptionCover: { alt: '横图', width: 1920, height: 1080 } }])
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${publicBaseURL}/about`)
    await hydrated(page)
    const email = page.getByRole('link', { name: '打开邮件客户端' })
    await expect(email.locator('svg')).toHaveCount(1)
    await expect(page.getByRole('button', { name: '复制邮箱', exact: true }).locator('svg')).toHaveCount(1)
    await expect(email).not.toContainText('↗')
    await expect(email).toHaveAttribute('href', /^mailto:/u)
    await expect(email).toHaveCSS('border-radius', '12px')
    await email.scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`about-${width}.png`) })
    await page.goto(`${publicBaseURL}/adoptions`)
    await hydrated(page)
    await expect(page.getByText('搜索角色', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '搜索', exact: true })).toHaveCSS('border-radius', '12px')
    await expect(page.getByRole('searchbox')).toHaveCSS('border-radius', '12px')
    await page.goto(`${publicBaseURL}/works/e2e-public-controls-gallery`)
    await hydrated(page)
    await expect(page.locator('.work-gallery__thumb').first()).toHaveCSS('border-radius', '12px')
    await expect(page.locator('.work-gallery__stage')).toHaveCSS('border-radius', '12px')
    await page.locator('.work-gallery__thumb').nth(1).click()
    await expect.poll(() => page.locator('.work-gallery__stage img').evaluateAll(images => images.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`gallery-${width}.png`) })
  }
  await page.context().addCookies([{ name: 'site-language', value: 'en', url: publicBaseURL }])
  await page.goto(`${publicBaseURL}/about`)
  await hydrated(page)
  await expect(page.locator('a[href^="mailto:"] svg')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto(`${adminBaseURL}/admin/login`)
  await hydrated(page)
  await expect(page.getByLabel('用户名')).toHaveCSS('border-radius', '12px')
  await expect(page.getByRole('button', { name: '登录', exact: true })).toHaveCSS('border-radius', '12px')
  await page.screenshot({ path: testInfo.outputPath('login.png') })
})

test('select supports touch and preserves native fallback without Popover', async ({ browser }) => {
  test.setTimeout(90_000)
  for (const fallback of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'zh-CN' })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    if (fallback) await page.addInitScript(() => { Object.defineProperty(HTMLElement.prototype, 'showPopover', { value: undefined }) })
    await loginAsAdmin(page)
    await page.goto(`${adminBaseURL}/admin/works/new`)
    await hydrated(page)
    const purpose = page.getByRole('combobox', { name: /内部用途/u })
    if (fallback) {
      await purpose.selectOption('adoption')
    }
    else {
      await purpose.tap()
      await page.getByRole('option', { name: '领养作品', exact: true }).tap()
      await expect(page.getByRole('listbox')).toBeHidden()
    }
    const adoption = page.getByRole('combobox', { name: /领养状态/u })
    await page.getByRole('button', { name: '创建草稿', exact: true }).tap()
    await expect(adoption).toHaveAttribute('aria-invalid', 'true')
    if (fallback) {
      await adoption.selectOption('available')
      await expect(adoption).toHaveValue('available')
    }
    else {
      await adoption.tap()
      await page.getByRole('option', { name: '可领养', exact: true }).tap()
      await expect(adoption).toContainText('可领养')
    }
    await expect(adoption).not.toHaveAttribute('aria-invalid', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
    await context.close()
  }
})


test('commission inputs validate individually on blur and recover without submitting', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${publicBaseURL}/commission/apply`)
  await hydrated(page)
  const fields = [
    ['commission-nickname', ' ', '测试称呼'],
    ['commission-species', ' ', '犬科'],
    ['commission-phone', '12', '19900000009'],
    ['commission-qq', '0', '999999'],
    ['commission-height', '79', '170'],
    ['commission-weight', '20.55', '60.5'],
  ] as const
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0)
  let writes = 0
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/public/v1/commission')) writes++ })
  for (const [id, invalid, valid] of fields) {
    const input = page.locator(`#${id}`)
    await input.fill(invalid)
    await expect(input).toHaveAttribute('aria-invalid', 'false')
    await page.getByRole('heading', { name: '申请信息', exact: true }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    const errorId = await input.getAttribute('aria-describedby')
    await expect(page.locator(`#${errorId}`)).toBeVisible()
    await expect(page.getByTestId('commission-apply-validation-summary')).toHaveCount(0)
    await input.fill(valid)
    await page.getByRole('heading', { name: '申请信息', exact: true }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'false')
  }
  expect(writes).toBe(0)
  await page.locator('#commission-phone').fill('12')
  await page.locator('#commission-phone').press('Tab')
  await page.locator('#commission-phone').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('blur-errors-mobile.png') })
  await page.getByRole('button', { name: '确认提交', exact: true }).click()
  await expect(page.getByTestId('commission-apply-validation-summary')).toBeFocused()
  expect(writes).toBe(0)
})

test('commission inbox searches only on submit and clears without exposing terms in URL', async ({ page }, testInfo) => {
  await loginAsAdmin(page)
  await page.route('**/api/admin/v1/commissions?status=*', route => route.fulfill({ json: { data: [
    { id: '11111111-1111-4111-8111-111111111111', receiptCode: 'DD-TEST-01', nickname: '测试甲', species: '犬科', status: 'pending', createdAt: '2026-10-05T00:00:00Z', version: 1 },
    { id: '22222222-2222-4222-8222-222222222222', receiptCode: 'DD-TEST-02', nickname: '测试乙', species: '猫科', status: 'pending', createdAt: '2026-10-05T00:00:00Z', version: 1 },
  ] } }))
  await page.goto(`${adminBaseURL}/admin/commissions`)
  await hydrated(page)
  const search = page.getByRole('search')
  const input = search.getByRole('searchbox')
  await expect(search).not.toContainText('查找申请')
  await expect(search).not.toContainText('共')
  await input.fill('测试甲')
  await expect(page.locator('.commission-inbox__item')).toHaveCount(2)
  await search.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.locator('.commission-inbox__item')).toHaveCount(1)
  await expect(page).not.toHaveURL(/测试甲/u)
  await input.fill('不存在')
  await input.press('Enter')
  await expect(page.getByText('没有符合条件的申请。')).toBeVisible()
  await search.getByRole('button', { name: '清除', exact: true }).click()
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await expect(page.locator('.commission-inbox__item')).toHaveCount(2)
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`inbox-search-${width}.png`) })
  }
})

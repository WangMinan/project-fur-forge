import { expect, test } from '@playwright/test'

const adminBaseURL = 'http://localhost:3100'

const BLUEBERRY_ID = 'b943ee7e-0e9a-4944-a36b-ed61b8b9a640'
const LIZI_ID = '3cb1db83-c2c5-42a1-8e5e-a61cb97d2422'

test.describe('T07 管理端登录页', () => {
  test('/admin 重定向到登录页', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin`)
    await expect(page).toHaveURL(/\/admin\/login$/)
  })

  test('登录表单：字段、可达性与提交后的诚实提示', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await expect(page.getByRole('heading', { level: 1, name: '管理端登录' })).toBeVisible()

    await page.getByLabel('用户名或邮箱').fill('tester')
    await page.getByLabel('密码').fill('secret')
    await page.getByRole('button', { name: '登录' }).click()

    await expect(page.getByRole('alert')).toContainText('认证接口尚未接入（T13）')
  })

  test('登录错误样张：?state=error 与 ?state=locked', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login?state=error`)
    await expect(page.getByRole('alert')).toContainText('用户名或密码不正确')

    await page.goto(`${adminBaseURL}/admin/login?state=locked`)
    await expect(page.getByRole('alert')).toContainText('登录已临时锁定')
  })

  test('键盘 Tab 顺序：用户名 → 密码 → 登录按钮', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await page.getByLabel('用户名或邮箱').focus()
    await expect(page.getByLabel('用户名或邮箱')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('密码')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '登录' })).toBeFocused()
  })

  test('页面无横向溢出', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    const overflow = await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

test.describe('T07 后台作品列表页', () => {
  test('展示 6 件作品、状态徽章与编辑入口，无 P1/P2 导航项', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works`)

    await expect(page.getByRole('heading', { level: 1, name: '作品' })).toBeVisible()
    await expect(page.getByText(/共 6 件 · 夹具演示数据/)).toBeVisible()

    const nav = page.getByRole('navigation', { name: '管理导航' })
    await expect(nav.getByRole('link')).toHaveCount(1)
    await expect(nav.getByRole('link', { name: '作品' })).toHaveAttribute('aria-current', 'page')

    for (const name of ['蓝莓', '芝麻', '豆豆', '可可', '栗子', '奶盖']) {
      await expect(page.getByRole('link', { name, exact: true })).toBeVisible()
    }
    await expect(page.getByText('可领养').first()).toBeVisible()
    await expect(page.getByText('¥15,600').first()).toBeVisible()
    await expect(page.getByText(/1 失败/)).toBeVisible()
    await expect(page.getByText(/1 处理中/)).toBeVisible()
  })

  test('空态样张：?state=empty', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works?state=empty`)
    await expect(page.getByText('暂无作品')).toBeVisible()
    await expect(page.getByText(/真实保存能力将随 T17 接入/)).toBeVisible()
  })

  test('页面无横向溢出', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works`)
    const overflow = await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('CSR 边界：初始 HTML 不含夹具内容', async ({ request }) => {
    const response = await request.get(`${adminBaseURL}/admin/works`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).not.toContain('蓝莓')
  })
})

test.describe('T07 后台作品编辑页', () => {
  test('蓝莓（已发布领养）：表单、领养字段、媒体与发布检查齐备', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/${BLUEBERRY_ID}`)

    await expect(page.getByRole('heading', { level: 1, name: '蓝莓' })).toBeVisible()
    await expect(page.getByLabel(/角色名/)).toHaveValue('蓝莓')
    await expect(page.getByLabel(/链接别名/)).toHaveValue('blueberry')
    await expect(page.getByLabel('装型')).toHaveValue('full')
    await expect(page.getByLabel('用途')).toHaveValue('adoption')
    await expect(page.getByLabel('领养方式')).toHaveValue('event_drop')
    await expect(page.getByLabel('业务状态')).toHaveValue('available')
    await expect(page.getByLabel(/公开人民币价格/)).toHaveValue('15600')
    await expect(page.getByText('仅后台可见')).toBeVisible()

    await expect(page.getByText('可以发布')).toBeVisible()
    await expect(page.getByRole('button', { name: '发布', exact: true })).toBeEnabled()

    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect(page.getByRole('status').last()).toContainText('保存接口尚未接入（T17）')

    await page.getByRole('button', { name: '发布', exact: true }).click()
    await expect(page.getByRole('status').last()).toContainText('发布接口尚未接入（T18）')
  })

  test('用途切换为委托后领养字段隐藏，发布检查即时收拢', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/${BLUEBERRY_ID}`)
    await page.getByLabel('用途').selectOption('commission')
    await expect(page.getByLabel('领养方式')).toHaveCount(0)
    await expect(page.getByText('领养方式与业务状态已选择')).toHaveCount(0)
  })

  test('栗子（草稿+失败素材）：发布禁用且给出原因', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/${LIZI_ID}`)
    await expect(page.getByText('暂不可发布')).toBeVisible()
    await expect(page.getByText('失败于校验环节')).toBeVisible()
    const publish = page.getByRole('button', { name: '发布', exact: true })
    await expect(publish).toBeDisabled()
    await expect(publish).toHaveAttribute('title', /请先完成发布检查/)
  })

  test('不存在的作品 ID 展示缺失状态而非崩溃', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/00000000-0000-4000-8000-000000000000`)
    await expect(page.getByText('未找到该作品')).toBeVisible()
    await page.getByRole('link', { name: '返回作品列表' }).click()
    await expect(page).toHaveURL(/\/admin\/works$/)
  })
})

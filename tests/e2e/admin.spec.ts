import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from './helpers/auth'
import { createWorkViaApi } from './helpers/admin-work'
import { capture } from './helpers/screenshots'

const FOLLOW_UP_SCREENSHOT_DIR
  = 'agent_docs/需求1-兽装工作室主页/implementation/notes/t26-t27/screenshots'

test.describe('管理端登录页', () => {
  test('/admin 重定向到登录页', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin`)
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('登录表单：字段、可达性与真实接口提交', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await expect(page.getByRole('heading', { level: 1, name: '管理端登录' })).toBeVisible()

    await page.getByLabel('用户名').fill('tester')
    await page.getByLabel('密码', { exact: true }).fill('secret')
    await page.getByRole('button', { name: '登录' }).click()

    await expect(page.getByRole('alert')).toHaveText('用户名或密码不正确。')
  })

  test('改密成功提示：?state=password-changed', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login?state=password-changed`)
    await expect(page.getByRole('status')).toContainText('密码已修改，请使用新密码重新登录。')
  })

  test('键盘 Tab 顺序：用户名 → 密码 → 登录按钮', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await page.getByLabel('用户名').focus()
    await expect(page.getByLabel('用户名')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('密码', { exact: true })).toBeFocused()
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

test.describe('后台作品列表页', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('六个管理入口的导航、一级标题和标签页标题一致', async ({ page }) => {
    for (const entry of [
      { label: '作品管理', path: '/admin/works' },
      { label: '返图管理', path: '/admin/returns' },
      { label: '大图管理', path: '/admin/site/home' },
      { label: '文案配置', path: '/admin/site/content' },
      { label: '全局水印', path: '/admin/site/branding' },
      { label: '修改密码', path: '/admin/account' },
    ]) {
      await page.goto(`${adminBaseURL}${entry.path}`)
      await expect(page.getByRole('navigation', { name: '管理导航' })
        .getByRole('link', { name: entry.label }))
        .toHaveAttribute('aria-current', 'page')
      await expect(page.getByRole('heading', { level: 1, name: entry.label }))
        .toBeVisible()
      await expect(page).toHaveTitle(entry.label)
    }
  })

  test('展示真实作品、发布状态与编辑入口，无 P1/P2 导航项', async ({ page }) => {
    const work = await createWorkViaApi(page, { characterName: '列表验证' })
    await page.goto(`${adminBaseURL}/admin/works`)

    await expect(page.getByRole('heading', { level: 1, name: '作品管理' })).toBeVisible()
    await expect(page).toHaveTitle(/作品管理/u)
    await expect(page.locator('.works-page__meta')).toHaveText(/共 \d+ 件/u)

    const nav = page.getByRole('navigation', { name: '管理导航' })
    // T21 人工验收确认管理导航顺序与完整页名；
    // T36 在作品管理之后插入“返图”，其余顺序不变。
    await expect(nav.getByRole('link')).toHaveCount(6)
    expect(await nav.getByRole('link').allTextContents()).toEqual([
      '作品管理',
      '返图管理',
      '大图管理',
      '文案配置',
      '全局水印',
      '修改密码',
    ])
    await expect(nav.getByRole('link', { name: '作品管理' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: '大图管理' })).toHaveAttribute(
      'href',
      '/admin/site/home',
    )
    await expect(nav.getByRole('link', { name: '全局水印' })).toHaveAttribute(
      'href',
      '/admin/site/branding',
    )
    await expect(nav.getByRole('link', { name: '文案配置' })).toHaveAttribute(
      'href',
      '/admin/site/content',
    )
    await expect(nav.getByRole('link', { name: '修改密码' })).toHaveAttribute(
      'href',
      '/admin/account',
    )

    await expect(
      page.getByRole('link', { name: '列表验证', exact: true }).first(),
    ).toBeVisible()
    const workRow = page.locator('.works-table tbody tr').filter({ hasText: '列表验证' })
    await expect(workRow.getByText('委托作品', { exact: true })).toBeVisible()
    await expect(workRow.getByText('草稿', { exact: true })).toBeVisible()

    // 列表不输出联系人等私有字段。
    await expect(page.getByText(/e2e-private-contact/)).toHaveCount(0)
    await expect(page.getByRole('link', { name: '创建作品' })).toHaveAttribute(
      'href',
      '/admin/works/new',
    )
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await expect(page.getByRole('heading', { level: 1, name: '列表验证' })).toBeVisible()
  })

  test('查找、筛选与分页共用当前作品顺序', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    for (let index = 1; index <= 11; index += 1) {
      await createWorkViaApi(page, {
        characterName: `分页检索-${String(index).padStart(2, '0')}`,
        purpose: index <= 6 ? 'commission' : 'showcase',
        species: index === 11 ? '水鹿' : '狐狸',
        suitType: index % 2 === 0 ? 'full' : 'partial',
      })
    }

    await page.goto(`${adminBaseURL}/admin/works`)
    await page.getByLabel('查找作品').fill('分页检索')
    await expect(page.getByRole('status').filter({ hasText: '找到 11 /' })).toBeVisible()
    await expect(page.locator('.works-table tbody tr')).toHaveCount(10)

    await page.getByRole('button', { name: '下一页' }).click()
    await expect(page.locator('.works-table tbody tr')).toHaveCount(1)
    await expect(page.getByText('第 2 / 2 页')).toBeVisible()

    await page.getByLabel('用途').selectOption('showcase')
    await expect(page.locator('.works-table tbody tr')).toHaveCount(5)
    await expect(page.getByText('第 1 / 1 页')).toBeVisible()
    await expect(page.getByRole('button', { name: '下一页' })).toBeDisabled()

    await page.getByLabel('查找作品').fill('水鹿')
    await expect(page.getByRole('link', { name: '分页检索-11', exact: true })).toBeVisible()
    await capture(page, 'visual-follow-up-admin-works-search-1440x900', FOLLOW_UP_SCREENSHOT_DIR)
  })

  test('列表接口返回空数组时显示创建入口而非错误', async ({ page }) => {
    await page.route('**/api/admin/v1/works', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }))
    await page.goto(`${adminBaseURL}/admin/works`)
    await expect(page.getByText('暂无作品')).toBeVisible()
    await expect(
      page.getByRole('link', { name: '创建第一件作品' }),
    ).toHaveAttribute('href', '/admin/works/new')
  })

  test('页面无横向溢出', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works`)
    const overflow = await page.evaluate(() =>
      document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('CSR 边界：初始 HTML 不含作品内容', async ({ page, request }) => {
    await createWorkViaApi(page, { characterName: '边界验证' })
    const response = await request.get(`${adminBaseURL}/admin/works`)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).not.toContain('边界验证')
  })
})

test.describe('后台作品编辑页', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('不存在的作品 ID 展示缺失状态而非崩溃', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/00000000-0000-4000-8000-000000000000`)
    await expect(page.getByText('未找到该作品')).toBeVisible()
    await page.getByRole('link', { name: '返回作品列表' }).click()
    await expect(page).toHaveURL(/\/admin\/works$/)
  })
})

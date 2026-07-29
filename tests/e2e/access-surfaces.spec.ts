import {
  expect,
  test,
} from '@playwright/test'

const adminBaseURL = 'http://localhost:3100'

test('public homepage is server rendered', async ({ page, request }) => {
  const response = await request.get('/')
  const html = await response.text()

  expect(response.ok()).toBe(true)
  expect(html).toContain('data-testid="public-home"')
  expect(html).toContain('有点小狗工作室')
  expect(html).toContain('dite dog')

  await page.goto('/')
  await expect(page.getByTestId('public-home')).toBeVisible()
})

test('admin login is client rendered', async ({ page, request }) => {
  const response = await request.get(`${adminBaseURL}/admin/login`)
  const html = await response.text()

  expect(response.ok()).toBe(true)
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow, noarchive')
  expect(html).not.toContain('data-testid="admin-login"')
  expect(html).not.toContain('管理端最小 CSR 切片已运行')

  await page.goto(`${adminBaseURL}/admin/login`)
  await expect(page.getByTestId('admin-login')).toBeVisible()
})

test('public host cannot reach the admin surface', async ({ request }) => {
  const response = await request.get('/admin/login')

  expect(response.status()).toBe(404)
  await expect(response.json()).resolves.toEqual({
    error: {
      code: 'NOT_FOUND',
      message: 'Resource was not found.',
    },
  })
})

test('health endpoint is reachable', async ({ request }) => {
  const response = await request.get('/api/health')

  expect(response.ok()).toBe(true)
  await expect(response.json()).resolves.toEqual({
    status: 'ok',
    service: 'project-fur-paws',
  })
})

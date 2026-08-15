import {
  expect,
  test,
} from '@playwright/test'
import { adminBaseURL } from './helpers/auth'

test('public homepage is server rendered', async ({ page, request }) => {
  const response = await request.get('/')
  const html = await response.text()

  expect(response.ok()).toBe(true)
  expect(html).toContain('data-testid="public-home"')
  expect(html).toContain('有点小狗工作室')
  expect(html).toContain('DITE DOG')
  expect(html).not.toContain('DITE DOG FURSUIT')

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
  const response = await request.get('/admin/login', {
    headers: {
      accept: 'text/html',
    },
  })

  expect(response.status()).toBe(404)
  expect(response.headers()['content-type']).toContain('text/html')
  expect(await response.text()).toContain('<title>')
})

test('API failures keep the JSON envelope without internal details', async ({
  request,
}) => {
  const notFoundResponse = await request.get('/api/not-exist')
  const failureResponse = await request.get('/api/__test__/error')

  expect(notFoundResponse.status()).toBe(404)
  expect(notFoundResponse.headers()['content-type']).toContain(
    'application/json',
  )
  await expect(notFoundResponse.json()).resolves.toEqual({
    error: {
      code: 'NOT_FOUND',
      message: 'Resource was not found.',
    },
  })

  expect(failureResponse.status()).toBe(500)
  expect(failureResponse.headers()['content-type']).toContain(
    'application/json',
  )
  expect(failureResponse.headers()['x-request-id']).toMatch(
    /^[A-Za-z0-9._:-]{8,128}$/,
  )
  const failureBody = await failureResponse.json()
  expect(failureBody).toEqual({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error.',
    },
  })
  expect(JSON.stringify(failureBody)).not.toContain(
    'test-contact@example.invalid',
  )
})

test('health endpoint is reachable', async ({ request }) => {
  const response = await request.get('/api/health')

  expect(response.ok()).toBe(true)
  await expect(response.json()).resolves.toEqual({
    status: 'ok',
    service: 'project-fur-paws',
  })
})

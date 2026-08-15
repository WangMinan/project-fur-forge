import { expect, test } from '@playwright/test'
import { adminBaseURL } from './helpers/auth'

test('R3-A 返图与动态页面/API 在双 Host 固定返回 404', async ({ request }) => {
  for (const path of ['/returns', '/returns/retired', '/updates']) {
    const response = await request.get(path, { headers: { accept: 'text/html' } })
    expect(response.status(), path).toBe(404)
    expect(response.headers()['content-type']).toContain('text/html')
  }

  for (const path of [
    '/api/public/v1/returns',
    '/api/public/v1/returns/retired',
    '/api/public/v1/updates',
  ]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'NOT_FOUND' },
    })
  }

  for (const path of [
    '/admin/returns',
    '/admin/updates',
    '/api/admin/v1/returns',
    '/api/admin/v1/updates',
  ]) {
    const response = await request.get(`${adminBaseURL}${path}`)
    expect(response.status(), path).toBe(404)
  }
})

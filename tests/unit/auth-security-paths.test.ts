import { afterEach, expect, it, vi } from 'vitest'

const guards = vi.hoisted(() => ({ origin: vi.fn(), limit: vi.fn(), session: vi.fn(), csrf: vi.fn() }))
vi.mock('../../server/utils/route/auth-session', () => ({
  assertAdminOrigin: guards.origin, assertCsrfToken: guards.csrf, requireAdminSession: guards.session,
}))
vi.mock('../../server/utils/route/request-rate-limit', () => ({ assertRequestRateLimit: guards.limit }))
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

it.each(['', '/', '//'])('protects equivalent security paths ending in %j', async (suffix) => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRequestURL', (event: { path: string }) => new URL(event.path, 'https://test.invalid'))
  const { default: middleware } = await import('../../server/middleware/02.auth-security')
  const event = (path: string) => ({ path: path + suffix, method: 'POST', context: {} }) as Parameters<typeof middleware>[0]
  await middleware(event('/api/auth/login'))
  expect(guards.origin).toHaveBeenCalledOnce()
  expect(guards.limit).toHaveBeenCalledWith(expect.anything(), 'login')
  await middleware(event('/api/public/v1/analytics/events'))
  expect(guards.limit).toHaveBeenCalledWith(expect.anything(), 'analytics')
  guards.session.mockResolvedValue({ csrfToken: 'synthetic', user: { id: 'admin' } })
  await middleware(event('/api/auth/logout'))
  expect(guards.csrf).toHaveBeenCalledOnce()
})

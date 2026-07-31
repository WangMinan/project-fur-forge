import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  isSessionIdleExpired,
  logAuthEvent,
  SESSION_IDLE_MS,
} from '../../server/utils/auth'
import {
  hashAdminPassword,
  verifyAdminPassword,
} from '../../server/utils/password'

describe('authentication primitives', () => {
  it('hashes passwords with scrypt and verifies without plaintext storage', async () => {
    const password = 'correct horse battery staple'
    const hash = await hashAdminPassword(password)

    expect(hash).toMatch(/^scrypt\$v=1\$N=131072\$r=8\$p=1\$/)
    expect(hash).not.toContain(password)
    await expect(verifyAdminPassword(hash, password)).resolves.toBe(true)
    await expect(verifyAdminPassword(hash, 'wrong password')).resolves.toBe(
      false,
    )
  }, 10_000)

  it('expires sessions after eight idle hours', () => {
    const now = Date.UTC(2026, 6, 31, 12)

    expect(isSessionIdleExpired(now - SESSION_IDLE_MS + 1, now)).toBe(false)
    expect(isSessionIdleExpired(now - SESSION_IDLE_MS, now)).toBe(true)
    expect(isSessionIdleExpired(now + 1, now)).toBe(true)
  })

  it('security logs contain only the event and sanitized username', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    logAuthEvent('LOGIN_FAILED', 'admin password=do-not-log')

    const serialized = JSON.stringify(consoleWarn.mock.calls)
    expect(serialized).toContain('LOGIN_FAILED')
    expect(serialized).toContain('username')
    expect(serialized).not.toContain('do-not-log')
    expect(serialized).not.toContain('cookie')
    expect(serialized).not.toContain('session')
    consoleWarn.mockRestore()
  })
})

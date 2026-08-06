import {
  PassThrough,
} from 'node:stream'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { readAdminCredentials } from '../../scripts/auth-input'
import {
  isSessionIdleExpired,
  logAuthEvent,
  SESSION_IDLE_MS,
} from '../../server/utils/service/auth'
import {
  hashAdminPassword,
  verifyAdminPassword,
} from '../../server/utils/password'

describe('authentication primitives', () => {
  it('keeps interactive passwords off stdout', async () => {
    const input = new PassThrough() as PassThrough & {
      isRaw: boolean
      isTTY: boolean
      setRawMode: (mode: boolean) => void
    }
    const output = new PassThrough() as PassThrough & {
      isTTY: boolean
    }
    let stdout = ''

    input.isRaw = false
    input.isTTY = true
    input.setRawMode = (mode) => {
      input.isRaw = mode
    }
    output.isTTY = true
    output.on('data', chunk => stdout += chunk.toString())

    const credentials = readAdminCredentials(
      'Admin password: ',
      {},
      input,
      output,
    )
    input.write('admin\r')
    await new Promise<void>(resolve => setImmediate(resolve))
    input.write('hidden admin password\r')

    await expect(credentials).resolves.toEqual({
      password: 'hidden admin password',
      username: 'admin',
    })
    expect(stdout).toContain('admin')
    expect(stdout).not.toContain('hidden admin password')
    expect(input.isRaw).toBe(false)
    expect(input.isPaused()).toBe(true)
  })

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

  it('security logs contain only the event and a redacted username', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    logAuthEvent('LOGIN_FAILED', 'admin password=do-not-log')

    const serialized = JSON.stringify(consoleWarn.mock.calls)
    const context = JSON.parse(
      consoleWarn.mock.calls[0]![1] as string,
    )
    expect(serialized).toContain('LOGIN_FAILED')
    expect(context).toEqual({
      event: 'LOGIN_FAILED',
      username: '[REDACTED]',
    })
    expect(serialized).not.toContain('admin')
    expect(serialized).not.toContain('do-not-log')
    expect(serialized).not.toContain('cookie')
    expect(serialized).not.toContain('session')
    consoleWarn.mockRestore()
  })
})

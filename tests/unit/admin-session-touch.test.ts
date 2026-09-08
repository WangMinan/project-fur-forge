import type { H3Event } from 'h3'
import { createError } from 'h3'
import { afterEach, expect, it, vi } from 'vitest'
import { requireAdminSession } from '../../server/utils/route/auth-session'
import * as auth from '../../server/utils/service/auth'

vi.mock('../../server/utils/database', () => ({ getDatabase: () => ({ sqlite: {} }) }))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('checks idle expiry and session revocation without touching passive sessions', async () => {
  const now = Date.UTC(2026, 8, 9)
  const user = { id: 'admin', username: 'admin', version: 1 }
  const session = { user, csrfToken: 'test-only', secure: { sessionVersion: 1, lastSeenAt: now - 60_000 } }
  vi.stubGlobal('getUserSession', vi.fn().mockResolvedValue(session))
  const replace = vi.fn()
  const clear = vi.fn()
  vi.stubGlobal('replaceUserSession', replace)
  vi.stubGlobal('clearUserSession', clear)
  vi.stubGlobal('createError', createError)
  const find = vi.spyOn(auth, 'findActiveAdminById').mockReturnValue({ ...user, sessionVersion: 1 })
  const event = {} as H3Event
  const passive = await requireAdminSession(event, now, { touch: false })
  expect(passive.secure.lastSeenAt).toBe(now - 60_000)
  expect(replace).not.toHaveBeenCalled()
  await requireAdminSession(event, now)
  expect(replace).toHaveBeenCalledWith(event, expect.objectContaining({ secure: { sessionVersion: 1, lastSeenAt: now } }))
  session.secure.lastSeenAt = now - auth.SESSION_IDLE_MS
  await expect(requireAdminSession(event, now, { touch: false })).rejects.toMatchObject({ statusCode: 401 })
  session.secure.lastSeenAt = now
  find.mockReturnValue({ ...user, sessionVersion: 2 })
  await expect(requireAdminSession(event, now, { touch: false })).rejects.toMatchObject({ statusCode: 401 })
  expect(clear).toHaveBeenCalledTimes(2)
})

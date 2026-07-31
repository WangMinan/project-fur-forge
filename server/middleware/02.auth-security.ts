import {
  assertAdminOrigin,
  assertCsrfToken,
  requireAdminSession,
} from '../utils/auth-session'

function isAtOrBelow(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname

  if (
    event.method === 'POST'
    && pathname === '/api/auth/login'
  ) {
    assertAdminOrigin(event)
    return
  }

  if (
    pathname === '/api/auth/logout'
    || isAtOrBelow(pathname, '/api/admin')
  ) {
    const session = await requireAdminSession(event)
    event.context.adminSession = session

    if (!['GET', 'HEAD'].includes(event.method)) {
      assertAdminOrigin(event)
      assertCsrfToken(event, session.csrfToken)
    }
  }
})

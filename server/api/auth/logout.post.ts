import { logoutResponseSchema } from '../../../shared/schemas/auth'
import {
  adminSessionFor,
  endAdminSession,
} from '../../utils/route/auth-session'
import {
  invalidateAdminSessions,
  logAuthEvent,
} from '../../utils/service/auth'
import { getDatabase } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const session = adminSessionFor(event)
  invalidateAdminSessions(
    getDatabase().sqlite,
    session.user.id,
  )
  await endAdminSession(event)
  logAuthEvent('LOGOUT_SUCCEEDED', session.user.username)

  return logoutResponseSchema.parse({
    data: {
      cleared: true,
    },
  })
})

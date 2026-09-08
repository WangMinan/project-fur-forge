import { sessionResponseSchema } from '../../../shared/schemas/auth'
import { requireAdminSession } from '../../utils/route/auth-session'
import { createApiError } from '../../utils/api-error'

export default defineEventHandler(async (event) => {
  const touch = getQuery(event).touch
  if (touch !== undefined && touch !== '0') {
    throw createApiError(400, 'VALIDATION_ERROR', 'Session query is invalid.')
  }
  const session = await requireAdminSession(event, Date.now(), { touch: touch !== '0' })

  return sessionResponseSchema.parse({
    data: {
      user: session.user,
      csrfToken: session.csrfToken,
    },
  })
})

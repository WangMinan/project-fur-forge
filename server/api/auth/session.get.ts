import { sessionResponseSchema } from '../../../shared/schemas/auth'
import { requireAdminSession } from '../../utils/auth-session'

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)

  return sessionResponseSchema.parse({
    data: {
      user: session.user,
      csrfToken: session.csrfToken,
    },
  })
})

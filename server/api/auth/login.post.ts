import {
  loginRequestSchema,
  loginResponseSchema,
} from '../../../shared/schemas/auth'
import { createApiError } from '../../utils/api-error'
import { authenticateAdmin } from '../../utils/auth'
import { startAdminSession } from '../../utils/auth-session'
import { getDatabase } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const parsed = loginRequestSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Request body is invalid.',
    )
  }

  const user = await authenticateAdmin(
    getDatabase().sqlite,
    parsed.data,
  )
  if (!user) {
    throw createApiError(
      401,
      'UNAUTHORIZED',
      'Username or password is incorrect.',
    )
  }

  return loginResponseSchema.parse({
    data: await startAdminSession(event, user),
  })
})

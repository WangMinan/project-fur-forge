import {
  changePasswordRequestSchema,
  changePasswordResponseSchema,
} from '../../../../shared/schemas/auth'
import { createApiError } from '../../../utils/api-error'
import { changeAdminPassword } from '../../../utils/auth'
import {
  adminSessionFor,
  endAdminSession,
} from '../../../utils/auth-session'
import { getDatabase } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  const parsed = changePasswordRequestSchema.safeParse(
    await readBody(event),
  )
  if (!parsed.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Request body is invalid.',
    )
  }

  const session = adminSessionFor(event)
  const result = await changeAdminPassword(getDatabase().sqlite, {
    userId: session.user.id,
    expectedVersion: parsed.data.expectedVersion,
    currentPassword: parsed.data.payload.currentPassword,
    newPassword: parsed.data.payload.newPassword,
  })

  if (result.status === 'conflict') {
    throw createApiError(
      409,
      'CONFLICT',
      'Resource version is stale.',
    )
  }
  if (result.status === 'unauthorized') {
    throw createApiError(
      401,
      'UNAUTHORIZED',
      'Current password is incorrect.',
    )
  }

  await endAdminSession(event)
  return changePasswordResponseSchema.parse({
    data: {
      version: result.version,
      reauthenticationRequired: true,
    },
  })
})

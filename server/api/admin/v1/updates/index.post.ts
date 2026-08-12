import {
  adminUpdateResponseSchema,
  createUpdateRequestSchema,
} from '../../../../../shared/schemas/update'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { adminSessionFor } from '../../../../utils/route/auth-session'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { asApiError } from '../../../../utils/service-error'
import { createUpdate } from '../../../../utils/service/update'

export default defineEventHandler(async (event) => {
  const body = createUpdateRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Update fields are invalid.')
  }

  try {
    const created = createUpdate(
      getDatabase().sqlite,
      body.data,
      adminSessionFor(event).user.id,
    )
    setResponseStatus(event, 201)
    return adminUpdateResponseSchema.parse({ data: created })
  }
  catch (error) {
    asApiError(error)
  }
})

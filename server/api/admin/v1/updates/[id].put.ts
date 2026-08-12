import { resourceIdSchema } from '../../../../../shared/schemas/api'
import {
  adminUpdateResponseSchema,
  updateUpdateRequestSchema,
} from '../../../../../shared/schemas/update'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { adminSessionFor } from '../../../../utils/route/auth-session'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { asApiError } from '../../../../utils/service-error'
import { editUpdate } from '../../../../utils/service/update'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = updateUpdateRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Update request is invalid.')
  }

  try {
    return adminUpdateResponseSchema.parse({
      data: editUpdate(
        getDatabase().sqlite,
        id.data,
        body.data.expectedVersion,
        body.data.payload,
        adminSessionFor(event).user.id,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

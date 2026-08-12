import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import {
  adminUpdateResponseSchema,
  mutateUpdateRequestSchema,
} from '../../../../../../shared/schemas/update'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { adminSessionFor } from '../../../../../utils/route/auth-session'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import { asApiError } from '../../../../../utils/service-error'
import { publishUpdate } from '../../../../../utils/service/update'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = mutateUpdateRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Update publish request is invalid.')
  }

  try {
    return adminUpdateResponseSchema.parse({
      data: publishUpdate(
        getDatabase().sqlite,
        id.data,
        body.data.expectedVersion,
        adminSessionFor(event).user.id,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

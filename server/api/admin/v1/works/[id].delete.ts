import { resourceIdSchema } from '../../../../../shared/schemas/api'
import {
  deleteWorkRequestSchema,
  deleteWorkResponseSchema,
} from '../../../../../shared/schemas/work'
import { createApiError } from '../../../../utils/api-error'
import { adminSessionFor } from '../../../../utils/auth-session'
import { getDatabase } from '../../../../utils/database'
import { getMediaStorage } from '../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../utils/request-body'
import { asApiError } from '../../../../utils/service-error'
import { deleteManagedWork } from '../../../../utils/work-management'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = deleteWorkRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    return deleteWorkResponseSchema.parse({
      data: await deleteManagedWork(
        getDatabase().sqlite,
        getMediaStorage(),
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

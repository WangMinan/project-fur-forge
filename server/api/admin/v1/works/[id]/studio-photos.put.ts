import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import {
  managedWorkResponseSchema,
  replaceStudioPhotosRequestSchema,
} from '../../../../../../shared/schemas/work'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { readAdminJsonBody } from '../../../../../utils/request-body'
import { asApiError } from '../../../../../utils/service-error'
import { replaceManagedStudioPhotos } from '../../../../../utils/work-management'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = replaceStudioPhotosRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    return managedWorkResponseSchema.parse({
      data: replaceManagedStudioPhotos(
        getDatabase().sqlite,
        id.data,
        body.data.expectedVersion,
        body.data.payload.photos,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import {
  managedWorkResponseSchema,
  replaceAdoptionCoverRequestSchema,
} from '../../../../../../shared/schemas/work'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import { asApiError } from '../../../../../utils/service-error'
import { replaceManagedAdoptionCover } from '../../../../../utils/service/work-management'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = replaceAdoptionCoverRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    return managedWorkResponseSchema.parse({
      data: replaceManagedAdoptionCover(
        getDatabase().sqlite,
        id.data,
        body.data.expectedVersion,
        body.data.payload.adoptionCover,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

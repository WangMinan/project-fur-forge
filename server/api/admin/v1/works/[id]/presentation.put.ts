import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import {
  managedWorkResponseSchema,
  updateWorkPresentationRequestSchema,
} from '../../../../../../shared/schemas/work'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { readAdminJsonBody } from '../../../../../utils/request-body'
import { asApiError } from '../../../../../utils/service-error'
import { updateManagedWorkPresentation } from '../../../../../utils/work-management'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = updateWorkPresentationRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Work presentation fields are invalid.')
  }
  try {
    return managedWorkResponseSchema.parse({
      data: updateManagedWorkPresentation(
        getDatabase().sqlite,
        id.data,
        body.data.expectedVersion,
        body.data.payload,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

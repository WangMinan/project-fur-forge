import { resourceIdSchema } from '../../../../../shared/schemas/api'
import {
  managedWorkResponseSchema,
  updateWorkRequestSchema,
} from '../../../../../shared/schemas/work'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { readAdminJsonBody } from '../../../../utils/request-body'
import { asApiError } from '../../../../utils/service-error'
import { updateManagedWork } from '../../../../utils/work-management'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = updateWorkRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!id.success || !body.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      body.success
        ? 'Work id is invalid.'
        : 'Work fields are invalid for the selected purpose.',
    )
  }
  try {
    return managedWorkResponseSchema.parse({
      data: updateManagedWork(
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

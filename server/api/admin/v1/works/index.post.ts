import {
  createWorkRequestSchema,
  managedWorkResponseSchema,
} from '../../../../../shared/schemas/work'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { readAdminJsonBody } from '../../../../utils/request-body'
import { asApiError } from '../../../../utils/service-error'
import { createManagedWork } from '../../../../utils/work-management'

export default defineEventHandler(async (event) => {
  const body = createWorkRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!body.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Work fields are invalid for the selected purpose.',
    )
  }
  try {
    setResponseStatus(event, 201)
    return managedWorkResponseSchema.parse({
      data: createManagedWork(getDatabase().sqlite, body.data),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

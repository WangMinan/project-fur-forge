import { resourceIdSchema } from '../../../../../shared/schemas/api'
import { managedWorkResponseSchema } from '../../../../../shared/schemas/work'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { asApiError } from '../../../../utils/service-error'
import { getManagedWork } from '../../../../utils/work-management'

export default defineEventHandler((event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(404, 'NOT_FOUND', 'Work was not found.')
  }
  try {
    return managedWorkResponseSchema.parse({
      data: getManagedWork(getDatabase().sqlite, id.data),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

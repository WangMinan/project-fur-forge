import { resourceIdSchema } from '../../../../../shared/schemas/api'
import { adminUpdateResponseSchema } from '../../../../../shared/schemas/update'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { asApiError } from '../../../../utils/service-error'
import { getAdminUpdate } from '../../../../utils/service/update'

export default defineEventHandler((event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Update id is invalid.')
  }

  try {
    return adminUpdateResponseSchema.parse({
      data: getAdminUpdate(getDatabase().sqlite, id.data),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

import { resourceIdSchema } from '../../../../../shared/schemas/api'
import { adminReturnPhotoResponseSchema } from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { asApiError } from '../../../../utils/service-error'
import { getReturnPhoto } from '../../../../utils/service/return-photo'

export default defineEventHandler((event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Return photo id is invalid.')
  }
  try {
    return adminReturnPhotoResponseSchema.parse({
      data: getReturnPhoto(getDatabase().sqlite, id.data),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

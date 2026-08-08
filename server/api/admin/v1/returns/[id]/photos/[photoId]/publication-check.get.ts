import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import { returnPhotoPublicationCheckResponseSchema } from '../../../../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../utils/database'
import { asApiError } from '../../../../../../../utils/service-error'
import { checkReturnPhotoPublication } from '../../../../../../../utils/service/return-photo'

export default defineEventHandler((event) => {
  const photoId = resourceIdSchema.safeParse(getRouterParam(event, 'photoId'))
  if (!photoId.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Return photo id is invalid.')
  }
  try {
    return returnPhotoPublicationCheckResponseSchema.parse({
      data: checkReturnPhotoPublication(getDatabase().sqlite, photoId.data),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import { watermarkOperationResponseSchema } from '../../../../../../../shared/schemas/watermark'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { asSafeApiError } from '../../../../../../utils/service-error'
import { getWatermarkOperation } from '../../../../../../utils/watermark-branding'

export default defineEventHandler((event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(404, 'NOT_FOUND', 'Watermark operation was not found.')
  }
  try {
    return watermarkOperationResponseSchema.parse({
      data: getWatermarkOperation(getDatabase().sqlite, id.data),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

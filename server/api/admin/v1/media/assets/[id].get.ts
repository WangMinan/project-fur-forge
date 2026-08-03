import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { verifiedAssetResponseSchema } from '../../../../../../shared/schemas/upload'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getVerifiedAsset } from '../../../../../utils/media-completion'
import { asSafeApiError } from '../../../../../utils/service-error'

export default defineEventHandler((event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    return verifiedAssetResponseSchema.parse({
      data: getVerifiedAsset(getDatabase().sqlite, id.data),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

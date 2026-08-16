import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { getCommissionDesignReference } from '../../../../../utils/service/commission-management'
import { asSafeApiError } from '../../../../../utils/service-error'

/** Authenticated, private-only commission design reference preview. */
export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    const result = await getCommissionDesignReference(
      getDatabase().sqlite,
      getMediaStorage(),
      id.data,
    )
    setResponseHeader(event, 'cache-control', 'no-store, max-age=0')
    setResponseHeader(event, 'pragma', 'no-cache')
    setResponseHeader(event, 'content-type', result.mimeType)
    setResponseHeader(event, 'x-content-type-options', 'nosniff')
    return result.content
  }
  catch (error) {
    asSafeApiError(error)
  }
})

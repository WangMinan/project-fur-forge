import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import {
  retryAssetProcessingRequestSchema,
  retryAssetProcessingResponseSchema,
} from '../../../../../../../shared/schemas/upload'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { retryAssetProcessing } from '../../../../../../utils/media-completion'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../utils/request-body'
import { asApiError } from '../../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = retryAssetProcessingRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    return retryAssetProcessingResponseSchema.parse({
      data: await retryAssetProcessing(
        getDatabase().sqlite,
        getMediaStorage(),
        id.data,
        body.data.expectedVersion,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

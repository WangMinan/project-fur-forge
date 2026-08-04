import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import { mutateHomeRequestSchema } from '../../../../../../../../shared/schemas/home'
import { publicationOperationResponseSchema } from '../../../../../../../../shared/schemas/publication'
import { createApiError } from '../../../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../../../utils/auth-session'
import { getDatabase } from '../../../../../../../utils/database'
import {
  retryHeroSlideUpscale,
  runHeroSlideUpscale,
} from '../../../../../../../utils/home-management'
import { getMediaStorage } from '../../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../../utils/request-body'
import { asSafeApiError } from '../../../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = mutateHomeRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    const sqlite = getDatabase().sqlite
    const operation = retryHeroSlideUpscale(
      sqlite,
      id.data,
      body.data.expectedVersion,
    )
    event.waitUntil(runHeroSlideUpscale(
      sqlite,
      getMediaStorage(),
      operation.operationId,
      adminSessionFor(event).user.id,
    ).catch(error => event.captureError(error, {
      tags: ['home-hero-upscale-retry'],
    })))
    return publicationOperationResponseSchema.parse({ data: operation })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

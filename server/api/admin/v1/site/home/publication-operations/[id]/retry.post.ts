import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import { mutateHomeRequestSchema } from '../../../../../../../../shared/schemas/home'
import { publicationOperationResponseSchema } from '../../../../../../../../shared/schemas/publication'
import { createApiError } from '../../../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../../../utils/route/auth-session'
import { getDatabase } from '../../../../../../../utils/database'
import {
  retryHeroSlidePublication,
  runHeroSlidePublication,
} from '../../../../../../../utils/runner/home-management'
import { getMediaStorage } from '../../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../../utils/route/request-body'
import { asSafeApiError } from '../../../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = mutateHomeRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    const sqlite = getDatabase().sqlite
    const storage = getMediaStorage()
    const operation = await retryHeroSlidePublication(
      sqlite,
      storage,
      id.data,
      body.data.expectedVersion,
    )
    if (operation.status !== 'FAILED') {
      event.waitUntil(runHeroSlidePublication(
        sqlite,
        storage,
        operation.operationId,
        adminSessionFor(event).user.id,
      ).catch(error => event.captureError(error, {
        tags: ['home-hero-publication-retry'],
      })))
    }
    return publicationOperationResponseSchema.parse({ data: operation })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

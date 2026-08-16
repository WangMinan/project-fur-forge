import { resourceIdSchema } from '~~/shared/schemas/api'
import { mutateHeroCollectionRequestSchema } from '~~/shared/schemas/home'
import { publicationOperationResponseSchema } from '~~/shared/schemas/publication'
import { createApiError } from '~~/server/utils/api-error'
import { adminSessionFor } from '~~/server/utils/route/auth-session'
import { getDatabase } from '~~/server/utils/database'
import { getMediaStorage } from '~~/server/utils/media-storage'
import { readAdminJsonBody } from '~~/server/utils/route/request-body'
import {
  retryHeroCollectionItemOperation,
  runHeroCollectionItemPublication,
  runHeroCollectionItemUnpublication,
  runHeroCollectionItemUpscale,
} from '~~/server/utils/runner/hero-collection-publication'
import { asSafeApiError } from '~~/server/utils/service-error'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = mutateHeroCollectionRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    const sqlite = getDatabase().sqlite
    const storage = getMediaStorage()
    const operation = await retryHeroCollectionItemOperation(
      sqlite,
      storage,
      id.data,
      body.data.expectedVersion,
    )
    if (operation.status !== 'DONE' && operation.status !== 'FAILED') {
      const runner = operation.operationType === 'PUBLISH'
        ? runHeroCollectionItemPublication
        : operation.operationType === 'UNPUBLISH'
          ? runHeroCollectionItemUnpublication
          : runHeroCollectionItemUpscale
      event.waitUntil(runner(
        sqlite,
        storage,
        operation.operationId,
        adminSessionFor(event).user.id,
      ).catch(error => event.captureError(error, { tags: ['hero-collection-retry'] })))
    }
    return publicationOperationResponseSchema.parse({ data: operation })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

import { mutateHeroCollectionRequestSchema } from '~~/shared/schemas/home'
import { publicationOperationResponseSchema } from '~~/shared/schemas/publication'
import { createApiError } from '~~/server/utils/api-error'
import { adminSessionFor } from '~~/server/utils/route/auth-session'
import { getDatabase } from '~~/server/utils/database'
import { getMediaStorage } from '~~/server/utils/media-storage'
import {
  readHeroCollectionItemId,
  readHeroCollectionRoute,
} from '~~/server/utils/route/hero-collection'
import { readAdminJsonBody } from '~~/server/utils/route/request-body'
import {
  runHeroCollectionItemPublication,
  startHeroCollectionItemPublication,
} from '~~/server/utils/runner/hero-collection-publication'
import { asSafeApiError } from '~~/server/utils/service-error'

export default defineEventHandler(async (event) => {
  const scope = readHeroCollectionRoute(event)
  const id = readHeroCollectionItemId(event)
  const body = mutateHeroCollectionRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    const sqlite = getDatabase().sqlite
    const operation = startHeroCollectionItemPublication(
      sqlite,
      id,
      scope.placement,
      scope.orientation,
      body.data.expectedVersion,
    )
    event.waitUntil(runHeroCollectionItemPublication(
      sqlite,
      getMediaStorage(),
      operation.operationId,
      adminSessionFor(event).user.id,
    ).catch(error => event.captureError(error, { tags: ['hero-collection-publish'] })))
    return publicationOperationResponseSchema.parse({ data: operation })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

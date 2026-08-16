import {
  adminHeroCollectionResponseSchema,
  mutateHeroCollectionRequestSchema,
} from '~~/shared/schemas/home'
import { createApiError } from '~~/server/utils/api-error'
import { getDatabase } from '~~/server/utils/database'
import { getMediaStorage } from '~~/server/utils/media-storage'
import {
  readHeroCollectionItemId,
  readHeroCollectionRoute,
} from '~~/server/utils/route/hero-collection'
import { readAdminJsonBody } from '~~/server/utils/route/request-body'
import { clearHeroCollectionItemPreview } from '~~/server/utils/runner/hero-collection-publication'
import { deleteHeroCollectionItem } from '~~/server/utils/service/hero-collection-management'
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
    await clearHeroCollectionItemPreview(
      sqlite,
      getMediaStorage(),
      id,
      scope.placement,
      scope.orientation,
      body.data.expectedVersion,
    )
    return adminHeroCollectionResponseSchema.parse({
      data: deleteHeroCollectionItem(
        sqlite,
        id,
        scope.placement,
        scope.orientation,
        body.data.expectedVersion,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

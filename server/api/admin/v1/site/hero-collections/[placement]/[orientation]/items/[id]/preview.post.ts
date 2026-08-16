import {
  adminHeroItemPreviewResponseSchema,
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
import { createHeroCollectionItemPreview } from '~~/server/utils/runner/hero-collection-publication'
import { asSafeApiError } from '~~/server/utils/service-error'

export default defineEventHandler(async (event) => {
  const scope = readHeroCollectionRoute(event)
  const id = readHeroCollectionItemId(event)
  const body = mutateHeroCollectionRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    return adminHeroItemPreviewResponseSchema.parse({
      data: await createHeroCollectionItemPreview(
        getDatabase().sqlite,
        getMediaStorage(),
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

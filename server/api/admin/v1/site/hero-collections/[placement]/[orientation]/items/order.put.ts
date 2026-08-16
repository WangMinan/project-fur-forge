import {
  adminHeroCollectionResponseSchema,
  reorderHeroItemsRequestSchema,
} from '~~/shared/schemas/home'
import { createApiError } from '~~/server/utils/api-error'
import { getDatabase } from '~~/server/utils/database'
import { readHeroCollectionRoute } from '~~/server/utils/route/hero-collection'
import { readAdminJsonBody } from '~~/server/utils/route/request-body'
import { reorderEnabledHeroCollectionItems } from '~~/server/utils/service/hero-collection-management'
import { asSafeApiError } from '~~/server/utils/service-error'

export default defineEventHandler(async (event) => {
  const scope = readHeroCollectionRoute(event)
  const body = reorderHeroItemsRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    return adminHeroCollectionResponseSchema.parse({
      data: reorderEnabledHeroCollectionItems(
        getDatabase().sqlite,
        scope.placement,
        scope.orientation,
        body.data.expectedVersion,
        body.data.payload.itemIds,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

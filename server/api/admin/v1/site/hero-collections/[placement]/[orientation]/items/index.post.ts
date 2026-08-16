import {
  adminHeroCollectionResponseSchema,
  createHeroItemRequestSchema,
} from '~~/shared/schemas/home'
import { createApiError } from '~~/server/utils/api-error'
import { getDatabase } from '~~/server/utils/database'
import { readHeroCollectionRoute } from '~~/server/utils/route/hero-collection'
import { readAdminJsonBody } from '~~/server/utils/route/request-body'
import { createHeroCollectionItem } from '~~/server/utils/service/hero-collection-management'
import { asSafeApiError } from '~~/server/utils/service-error'

export default defineEventHandler(async (event) => {
  const scope = readHeroCollectionRoute(event)
  const body = createHeroItemRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    setResponseStatus(event, 201)
    return adminHeroCollectionResponseSchema.parse({
      data: createHeroCollectionItem(
        getDatabase().sqlite,
        scope.placement,
        scope.orientation,
        body.data.expectedVersion,
        body.data.payload,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

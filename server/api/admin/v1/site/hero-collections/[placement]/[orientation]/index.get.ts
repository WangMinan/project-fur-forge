import { adminHeroCollectionResponseSchema } from '~~/shared/schemas/home'
import { getDatabase } from '~~/server/utils/database'
import { readHeroCollectionRoute } from '~~/server/utils/route/hero-collection'
import { getAdminHeroCollection } from '~~/server/utils/service/hero-collection-management'
import { asSafeApiError } from '~~/server/utils/service-error'

export default defineEventHandler((event) => {
  const scope = readHeroCollectionRoute(event)
  try {
    return adminHeroCollectionResponseSchema.parse({
      data: getAdminHeroCollection(
        getDatabase().sqlite,
        scope.placement,
        scope.orientation,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

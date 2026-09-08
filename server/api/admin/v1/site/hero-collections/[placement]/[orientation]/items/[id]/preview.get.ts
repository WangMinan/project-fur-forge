import { getDatabase } from '~~/server/utils/database'
import { getMediaStorage } from '~~/server/utils/media-storage'
import {
  readHeroCollectionItemId,
  readHeroCollectionRoute,
} from '~~/server/utils/route/hero-collection'
import { getHeroCollectionItemPreviewLink } from '~~/server/utils/runner/hero-collection-publication'
import { asSafeApiError, ServiceError } from '~~/server/utils/service-error'
import { parseAdminMediaDelivery, sendAdminMediaLink } from '~~/server/utils/route/admin-media-preview'

export default defineEventHandler(async (event) => {
  const scope = readHeroCollectionRoute(event)
  const id = readHeroCollectionItemId(event)
  try {
    const query = getQuery(event)
    const delivery = parseAdminMediaDelivery(query)
    if (query.w !== undefined || query.original !== undefined) {
      throw new ServiceError(400, 'VALIDATION_ERROR', 'Hero preview parameters are invalid.')
    }
    const signed = await getHeroCollectionItemPreviewLink(
      getDatabase().sqlite,
      getMediaStorage(),
      id,
      scope.placement,
      scope.orientation,
    )
    return sendAdminMediaLink(event, signed, delivery)
  }
  catch (error) {
    asSafeApiError(error)
  }
})

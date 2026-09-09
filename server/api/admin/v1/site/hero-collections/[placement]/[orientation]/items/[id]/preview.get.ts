import { getDatabase } from '~~/server/utils/database'
import { getMediaStorage } from '~~/server/utils/media-storage'
import {
  readHeroCollectionItemId,
  readHeroCollectionRoute,
} from '~~/server/utils/route/hero-collection'
import { getHeroCollectionItemPreviewContent } from '~~/server/utils/runner/hero-collection-publication'
import { asSafeApiError } from '~~/server/utils/service-error'

export default defineEventHandler(async (event) => {
  const scope = readHeroCollectionRoute(event)
  const id = readHeroCollectionItemId(event)
  try {
    const content = await getHeroCollectionItemPreviewContent(
      getDatabase().sqlite,
      getMediaStorage(),
      id,
      scope.placement,
      scope.orientation,
    )
    setResponseHeader(event, 'content-type', 'image/webp')
    setResponseHeader(event, 'cache-control', 'no-store, max-age=0')
    return content
  }
  catch (error) {
    asSafeApiError(error)
  }
})

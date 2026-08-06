import { z } from 'zod'
import { resourceIdSchema } from '../../../../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../../utils/database'
import { getHeroSlidePreviewContent } from '../../../../../../../../utils/runner/home-management'
import { readHeroPlacement } from '../../../../../../../../utils/route/hero-placement'
import { getMediaStorage } from '../../../../../../../../utils/media-storage'
import { asSafeApiError } from '../../../../../../../../utils/service-error'

const orientationSchema = z.enum(['landscape', 'portrait'])

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const orientation = orientationSchema.safeParse(
    getRouterParam(event, 'orientation'),
  )
  if (!id.success || !orientation.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    const content = await getHeroSlidePreviewContent(
      getDatabase().sqlite,
      getMediaStorage(),
      id.data,
      orientation.data,
      Date.now(),
      readHeroPlacement(event),
    )
    setResponseHeader(event, 'content-type', 'image/webp')
    return content
  }
  catch (error) {
    asSafeApiError(error)
  }
})

import { z } from 'zod'
import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { renderActiveWatermarkPreview } from '../../../../../../utils/recipe/media-recipe'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import { asSafeApiError } from '../../../../../../utils/service-error'

const usageSchema = z.enum(['design-sheet', 'detail', 'work-card'])

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const usage = usageSchema.safeParse(getQuery(event).usage)
  if (!id.success || !usage.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    const content = await renderActiveWatermarkPreview(
      getDatabase().sqlite,
      getMediaStorage(),
      id.data,
      usage.data,
    )
    setResponseHeader(event, 'content-type', 'image/webp')
    return content
  }
  catch (error) {
    asSafeApiError(error)
  }
})

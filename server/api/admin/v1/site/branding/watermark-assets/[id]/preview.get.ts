import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../../utils/media-storage'
import { asSafeApiError } from '../../../../../../../utils/service-error'
import { getWatermarkCandidateContent } from '../../../../../../../utils/watermark-branding'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(404, 'NOT_FOUND', 'Watermark candidate was not found.')
  }
  try {
    const preview = await getWatermarkCandidateContent(
      getDatabase().sqlite,
      getMediaStorage(),
      id.data,
    )
    setResponseHeader(event, 'content-type', preview.contentType)
    return preview.content
  }
  catch (error) {
    asSafeApiError(error)
  }
})

import { resourceIdSchema } from '../../../../../../../../../shared/schemas/api'
import { watermarkPreviewKindSchema } from '../../../../../../../../../shared/schemas/watermark'
import { createApiError } from '../../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../../../utils/media-storage'
import { asSafeApiError } from '../../../../../../../../utils/service-error'
import { getWatermarkPreviewContent } from '../../../../../../../../utils/watermark-branding'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const kind = watermarkPreviewKindSchema.safeParse(
    getRouterParam(event, 'kind'),
  )
  if (!id.success || !kind.success) {
    throw createApiError(404, 'NOT_FOUND', 'Watermark preview was not found.')
  }
  try {
    const preview = await getWatermarkPreviewContent(
      getDatabase().sqlite,
      getMediaStorage(),
      id.data,
      kind.data,
    )
    setResponseHeader(event, 'content-type', preview.contentType)
    return preview.content
  }
  catch (error) {
    asSafeApiError(error)
  }
})

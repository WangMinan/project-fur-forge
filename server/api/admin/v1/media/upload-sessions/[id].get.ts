import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { uploadSessionResponseSchema } from '../../../../../../shared/schemas/upload'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { asApiError } from '../../../../../utils/service-error'
import { getUploadSession } from '../../../../../utils/service/upload-session'

export default defineEventHandler(async (event) => {
  const parsed = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsed.success) {
    throw createApiError(404, 'NOT_FOUND', 'Upload session was not found.')
  }

  try {
    return uploadSessionResponseSchema.parse({
      data: await getUploadSession(
        getDatabase().sqlite,
        getMediaStorage(),
        parsed.data,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

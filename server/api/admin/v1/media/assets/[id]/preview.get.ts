import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import { asSafeApiError, ServiceError } from '../../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    const asset = getDatabase().sqlite.prepare(`
      SELECT private_object_key AS privateObjectKey, mime_type AS mimeType
      FROM assets
      WHERE id = ? AND status = 'READY'
    `).get(id.data) as { mimeType: string, privateObjectKey: string } | undefined
    if (!asset) {
      throw new ServiceError(404, 'NOT_FOUND', 'Asset was not found.')
    }

    setResponseHeader(event, 'content-type', asset.mimeType)
    return await getMediaStorage().getPrivate(asset.privateObjectKey)
  }
  catch (error) {
    asSafeApiError(error)
  }
})

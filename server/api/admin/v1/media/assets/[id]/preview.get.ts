import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import { privateAssetPreviewResponseSchema } from '../../../../../../../shared/schemas/media'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import { asApiError, ServiceError } from '../../../../../../utils/service-error'

const PREVIEW_TTL_MS = 5 * 60 * 1_000

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    const asset = getDatabase().sqlite.prepare(`
      SELECT private_object_key AS privateObjectKey
      FROM assets
      WHERE id = ? AND status = 'READY'
    `).get(id.data) as { privateObjectKey: string } | undefined
    if (!asset) {
      throw new ServiceError(404, 'NOT_FOUND', 'Asset was not found.')
    }

    return privateAssetPreviewResponseSchema.parse({
      data: await getMediaStorage().signPrivateGet(
        asset.privateObjectKey,
        Date.now() + PREVIEW_TTL_MS,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

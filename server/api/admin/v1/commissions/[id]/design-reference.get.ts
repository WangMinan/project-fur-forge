import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { asSafeApiError, ServiceError } from '../../../../../utils/service-error'
import { parseAdminMediaDelivery, parseAdminMediaPreviewQuery, sendAdminMediaLink } from '../../../../../utils/route/admin-media-preview'
import { processingSource, readyAssetSource } from '../../../../../utils/recipe/media-source'
import { ADMIN_MEDIA_SIGNED_URL_TTL_MS } from '../../../../../../shared/constants/admin-media-preview'

/** Authenticated, private-only commission design reference preview. */
export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    const query = getQuery(event)
    const delivery = parseAdminMediaDelivery(query)
    // The historical unqualified link opens the original; the page now explicitly requests w=640.
    const request = parseAdminMediaPreviewQuery(query.w === undefined && query.original === undefined
      ? { ...query, original: '1' } : query)
    const sqlite = getDatabase().sqlite
    const asset = sqlite.prepare(`SELECT asset.id FROM commission_submissions AS submission
      JOIN assets AS asset ON asset.id = submission.design_asset_id
      WHERE submission.id = ? AND asset.role = 'commission_design_reference' AND asset.status = 'READY'`)
      .get(id.data) as { id: string } | undefined
    if (!asset) throw new ServiceError(404, 'NOT_FOUND', 'Commission design reference was not found.')
    const source = readyAssetSource(sqlite, asset.id)
    const objectKey = request.mode === 'original' ? source.privateObjectKey : processingSource(sqlite, source).objectKey
    const signed = await getMediaStorage().signBrowserPrivateGet(objectKey, Date.now() + ADMIN_MEDIA_SIGNED_URL_TTL_MS,
      request.mode === 'preview' ? `image/auto-orient,1/resize,m_lfit,w_${request.width}` : undefined)
    return sendAdminMediaLink(event, signed, delivery)
  }
  catch (error) {
    asSafeApiError(error)
  }
})

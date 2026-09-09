import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { asSafeApiError, ServiceError } from '../../../../../utils/service-error'
import { parseAdminMediaPreviewQuery } from '../../../../../utils/route/admin-media-preview'
import { processingSource, readyAssetSource } from '../../../../../utils/recipe/media-source'

/** Authenticated, private-only commission design reference preview. */
export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    const query = getQuery(event)
    // Preserve historical original links; the detail page explicitly requests w=1280.
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
    const storage = getMediaStorage()
    setResponseHeader(event, 'x-content-type-options', 'nosniff')
    if (request.mode === 'original') {
      setResponseHeader(event, 'content-type', source.mimeType)
      setResponseHeader(event, 'content-disposition', 'inline')
      return await storage.getPrivate(objectKey)
    }
    const processed = await storage.getPrivateProcessed(objectKey,
      `image/auto-orient,1/resize,m_lfit,w_${request.width}`)
    setResponseHeader(event, 'content-type', processed.contentType || source.mimeType)
    return processed.content
  }
  catch (error) {
    asSafeApiError(error)
  }
})

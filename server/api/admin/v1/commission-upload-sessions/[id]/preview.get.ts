import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { adminSessionFor } from '../../../../../utils/route/auth-session'
import { asSafeApiError, ServiceError } from '../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  try {
    const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new ServiceError(400, 'VALIDATION_ERROR', 'Request is invalid.')
    const row = getDatabase().sqlite.prepare(`SELECT a.private_object_key AS objectKey, a.mime_type AS mimeType
      FROM commission_upload_sessions s JOIN assets a ON a.id = s.asset_id
      WHERE s.id = ? AND s.created_by = ? AND s.status = 'COMPLETED' AND s.retired_at IS NULL
        AND s.expires_at > ? AND a.status = 'READY' AND a.role = 'commission_design_reference'`)
      .get(id.data, adminSessionFor(event).user.id, Date.now()) as { objectKey: string, mimeType: string } | undefined
    if (!row) throw new ServiceError(404, 'NOT_FOUND', 'Preview is unavailable.')
    const result = await getMediaStorage().getPrivateProcessed(row.objectKey, 'image/auto-orient,1/resize,m_lfit,w_1280')
    setResponseHeader(event, 'content-type', result.contentType || row.mimeType)
    setResponseHeader(event, 'x-content-type-options', 'nosniff')
    return result.content
  }
  catch (error) { asSafeApiError(error) }
})

import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import {
  processingSource,
  readyAssetSource,
} from '../../../../../../utils/recipe/media-source'
import { asSafeApiError, ServiceError } from '../../../../../../utils/service-error'
import { parseAdminMediaDelivery, parseAdminMediaPreviewQuery, sendAdminMediaLink } from '../../../../../../utils/route/admin-media-preview'
import { ADMIN_MEDIA_SIGNED_URL_TTL_MS } from '../../../../../../../shared/constants/admin-media-preview'

/**
 * 管理端私有原图预览。
 *
 * `?w=320|640` 签发 OSS 缩略图；`?original=1` 才签发永久原图。
 * 两种模式显式互斥，避免宽度拼错或缩略失败时意外回传多 MB 原图。
 */
export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    const query = getQuery(event)
    const delivery = parseAdminMediaDelivery(query)
    const request = parseAdminMediaPreviewQuery(query)
    const asset = getDatabase().sqlite.prepare(`
      SELECT private_object_key AS privateObjectKey, mime_type AS mimeType
      FROM assets
      WHERE id = ? AND status = 'READY'
    `).get(id.data) as { mimeType: string, privateObjectKey: string } | undefined
    if (!asset) {
      throw new ServiceError(404, 'NOT_FOUND', 'Asset was not found.')
    }

    const storage = getMediaStorage()
    const expiresAt = Date.now() + ADMIN_MEDIA_SIGNED_URL_TTL_MS
    if (request.mode === 'original') {
      return sendAdminMediaLink(event, await storage.signBrowserPrivateGet(asset.privateObjectKey, expiresAt), delivery)
    }

    // 超过 OSS 处理输入上限的原图必须走已有的私有预处理源，
    // 与公开派生使用同一套输入解析，不在这里另开一条规则。
    const sqlite = getDatabase().sqlite
    const source = processingSource(sqlite, readyAssetSource(sqlite, id.data))
    const signed = await storage.signBrowserPrivateGet(source.objectKey, expiresAt,
      `image/auto-orient,1/resize,m_lfit,w_${request.width}`)
    return sendAdminMediaLink(event, signed, delivery)
  }
  catch (error) {
    asSafeApiError(error)
  }
})

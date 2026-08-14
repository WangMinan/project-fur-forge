import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import {
  processingSource,
  readyAssetSource,
} from '../../../../../../utils/recipe/media-source'
import { safeLog } from '../../../../../../utils/safe-log'
import { asSafeApiError, ServiceError } from '../../../../../../utils/service-error'
import { parseAdminMediaPreviewQuery } from '../../../../../../utils/route/admin-media-preview'

/**
 * 管理端私有原图预览。
 *
 * `?w=320|640` 请求服务端缩放后的预览；`?original=1` 才读取永久原图。
 * 两种模式显式互斥，避免宽度拼错或缩略失败时意外回传多 MB 原图。
 */
export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    const request = parseAdminMediaPreviewQuery(getQuery(event))
    const asset = getDatabase().sqlite.prepare(`
      SELECT private_object_key AS privateObjectKey, mime_type AS mimeType
      FROM assets
      WHERE id = ? AND status = 'READY'
    `).get(id.data) as { mimeType: string, privateObjectKey: string } | undefined
    if (!asset) {
      throw new ServiceError(404, 'NOT_FOUND', 'Asset was not found.')
    }

    const storage = getMediaStorage()
    if (request.mode === 'original') {
      setResponseHeader(event, 'content-type', asset.mimeType)
      return await storage.getPrivate(asset.privateObjectKey)
    }

    // 超过 OSS 处理输入上限的原图必须走已有的私有预处理源，
    // 与公开派生使用同一套输入解析，不在这里另开一条规则。
    const sqlite = getDatabase().sqlite
    const source = processingSource(sqlite, readyAssetSource(sqlite, id.data))
    try {
      // auto-orient 保证竖图不会横躺；m_lfit 保持原比例，不裁掉主体。
      const processed = await storage.getPrivateProcessed(
        source.objectKey,
        `image/auto-orient,1/resize,m_lfit,w_${request.width}`,
      )
      setResponseHeader(
        event,
        'content-type',
        processed.contentType || asset.mimeType,
      )
      return processed.content
    }
    catch (error) {
      safeLog('warn', 'Admin preview downscale failed.', {
        assetId: id.data,
        errorName: (error as { name?: unknown }).name,
        width: request.width,
      })
      throw new ServiceError(
        500,
        'INTERNAL_ERROR',
        'Private preview generation failed.',
      )
    }
  }
  catch (error) {
    asSafeApiError(error)
  }
})

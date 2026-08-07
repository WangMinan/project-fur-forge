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

/**
 * 管理端私有原图预览。
 *
 * `?w=` 请求服务端缩放后的缩略图：管理列表只需要几十像素宽，
 * 直接回传多 MB 原图既慢又浪费 OSS 流量。宽度白名单固定，
 * 避免把任意处理参数透传给 OSS。
 */
const PREVIEW_WIDTHS = [64, 96, 160, 320, 640] as const

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  const requestedWidth = Number(getQuery(event).w)
  const width = PREVIEW_WIDTHS.find(value => value === requestedWidth) ?? null

  try {
    const asset = getDatabase().sqlite.prepare(`
      SELECT private_object_key AS privateObjectKey, mime_type AS mimeType
      FROM assets
      WHERE id = ? AND status = 'READY'
    `).get(id.data) as { mimeType: string, privateObjectKey: string } | undefined
    if (!asset) {
      throw new ServiceError(404, 'NOT_FOUND', 'Asset was not found.')
    }

    const storage = getMediaStorage()
    if (width === null) {
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
        `image/auto-orient,1/resize,m_lfit,w_${width}`,
      )
      setResponseHeader(
        event,
        'content-type',
        processed.contentType || asset.mimeType,
      )
      return processed.content
    }
    catch (error) {
      // 缩略图失败不应让整行变成破图：退回原图，只记录脱敏日志。
      safeLog('warn', 'Admin preview downscale failed; serving original.', {
        assetId: id.data,
        errorName: (error as { name?: unknown }).name,
        width,
      })
      setResponseHeader(event, 'content-type', asset.mimeType)
      return await storage.getPrivate(asset.privateObjectKey)
    }
  }
  catch (error) {
    asSafeApiError(error)
  }
})

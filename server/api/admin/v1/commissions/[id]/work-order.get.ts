import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { buildCommissionWorkOrderPdf } from '../../../../../utils/service/commission-work-order'
import { asSafeApiError } from '../../../../../utils/service-error'

/**
 * 已接受申请的制作单 PDF（两页 A4 横版）。仅当前管理会话可读，响应禁止缓存：
 * 文件含单主 PII，不进共享缓存也不留代理副本。
 */
export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    const result = await buildCommissionWorkOrderPdf(
      getDatabase().sqlite,
      getMediaStorage(),
      id.data,
    )
    setResponseHeader(event, 'cache-control', 'no-store, max-age=0')
    setResponseHeader(event, 'pragma', 'no-cache')
    setResponseHeader(event, 'content-type', 'application/pdf')
    setResponseHeader(event, 'x-content-type-options', 'nosniff')
    setResponseHeader(
      event,
      'content-disposition',
      `attachment; filename="${result.fileName}"`,
    )
    return result.content
  }
  catch (error) {
    asSafeApiError(error)
  }
})

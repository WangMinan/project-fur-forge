import { adminReturnPhotoListQuerySchema, adminReturnPhotoListResponseSchema } from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { listAdminReturnPhotos } from '../../../../utils/service/return-photo'

/**
 * T35 返图列表：支持关联作品与发布状态筛选、编号分页。
 * 非法筛选参数返回 400，不静默忽略，避免景宸以为筛选生效了。
 */
export default defineEventHandler((event) => {
  const raw = getQuery(event)
  const query = adminReturnPhotoListQuerySchema.safeParse({
    ...(raw.page === undefined ? {} : { page: Number(raw.page) }),
    ...(raw.workId === undefined ? {} : { workId: String(raw.workId) }),
    ...(raw.publicationStatus === undefined
      ? {}
      : { publicationStatus: String(raw.publicationStatus) }),
  })
  if (!query.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Return photo list filter is invalid.',
    )
  }
  return adminReturnPhotoListResponseSchema.parse({
    data: listAdminReturnPhotos(getDatabase().sqlite, query.data),
  })
})

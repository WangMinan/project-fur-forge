import {
  adminReturnCharacterListQuerySchema,
  adminReturnCharacterListResponseSchema,
} from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { listAdminReturnCharacters } from '../../../../utils/service/return-photo'

/**
 * T35-F1 设定列表：按名称/昵称查找 + 编号分页。
 * 非法参数返回 400，不静默忽略，避免景宸以为筛选生效了。
 */
export default defineEventHandler((event) => {
  const raw = getQuery(event)
  const query = adminReturnCharacterListQuerySchema.safeParse({
    ...(raw.page === undefined ? {} : { page: Number(raw.page) }),
    ...(raw.pageSize === undefined ? {} : { pageSize: Number(raw.pageSize) }),
    ...(raw.query === undefined || String(raw.query).trim() === ''
      ? {}
      : { query: String(raw.query) }),
  })
  if (!query.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Return character list filter is invalid.',
    )
  }
  return adminReturnCharacterListResponseSchema.parse({
    data: listAdminReturnCharacters(getDatabase().sqlite, query.data),
  })
})

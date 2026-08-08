import { slugSchema } from '../../../../../shared/schemas/work'
import { publicReturnCharacterResponseSchema } from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getPublicReturnCharacterForRequest } from '../../../../utils/repository/public-return-repository'

/**
 * 公开设定返图页。设定不存在、或它还没有任何已发布返图时返回 404：
 * 公开端不暴露“存在一个空设定”这种后台事实。
 */
export default defineEventHandler((event) => {
  const slug = slugSchema.safeParse(getRouterParam(event, 'slug'))
  if (!slug.success) {
    throw createApiError(404, 'NOT_FOUND', 'Return character was not found.')
  }
  const data = getPublicReturnCharacterForRequest(slug.data)
  if (!data) {
    throw createApiError(404, 'NOT_FOUND', 'Return character was not found.')
  }
  return publicReturnCharacterResponseSchema.parse({ data })
})

import type { PublicWorkDetailDto } from '../../../../../shared/types/contracts'
import { slugSchema } from '../../../../../shared/schemas/work'
import { publicWorkDetailResponseSchema } from '../../../../../shared/schemas/public-content'
import { createApiError } from '../../../../utils/api-error'
import { getPublicSiteRepository } from '../../../../utils/repository/public-site-repository'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const slug = slugSchema.safeParse(getRouterParam(event, 'slug'))
  if (!slug.success) {
    throw createApiError(404, 'NOT_FOUND', 'Work was not found.')
  }
  // 404 必须在 try 外抛出：asSafeApiError 只透传 ServiceError，
  // 会把 try 内的 createApiError(404) 吞成 500，偏离「不存在为 404」的契约。
  let work: PublicWorkDetailDto | null = null
  try {
    work = getPublicSiteRepository().getWorkBySlug(slug.data)
  }
  catch (error) {
    asSafeApiError(error)
  }
  if (!work) {
    throw createApiError(404, 'NOT_FOUND', 'Work was not found.')
  }
  return publicWorkDetailResponseSchema.parse({ data: work })
})

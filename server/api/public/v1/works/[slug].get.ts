import { slugSchema } from '../../../../../shared/schemas/work'
import { publicWorkDetailResponseSchema } from '../../../../../shared/schemas/public-content'
import { createApiError } from '../../../../utils/api-error'
import { getPublicSiteRepository } from '../../../../utils/public-site-repository'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const slug = slugSchema.safeParse(getRouterParam(event, 'slug'))
  if (!slug.success) {
    throw createApiError(404, 'NOT_FOUND', 'Work was not found.')
  }
  try {
    const work = getPublicSiteRepository().getWorkBySlug(slug.data)
    if (!work) {
      throw createApiError(404, 'NOT_FOUND', 'Work was not found.')
    }
    return publicWorkDetailResponseSchema.parse({ data: work })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

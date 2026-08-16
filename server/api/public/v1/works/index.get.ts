import { publicWorkListResponseSchema } from '../../../../../shared/schemas/public-content'
import { asSafeApiError } from '../../../../utils/service-error'
import { getPublicSiteRepository } from '../../../../utils/repository/public-site-repository'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    const query = getQuery(event)
    return publicWorkListResponseSchema.parse({
      data: getPublicSiteRepository().listWorks({
        page: query.page,
        q: query.q,
      }),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

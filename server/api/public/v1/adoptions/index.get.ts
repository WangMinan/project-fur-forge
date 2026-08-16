import { publicAdoptionListResponseSchema } from '../../../../../shared/schemas/public-content'
import { getPublicSiteRepository } from '../../../../utils/repository/public-site-repository'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    const query = getQuery(event)
    return publicAdoptionListResponseSchema.parse({
      data: getPublicSiteRepository().listAdoptions({
        page: query.page,
        q: query.q,
      }),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

import { publicWorkListResponseSchema } from '../../../../../shared/schemas/public-content'
import { asSafeApiError } from '../../../../utils/service-error'
import { getPublicSiteRepository } from '../../../../utils/public-site-repository'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    const query = getQuery(event)
    return publicWorkListResponseSchema.parse({
      data: getPublicSiteRepository().listWorks({
        purpose: query.purpose,
        suitType: query.suitType,
      }),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

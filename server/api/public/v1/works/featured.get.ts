import { publicFeaturedWorksResponseSchema } from '../../../../../shared/schemas/public-content'
import { getPublicSiteRepository } from '../../../../utils/repository/public-site-repository'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    return publicFeaturedWorksResponseSchema.parse({
      data: getPublicSiteRepository().listFeaturedWorks(),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

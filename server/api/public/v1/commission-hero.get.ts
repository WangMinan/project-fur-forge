import { publicCommissionHeroResponseSchema } from '../../../../shared/schemas/home'
import { getPublicSiteRepository } from '../../../utils/repository/public-site-repository'
import { asSafeApiError } from '../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    return publicCommissionHeroResponseSchema.parse({
      data: getPublicSiteRepository().getCommissionHero(),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

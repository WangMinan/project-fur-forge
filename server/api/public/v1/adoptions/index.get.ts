import { publicAdoptionListResponseSchema } from '../../../../../shared/schemas/public-content'
import { getPublicSiteRepository } from '../../../../utils/public-site-repository'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    return publicAdoptionListResponseSchema.parse({
      data: getPublicSiteRepository().listAdoptions(),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

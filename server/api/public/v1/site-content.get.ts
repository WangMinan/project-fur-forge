import { publicSiteContentResponseSchema } from '../../../../shared/schemas/site-content'
import { getDatabase } from '../../../utils/database'
import { getPublicSiteContent } from '../../../utils/service/site-content'
import { asSafeApiError } from '../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    return publicSiteContentResponseSchema.parse({
      data: getPublicSiteContent(getDatabase().sqlite),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

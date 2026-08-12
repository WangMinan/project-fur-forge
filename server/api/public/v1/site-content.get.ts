import { publicSiteContentResponseSchema } from '../../../../shared/schemas/site-content'
import { getDatabase } from '../../../utils/database'
import { getPublicSiteContent } from '../../../utils/service/site-content'
import { asSafeApiError } from '../../../utils/service-error'
import { getRuntimeConfig } from '../../../utils/runtime-config'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    const config = getRuntimeConfig()
    return publicSiteContentResponseSchema.parse({
      data: getPublicSiteContent(
        getDatabase().sqlite,
        config.mediaBaseUrl,
        config.appEnv,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

import { publicSiteMetaResponseSchema } from '../../shared/schemas/site-meta'
import { getRuntimeConfig } from '../utils/runtime-config'
import { getPublicSiteMeta } from '../utils/service/site-meta'
import { asSafeApiError } from '../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    return publicSiteMetaResponseSchema.parse({
      data: getPublicSiteMeta(getRuntimeConfig()),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

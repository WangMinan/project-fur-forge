import { adminSiteContentResponseSchema } from '../../../../../../shared/schemas/site-content'
import { getDatabase } from '../../../../../utils/database'
import { getAdminSiteContent } from '../../../../../utils/service/site-content'
import { asSafeApiError } from '../../../../../utils/service-error'

export default defineEventHandler(() => {
  try {
    return adminSiteContentResponseSchema.parse({
      data: getAdminSiteContent(getDatabase().sqlite),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

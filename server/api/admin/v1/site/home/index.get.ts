import { adminHomeResponseSchema } from '../../../../../../shared/schemas/home'
import { getDatabase } from '../../../../../utils/database'
import { getAdminHome } from '../../../../../utils/home-management'
import { asSafeApiError } from '../../../../../utils/service-error'

export default defineEventHandler(() => {
  try {
    return adminHomeResponseSchema.parse({
      data: getAdminHome(getDatabase().sqlite),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

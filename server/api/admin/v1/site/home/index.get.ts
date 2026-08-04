import { adminHomeResponseSchema } from '../../../../../../shared/schemas/home'
import { getDatabase } from '../../../../../utils/database'
import { readHeroPlacement } from '../../../../../utils/hero-placement'
import { getAdminHome } from '../../../../../utils/home-management'
import { asSafeApiError } from '../../../../../utils/service-error'

export default defineEventHandler((event) => {
  try {
    return adminHomeResponseSchema.parse({
      data: getAdminHome(getDatabase().sqlite, readHeroPlacement(event)),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

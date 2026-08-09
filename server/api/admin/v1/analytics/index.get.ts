import { analyticsOverviewResponseSchema } from '../../../../../shared/schemas/analytics'
import { getDatabase } from '../../../../utils/database'
import { getAnalyticsOverview } from '../../../../utils/service/analytics'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler(() => {
  try {
    return analyticsOverviewResponseSchema.parse({
      data: getAnalyticsOverview(getDatabase().sqlite),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

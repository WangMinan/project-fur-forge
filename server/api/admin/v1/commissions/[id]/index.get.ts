import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { commissionSubmissionDetailResponseSchema } from '../../../../../../shared/schemas/commission'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getCommissionSubmissionDetail } from '../../../../../utils/service/commission-management'
import { asApiError } from '../../../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    return commissionSubmissionDetailResponseSchema.parse({
      data: getCommissionSubmissionDetail(getDatabase().sqlite, id.data),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

import {
  commissionSubmissionListResponseSchema,
  commissionSubmissionStatusSchema,
} from '../../../../../shared/schemas/commission'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { listCommissionSubmissions } from '../../../../utils/service/commission-management'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const status = commissionSubmissionStatusSchema.safeParse(
    getQuery(event).status ?? 'pending',
  )
  if (!status.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  return commissionSubmissionListResponseSchema.parse({
    data: listCommissionSubmissions(getDatabase().sqlite, status.data),
  })
})

import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { commissionEmailResponseSchema } from '../../../../../../shared/schemas/commission-email'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getCommissionEmails } from '../../../../../utils/service/commission-email'
import { asSafeApiError } from '../../../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  try {
    return commissionEmailResponseSchema.parse({ data: getCommissionEmails(getDatabase().sqlite, id.data) })
  }
  catch (error) { asSafeApiError(error) }
})

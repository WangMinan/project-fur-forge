import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { commissionEmailResponseSchema, retryCommissionEmailSchema } from '../../../../../../shared/schemas/commission-email'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import { requestCommissionEmailRetry } from '../../../../../utils/service/commission-email'
import { asSafeApiError } from '../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = retryCommissionEmailSchema.safeParse(await readAdminJsonBody(event))
  if (!id.success || !body.success) throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  try {
    return commissionEmailResponseSchema.parse({
      data: requestCommissionEmailRetry(getDatabase().sqlite, id.data, body.data.notificationId),
    })
  }
  catch (error) { asSafeApiError(error) }
})

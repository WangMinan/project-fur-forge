import {
  createCommissionSubmissionRequestSchema,
  createCommissionSubmissionResponseSchema,
} from '../../../../../shared/schemas/commission'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import {
  assertCommissionJsonContentType,
  assertPublicCommissionOrigin,
  commissionUploadBearerToken,
} from '../../../../utils/route/public-commission-route'
import { readPublicCommissionJsonBody } from '../../../../utils/route/request-body'
import { assertRequestRateLimit } from '../../../../utils/route/request-rate-limit'
import { createCommissionSubmission } from '../../../../utils/service/commission-management'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  assertPublicCommissionOrigin(event)
  assertCommissionJsonContentType(event)
  assertRequestRateLimit(event, 'commissionSubmission')
  const body = createCommissionSubmissionRequestSchema.safeParse(
    await readPublicCommissionJsonBody(event),
  )
  if (!body.success || body.data.website) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    setResponseStatus(event, 201)
    return createCommissionSubmissionResponseSchema.parse({
      data: createCommissionSubmission(
        getDatabase().sqlite,
        body.data,
        commissionUploadBearerToken(event),
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

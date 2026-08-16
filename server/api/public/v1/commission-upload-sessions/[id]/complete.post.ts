import {
  completeCommissionUploadRequestSchema,
  completeCommissionUploadResponseSchema,
} from '../../../../../../shared/schemas/commission'
import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import {
  assertCommissionJsonContentType,
  assertPublicCommissionOrigin,
  commissionUploadBearerToken,
} from '../../../../../utils/route/public-commission-route'
import { readPublicCommissionJsonBody } from '../../../../../utils/route/request-body'
import { assertRequestRateLimit } from '../../../../../utils/route/request-rate-limit'
import { completeCommissionUpload } from '../../../../../utils/service/commission-management'
import { asSafeApiError } from '../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  assertPublicCommissionOrigin(event)
  assertCommissionJsonContentType(event)
  assertRequestRateLimit(event, 'commissionUpload')
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = completeCommissionUploadRequestSchema.safeParse(
    await readPublicCommissionJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    return completeCommissionUploadResponseSchema.parse({
      data: {
        session: await completeCommissionUpload(
          getDatabase().sqlite,
          getMediaStorage(),
          id.data,
          commissionUploadBearerToken(event),
          body.data.expectedVersion,
        ),
      },
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

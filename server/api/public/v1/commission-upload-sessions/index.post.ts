import {
  createCommissionUploadRequestSchema,
  createCommissionUploadResponseSchema,
} from '../../../../../shared/schemas/commission'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { getMediaStorage } from '../../../../utils/media-storage'
import {
  assertCommissionJsonContentType,
  assertPublicCommissionOrigin,
} from '../../../../utils/route/public-commission-route'
import { readPublicCommissionJsonBody } from '../../../../utils/route/request-body'
import { assertRequestRateLimit } from '../../../../utils/route/request-rate-limit'
import { getRuntimeConfig } from '../../../../utils/runtime-config'
import { createCommissionUpload } from '../../../../utils/service/commission-management'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  assertPublicCommissionOrigin(event)
  assertCommissionJsonContentType(event)
  assertRequestRateLimit(event, 'commissionUpload')
  const body = createCommissionUploadRequestSchema.safeParse(
    await readPublicCommissionJsonBody(event),
  )
  if (!body.success || body.data.website) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    setResponseStatus(event, 201)
    return createCommissionUploadResponseSchema.parse({
      data: await createCommissionUpload(
        getDatabase().sqlite,
        getMediaStorage(),
        getRuntimeConfig(),
        body.data.expected,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

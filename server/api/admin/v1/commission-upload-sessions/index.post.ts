import { createCommissionUploadRequestSchema, createCommissionUploadResponseSchema } from '../../../../../shared/schemas/commission'
import { getDatabase } from '../../../../utils/database'
import { getMediaStorage } from '../../../../utils/media-storage'
import { getRuntimeConfig } from '../../../../utils/runtime-config'
import { adminSessionFor } from '../../../../utils/route/auth-session'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { createCommissionUpload } from '../../../../utils/service/commission-management'
import { createApiError } from '../../../../utils/api-error'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const body = createCommissionUploadRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!body.success) throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  try {
    return createCommissionUploadResponseSchema.parse({ data: await createCommissionUpload(
      getDatabase().sqlite, getMediaStorage(), getRuntimeConfig(), body.data.expected,
      { actorUserId: adminSessionFor(event).user.id },
    ) })
  }
  catch (error) { asSafeApiError(error) }
})

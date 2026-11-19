import { z } from 'zod'
import { createCommissionUploadResponseSchema } from '../../../../../../shared/schemas/commission'
import { resourceIdSchema, resourceVersionSchema } from '../../../../../../shared/schemas/api'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { getRuntimeConfig } from '../../../../../utils/runtime-config'
import { adminSessionFor } from '../../../../../utils/route/auth-session'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import { retryCommissionUpload } from '../../../../../utils/service/commission-management'
import { asSafeApiError, ServiceError } from '../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  try {
    const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
    const body = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/u), expectedVersion: resourceVersionSchema }).strict().safeParse(await readAdminJsonBody(event))
    if (!id.success || !body.success) throw new ServiceError(400, 'VALIDATION_ERROR', 'Request is invalid.')
    const result = await retryCommissionUpload(getDatabase().sqlite, getMediaStorage(), getRuntimeConfig(), id.data, body.data.token, body.data.expectedVersion, Date.now(), adminSessionFor(event).user.id)
    return createCommissionUploadResponseSchema.parse({ data: result })
  }
  catch (error) { asSafeApiError(error) }
})

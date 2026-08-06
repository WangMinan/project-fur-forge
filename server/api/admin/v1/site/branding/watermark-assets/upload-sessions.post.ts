import { createUploadSessionResponseSchema } from '../../../../../../../shared/schemas/upload'
import { createWatermarkUploadSessionRequestSchema } from '../../../../../../../shared/schemas/watermark'
import { createApiError } from '../../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../../utils/route/auth-session'
import { getDatabase } from '../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../utils/route/request-body'
import { getRuntimeConfig } from '../../../../../../utils/runtime-config'
import { asSafeApiError } from '../../../../../../utils/service-error'
import { createUploadSession } from '../../../../../../utils/service/upload-session'

export default defineEventHandler(async (event) => {
  const body = createWatermarkUploadSessionRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    return createUploadSessionResponseSchema.parse({
      data: await createUploadSession(
        getDatabase().sqlite,
        getMediaStorage(),
        getRuntimeConfig(),
        adminSessionFor(event).user.id,
        {
          owner: {
            type: 'site',
            id: 'branding',
            expectedVersion: body.data.expectedVersion,
          },
          mediaRole: 'watermark_logo',
          expected: body.data.payload.expected,
        },
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

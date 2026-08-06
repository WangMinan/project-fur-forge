import {
  createUploadSessionRequestSchema,
  createUploadSessionResponseSchema,
} from '../../../../../../shared/schemas/upload'
import { createApiError } from '../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../utils/route/auth-session'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import { getRuntimeConfig } from '../../../../../utils/runtime-config'
import { asApiError } from '../../../../../utils/service-error'
import { createUploadSession } from '../../../../../utils/service/upload-session'

export default defineEventHandler(async (event) => {
  const parsed = createUploadSessionRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!parsed.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }

  try {
    const result = await createUploadSession(
      getDatabase().sqlite,
      getMediaStorage(),
      getRuntimeConfig(),
      adminSessionFor(event).user.id,
      parsed.data,
    )
    return createUploadSessionResponseSchema.parse({ data: result })
  }
  catch (error) {
    asApiError(error)
  }
})

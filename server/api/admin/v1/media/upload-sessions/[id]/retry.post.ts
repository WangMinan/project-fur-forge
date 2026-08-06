import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import {
  retryUploadSessionResponseSchema,
  uploadSessionMutationRequestSchema,
} from '../../../../../../../shared/schemas/upload'
import { createApiError } from '../../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../../utils/route/auth-session'
import { getDatabase } from '../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../utils/route/request-body'
import { getRuntimeConfig } from '../../../../../../utils/runtime-config'
import { asApiError } from '../../../../../../utils/service-error'
import { retryUploadSession } from '../../../../../../utils/service/upload-session'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = uploadSessionMutationRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    return retryUploadSessionResponseSchema.parse({
      data: await retryUploadSession(
        getDatabase().sqlite,
        getMediaStorage(),
        getRuntimeConfig(),
        adminSessionFor(event).user.id,
        id.data,
        body.data.expectedVersion,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

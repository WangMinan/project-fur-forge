import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import {
  uploadSessionMutationRequestSchema,
  uploadSessionResponseSchema,
} from '../../../../../../../shared/schemas/upload'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../utils/request-body'
import { asApiError } from '../../../../../../utils/service-error'
import { cancelUploadSession } from '../../../../../../utils/upload-session'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = uploadSessionMutationRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    return uploadSessionResponseSchema.parse({
      data: await cancelUploadSession(
        getDatabase().sqlite,
        getMediaStorage(),
        id.data,
        body.data.expectedVersion,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

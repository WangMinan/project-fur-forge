import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import {
  completeUploadSessionRequestSchema,
  completeUploadSessionResponseSchema,
} from '../../../../../../../shared/schemas/upload'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { completeUploadSession } from '../../../../../../utils/media-completion'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../utils/request-body'
import { asApiError } from '../../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = completeUploadSessionRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }

  try {
    return completeUploadSessionResponseSchema.parse({
      data: await completeUploadSession(
        getDatabase().sqlite,
        getMediaStorage(),
        id.data,
        {
          expectedVersion: body.data.expectedVersion,
          ...body.data.payload,
        },
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

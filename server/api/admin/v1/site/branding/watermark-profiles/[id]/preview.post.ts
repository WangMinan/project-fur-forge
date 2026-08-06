import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import {
  watermarkOperationResponseSchema,
  watermarkProfileMutationRequestSchema,
} from '../../../../../../../../shared/schemas/watermark'
import { createApiError } from '../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../../utils/route/request-body'
import { asSafeApiError } from '../../../../../../../utils/service-error'
import { createWatermarkPreview } from '../../../../../../../utils/runner/watermark-branding'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = watermarkProfileMutationRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    return watermarkOperationResponseSchema.parse({
      data: await createWatermarkPreview(
        getDatabase().sqlite,
        getMediaStorage(),
        id.data,
        body.data.expectedVersion,
        body.data.payload.brandingVersion,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

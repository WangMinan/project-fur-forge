import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import {
  watermarkOperationResponseSchema,
  watermarkProfileMutationRequestSchema,
} from '../../../../../../../../shared/schemas/watermark'
import { createApiError } from '../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../../utils/request-body'
import { asSafeApiError } from '../../../../../../../utils/service-error'
import {
  runWatermarkProfileApplication,
  startWatermarkProfileApplication,
} from '../../../../../../../utils/watermark-branding'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = watermarkProfileMutationRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    const sqlite = getDatabase().sqlite
    const operation = startWatermarkProfileApplication(
      sqlite,
      id.data,
      body.data.expectedVersion,
      body.data.payload.brandingVersion,
    )
    if (operation.status !== 'DONE') {
      event.waitUntil(
        runWatermarkProfileApplication(
          sqlite,
          getMediaStorage(),
          operation.operationId,
        ).catch(error => event.captureError(error, {
          tags: ['watermark-application'],
        })),
      )
    }
    return watermarkOperationResponseSchema.parse({
      data: operation,
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

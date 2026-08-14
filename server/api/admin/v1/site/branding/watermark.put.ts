import {
  saveWatermarkRequestSchema,
  watermarkOperationResponseSchema,
} from '../../../../../../shared/schemas/watermark'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import { asSafeApiError } from '../../../../../utils/service-error'
import {
  runWatermarkProfileApplication,
  startWatermarkRefresh,
} from '../../../../../utils/runner/watermark-branding'

export default defineEventHandler(async (event) => {
  const body = saveWatermarkRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Watermark settings are invalid.')
  }

  try {
    const sqlite = getDatabase().sqlite
    const operation = startWatermarkRefresh(
      sqlite,
      body.data.expectedVersion,
      body.data.payload,
    )
    if (operation.status !== 'DONE') {
      event.waitUntil(
        runWatermarkProfileApplication(
          sqlite,
          getMediaStorage(),
          operation.operationId,
        ).catch(error => event.captureError(error, {
          tags: ['watermark-refresh'],
        })),
      )
    }
    return watermarkOperationResponseSchema.parse({ data: operation })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

import {
  createWatermarkProfileRequestSchema,
  watermarkProfileResponseSchema,
} from '../../../../../../shared/schemas/watermark'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { readAdminJsonBody } from '../../../../../utils/request-body'
import { asSafeApiError } from '../../../../../utils/service-error'
import {
  createWatermarkProfile,
  watermarkProfileDto,
} from '../../../../../utils/watermark-profile'

export default defineEventHandler(async (event) => {
  const body = createWatermarkProfileRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    return watermarkProfileResponseSchema.parse({
      data: watermarkProfileDto(createWatermarkProfile(
        getDatabase().sqlite,
        body.data.expectedVersion,
        body.data.payload,
      )),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

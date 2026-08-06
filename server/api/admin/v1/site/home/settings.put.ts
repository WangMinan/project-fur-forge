import {
  adminHomeResponseSchema,
  updateHomeSettingsRequestSchema,
} from '../../../../../../shared/schemas/home'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { updateHomeSettings } from '../../../../../utils/runner/home-management'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import { asSafeApiError } from '../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const body = updateHomeSettingsRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    return adminHomeResponseSchema.parse({
      data: updateHomeSettings(
        getDatabase().sqlite,
        body.data.expectedVersion,
        body.data.payload,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

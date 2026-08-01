import {
  adminHomeResponseSchema,
  createHeroSlideRequestSchema,
} from '../../../../../../../shared/schemas/home'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { createHeroSlide } from '../../../../../../utils/home-management'
import { readAdminJsonBody } from '../../../../../../utils/request-body'
import { asSafeApiError } from '../../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const body = createHeroSlideRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request body is invalid.')
  }
  try {
    setResponseStatus(event, 201)
    return adminHomeResponseSchema.parse({
      data: createHeroSlide(
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

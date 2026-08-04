import { resourceIdSchema } from '../../../../../../../shared/schemas/api'
import {
  adminHomeResponseSchema,
  mutateHomeRequestSchema,
} from '../../../../../../../shared/schemas/home'
import { createApiError } from '../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../utils/database'
import { deleteHeroSlide } from '../../../../../../utils/home-management'
import { readHeroPlacement } from '../../../../../../utils/hero-placement'
import { getMediaStorage } from '../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../utils/request-body'
import { asSafeApiError } from '../../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = mutateHomeRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    return adminHomeResponseSchema.parse({
      data: await deleteHeroSlide(
        getDatabase().sqlite,
        getMediaStorage(),
        id.data,
        body.data.expectedVersion,
        Date.now(),
        readHeroPlacement(event),
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

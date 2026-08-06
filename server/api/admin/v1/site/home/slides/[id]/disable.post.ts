import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import { mutateHomeRequestSchema, adminHomeResponseSchema } from '../../../../../../../../shared/schemas/home'
import { adminSessionFor } from '../../../../../../../utils/route/auth-session'
import { createApiError } from '../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../utils/database'
import { disableHeroSlide } from '../../../../../../../utils/runner/home-management'
import { readHeroPlacement } from '../../../../../../../utils/route/hero-placement'
import { getMediaStorage } from '../../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../../utils/route/request-body'
import { asSafeApiError } from '../../../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = mutateHomeRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    return adminHomeResponseSchema.parse({
      data: await disableHeroSlide(
        getDatabase().sqlite,
        getMediaStorage(),
        id.data,
        body.data.expectedVersion,
        adminSessionFor(event).user.id,
        Date.now(),
        readHeroPlacement(event),
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

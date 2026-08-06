import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import { mutateHomeRequestSchema } from '../../../../../../../../shared/schemas/home'
import { publicationOperationResponseSchema } from '../../../../../../../../shared/schemas/publication'
import { createApiError } from '../../../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../../../utils/route/auth-session'
import { getDatabase } from '../../../../../../../utils/database'
import {
  runHeroSlidePublication,
  startHeroSlidePublication,
} from '../../../../../../../utils/runner/home-management'
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
    const sqlite = getDatabase().sqlite
    const actorUserId = adminSessionFor(event).user.id
    const operation = startHeroSlidePublication(
      sqlite,
      id.data,
      body.data.expectedVersion,
      Date.now(),
      readHeroPlacement(event),
    )
    event.waitUntil(runHeroSlidePublication(
      sqlite,
      getMediaStorage(),
      operation.operationId,
      actorUserId,
    ).catch(error => event.captureError(error, {
      tags: ['home-hero-publication'],
    })))
    return publicationOperationResponseSchema.parse({ data: operation })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

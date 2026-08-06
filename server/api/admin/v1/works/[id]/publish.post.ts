import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import {
  publicationActionResponseSchema,
  publicationMutationRequestSchema,
} from '../../../../../../shared/schemas/publication'
import { createApiError } from '../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../utils/route/auth-session'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import { asApiError } from '../../../../../utils/service-error'
import { publishWork } from '../../../../../utils/runner/work-publication'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = publicationMutationRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    return publicationActionResponseSchema.parse({
      data: await publishWork(
        getDatabase().sqlite,
        getMediaStorage(),
        id.data,
        body.data.expectedVersion,
        adminSessionFor(event).user.id,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

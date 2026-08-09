import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import {
  publicationMutationRequestSchema,
  publicationOperationResponseSchema,
} from '../../../../../../shared/schemas/publication'
import { createApiError } from '../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../utils/route/auth-session'
import { getDatabase } from '../../../../../utils/database'
import { getMediaStorage } from '../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import { asApiError } from '../../../../../utils/service-error'
import { retryPublicationCleanup } from '../../../../../utils/runner/work-publication'
import { retryReturnPhotoCleanup } from '../../../../../utils/runner/return-photo-publication'
import { findReturnPhotoOperationType } from '../../../../../utils/repository/return-photo-repository'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = publicationMutationRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    const sqlite = getDatabase().sqlite
    const storage = getMediaStorage()
    const actorUserId = adminSessionFor(event).user.id
    const retry = findReturnPhotoOperationType(sqlite, id.data)
      ? retryReturnPhotoCleanup
      : retryPublicationCleanup
    return publicationOperationResponseSchema.parse({
      data: await retry(
        sqlite,
        storage,
        id.data,
        body.data.expectedVersion,
        actorUserId,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

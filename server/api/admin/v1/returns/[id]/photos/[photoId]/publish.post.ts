import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import { publicationMutationRequestSchema } from '../../../../../../../../shared/schemas/publication'
import { returnPhotoPublicationActionResponseSchema } from '../../../../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../utils/database'
import { getMediaStorage } from '../../../../../../../utils/media-storage'
import { readAdminJsonBody } from '../../../../../../../utils/route/request-body'
import { asApiError } from '../../../../../../../utils/service-error'
import { publishReturnPhoto } from '../../../../../../../utils/runner/return-photo-publication'

export default defineEventHandler(async (event) => {
  const photoId = resourceIdSchema.safeParse(getRouterParam(event, 'photoId'))
  const body = publicationMutationRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!photoId.success || !body.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      body.success
        ? 'Return photo id is invalid.'
        : 'Publish request is invalid.',
    )
  }
  try {
    return returnPhotoPublicationActionResponseSchema.parse({
      data: await publishReturnPhoto(
        getDatabase().sqlite,
        getMediaStorage(),
        photoId.data,
        body.data.expectedVersion,
        event.context.adminSession!.user.id,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

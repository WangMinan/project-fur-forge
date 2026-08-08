import { randomUUID } from 'node:crypto'
import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import { publicationMutationRequestSchema } from '../../../../../../../../shared/schemas/publication'
import { adminReturnCharacterResponseSchema } from '../../../../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../utils/database'
import { insertReturnPhotoAuditLog } from '../../../../../../../utils/repository/return-photo-repository'
import { readAdminJsonBody } from '../../../../../../../utils/route/request-body'
import { asApiError } from '../../../../../../../utils/service-error'
import { setReturnCharacterPrimaryPhoto } from '../../../../../../../utils/service/return-photo'

/**
 * 指定这张返图为设定主图（设定页的圆形头像）。
 * 返回整个设定，因为旧主图的标记同时被清除。
 */
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
        : 'Primary photo request is invalid.',
    )
  }
  try {
    const sqlite = getDatabase().sqlite
    const character = setReturnCharacterPrimaryPhoto(
      sqlite,
      photoId.data,
      body.data.expectedVersion,
    )
    insertReturnPhotoAuditLog(sqlite, {
      action: 'RETURN_PHOTO_SET_PRIMARY',
      actorUserId: event.context.adminSession!.user.id,
      id: randomUUID(),
      result: 'SUCCESS',
      returnPhotoId: photoId.data,
    }, Date.now())
    return adminReturnCharacterResponseSchema.parse({ data: character })
  }
  catch (error) {
    asApiError(error)
  }
})

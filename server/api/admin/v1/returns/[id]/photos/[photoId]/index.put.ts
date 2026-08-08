import { randomUUID } from 'node:crypto'
import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import {
  adminReturnPhotoResponseSchema,
  updateReturnPhotoRequestSchema,
} from '../../../../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../utils/database'
import { insertReturnPhotoAuditLog } from '../../../../../../../utils/repository/return-photo-repository'
import { readAdminJsonBody } from '../../../../../../../utils/route/request-body'
import { asApiError } from '../../../../../../../utils/service-error'
import { updateReturnPhoto } from '../../../../../../../utils/service/return-photo'

/** 单张返图目前只有 alt 可改；主图与发布状态各有专用接口。 */
export default defineEventHandler(async (event) => {
  const photoId = resourceIdSchema.safeParse(getRouterParam(event, 'photoId'))
  const body = updateReturnPhotoRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!photoId.success || !body.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      body.success
        ? 'Return photo id is invalid.'
        : 'Return photo fields are invalid.',
    )
  }
  try {
    const sqlite = getDatabase().sqlite
    const updated = updateReturnPhoto(
      sqlite,
      photoId.data,
      body.data.expectedVersion,
      body.data.payload.alt,
    )
    insertReturnPhotoAuditLog(sqlite, {
      action: 'RETURN_PHOTO_UPDATE',
      actorUserId: event.context.adminSession!.user.id,
      id: randomUUID(),
      result: 'SUCCESS',
      returnPhotoId: updated.id,
    }, Date.now())
    return adminReturnPhotoResponseSchema.parse({ data: updated })
  }
  catch (error) {
    asApiError(error)
  }
})

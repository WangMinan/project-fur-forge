import { randomUUID } from 'node:crypto'
import { resourceIdSchema } from '../../../../../shared/schemas/api'
import {
  adminReturnPhotoResponseSchema,
  updateReturnPhotoRequestSchema,
} from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { insertReturnPhotoAuditLog } from '../../../../utils/repository/return-photo-repository'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { asApiError } from '../../../../utils/service-error'
import { updateReturnPhoto } from '../../../../utils/service/return-photo'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = updateReturnPhotoRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
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
      id.data,
      body.data.expectedVersion,
      body.data.payload,
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

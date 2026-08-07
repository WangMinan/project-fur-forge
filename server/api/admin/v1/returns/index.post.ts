import { randomUUID } from 'node:crypto'
import {
  adminReturnPhotoResponseSchema,
  createReturnPhotoRequestSchema,
} from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { insertReturnPhotoAuditLog } from '../../../../utils/repository/return-photo-repository'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { asApiError } from '../../../../utils/service-error'
import { createReturnPhoto } from '../../../../utils/service/return-photo'

/** 新建返图草稿。图片随后通过归属为该返图的上传会话补齐。 */
export default defineEventHandler(async (event) => {
  const body = createReturnPhotoRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Return photo fields are invalid.',
    )
  }
  try {
    const sqlite = getDatabase().sqlite
    const created = createReturnPhoto(sqlite, body.data)
    insertReturnPhotoAuditLog(sqlite, {
      action: 'RETURN_PHOTO_CREATE',
      actorUserId: event.context.adminSession!.user.id,
      id: randomUUID(),
      result: 'SUCCESS',
      returnPhotoId: created.id,
    }, Date.now())
    setResponseStatus(event, 201)
    return adminReturnPhotoResponseSchema.parse({ data: created })
  }
  catch (error) {
    asApiError(error)
  }
})

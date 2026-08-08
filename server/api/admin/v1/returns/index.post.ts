import { randomUUID } from 'node:crypto'
import {
  adminReturnCharacterResponseSchema,
  createReturnCharacterRequestSchema,
} from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { insertReturnPhotoAuditLog } from '../../../../utils/repository/return-photo-repository'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { asApiError } from '../../../../utils/service-error'
import { createReturnCharacter } from '../../../../utils/service/return-photo'

/** 新建设定。返图图片随后在设定编辑页逐张上传。 */
export default defineEventHandler(async (event) => {
  const body = createReturnCharacterRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      'Return character fields are invalid.',
    )
  }
  try {
    const sqlite = getDatabase().sqlite
    const created = createReturnCharacter(sqlite, body.data)
    insertReturnPhotoAuditLog(sqlite, {
      action: 'RETURN_CHARACTER_CREATE',
      actorUserId: event.context.adminSession!.user.id,
      id: randomUUID(),
      result: 'SUCCESS',
      returnPhotoId: created.id,
    }, Date.now())
    setResponseStatus(event, 201)
    return adminReturnCharacterResponseSchema.parse({ data: created })
  }
  catch (error) {
    asApiError(error)
  }
})

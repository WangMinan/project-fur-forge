import { randomUUID } from 'node:crypto'
import { resourceIdSchema } from '../../../../../shared/schemas/api'
import {
  adminReturnCharacterResponseSchema,
  updateReturnCharacterRequestSchema,
} from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { insertReturnPhotoAuditLog } from '../../../../utils/repository/return-photo-repository'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { asApiError } from '../../../../utils/service-error'
import { updateReturnCharacter } from '../../../../utils/service/return-photo'

export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = updateReturnCharacterRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      body.success
        ? 'Return character id is invalid.'
        : 'Return character fields are invalid.',
    )
  }
  try {
    const sqlite = getDatabase().sqlite
    const updated = updateReturnCharacter(
      sqlite,
      id.data,
      body.data.expectedVersion,
      body.data.payload,
    )
    insertReturnPhotoAuditLog(sqlite, {
      action: 'RETURN_CHARACTER_UPDATE',
      actorUserId: event.context.adminSession!.user.id,
      id: randomUUID(),
      result: 'SUCCESS',
      returnPhotoId: updated.id,
    }, Date.now())
    return adminReturnCharacterResponseSchema.parse({ data: updated })
  }
  catch (error) {
    asApiError(error)
  }
})

import { randomUUID } from 'node:crypto'
import { resourceIdSchema } from '../../../../../shared/schemas/api'
import {
  deleteReturnCharacterRequestSchema,
  deleteReturnCharacterResponseSchema,
} from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { getMediaStorage } from '../../../../utils/media-storage'
import { insertReturnPhotoAuditLog } from '../../../../utils/repository/return-photo-repository'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { asApiError } from '../../../../utils/service-error'
import { deleteReturnCharacterCascade } from '../../../../utils/runner/return-photo-publication'

/**
 * 删除设定，连带删除它的全部返图。
 *
 * 已发布的返图先自动下架并清理公开对象，因此景宸不需要先逐张处理。
 * 阶段 D 不建设回收站，所以这是不可恢复操作；私有永久原图保留。
 */
export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = deleteReturnCharacterRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      body.success
        ? 'Return character id is invalid.'
        : 'Return character delete request is invalid.',
    )
  }
  try {
    const sqlite = getDatabase().sqlite
    const deleted = await deleteReturnCharacterCascade(
      sqlite,
      getMediaStorage(),
      id.data,
      body.data.expectedVersion,
      event.context.adminSession!.user.id,
    )
    insertReturnPhotoAuditLog(sqlite, {
      action: 'RETURN_CHARACTER_DELETE',
      actorUserId: event.context.adminSession!.user.id,
      id: randomUUID(),
      result: 'SUCCESS',
      returnPhotoId: deleted.id,
    }, Date.now())
    return deleteReturnCharacterResponseSchema.parse({ data: deleted })
  }
  catch (error) {
    asApiError(error)
  }
})

import { randomUUID } from 'node:crypto'
import { resourceIdSchema } from '../../../../../shared/schemas/api'
import {
  deleteReturnPhotoRequestSchema,
  deleteReturnPhotoResponseSchema,
} from '../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { insertReturnPhotoAuditLog } from '../../../../utils/repository/return-photo-repository'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { asApiError } from '../../../../utils/service-error'
import { deleteReturnPhotoDraft } from '../../../../utils/service/return-photo'

/**
 * 草稿永久删除。阶段 D 不建设回收站，因此这里是不可恢复操作：
 * 已发布返图必须先下架，公开对象由下架 operation 精确清理。
 * 私有永久原图保留（assets FK 为 restrict 之外的独立生命周期）。
 */
export default defineEventHandler(async (event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = deleteReturnPhotoRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(
      400,
      'VALIDATION_ERROR',
      body.success
        ? 'Return photo id is invalid.'
        : 'Return photo delete request is invalid.',
    )
  }
  try {
    const sqlite = getDatabase().sqlite
    const deleted = deleteReturnPhotoDraft(
      sqlite,
      id.data,
      body.data.expectedVersion,
    )
    insertReturnPhotoAuditLog(sqlite, {
      action: 'RETURN_PHOTO_DELETE',
      actorUserId: event.context.adminSession!.user.id,
      id: randomUUID(),
      result: 'SUCCESS',
      returnPhotoId: deleted.id,
    }, Date.now())
    return deleteReturnPhotoResponseSchema.parse({ data: deleted })
  }
  catch (error) {
    asApiError(error)
  }
})

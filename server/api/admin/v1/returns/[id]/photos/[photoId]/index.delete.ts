import { randomUUID } from 'node:crypto'
import { resourceIdSchema } from '../../../../../../../../shared/schemas/api'
import {
  deleteReturnPhotoRequestSchema,
  deleteReturnPhotoResponseSchema,
} from '../../../../../../../../shared/schemas/return-photo'
import { createApiError } from '../../../../../../../utils/api-error'
import { getDatabase } from '../../../../../../../utils/database'
import { insertReturnPhotoAuditLog } from '../../../../../../../utils/repository/return-photo-repository'
import { readAdminJsonBody } from '../../../../../../../utils/route/request-body'
import { asApiError } from '../../../../../../../utils/service-error'
import { deleteReturnPhotoDraft } from '../../../../../../../utils/service/return-photo'

/**
 * 删除单张返图。阶段 D 不建设回收站，因此这里不可恢复：
 * 已发布返图必须先下架，公开对象由下架 operation 精确清理。
 * 私有永久原图保留。删掉主图时设定里下一张有图的返图自动补位。
 */
export default defineEventHandler(async (event) => {
  const photoId = resourceIdSchema.safeParse(getRouterParam(event, 'photoId'))
  const body = deleteReturnPhotoRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!photoId.success || !body.success) {
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
      photoId.data,
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

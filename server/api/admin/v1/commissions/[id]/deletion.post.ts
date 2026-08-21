import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import {
  commissionDeletionRequestSchema,
  commissionDeletionResponseSchema,
} from '../../../../../../shared/schemas/commission'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { getExactObjectStore } from '../../../../../utils/exact-object-storage'
import { adminSessionFor } from '../../../../../utils/route/auth-session'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import {
  executeCommissionDeletion,
  previewCommissionDeletion,
} from '../../../../../utils/service/commission-retention'
import { asApiError } from '../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = commissionDeletionRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  const objectStore = getExactObjectStore()
  try {
    const data = body.data.execute
      ? await executeCommissionDeletion({
          actorUserId: adminSessionFor(event).user.id,
          identifier: id.data,
          objectStore,
          sqlite: getDatabase().sqlite,
        })
      : await previewCommissionDeletion({
          identifier: id.data,
          objectStore,
          sqlite: getDatabase().sqlite,
        })
    return commissionDeletionResponseSchema.parse({ data })
  }
  catch (error) {
    asApiError(error)
  }
})

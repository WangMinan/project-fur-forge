import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import {
  updateCommissionSubmissionRequestSchema,
  updateCommissionSubmissionResponseSchema,
} from '../../../../../../shared/schemas/commission'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { adminSessionFor } from '../../../../../utils/route/auth-session'
import { readAdminJsonBody } from '../../../../../utils/route/request-body'
import { updateCommissionSubmission } from '../../../../../utils/service/commission-management'
import { asApiError } from '../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  const body = updateCommissionSubmissionRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!id.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Request is invalid.')
  }
  try {
    return updateCommissionSubmissionResponseSchema.parse({
      data: updateCommissionSubmission(
        getDatabase().sqlite,
        id.data,
        body.data.expectedVersion,
        {
          actorUserId: adminSessionFor(event).user.id,
          internalNote: body.data.payload.internalNote,
          status: body.data.payload.status,
        },
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

import { commissionConflictsResponseSchema } from '../../../../../shared/schemas/manual-commission'
import { getDatabase } from '../../../../utils/database'
import { adminSessionFor } from '../../../../utils/route/auth-session'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { manualCommissionConflicts } from '../../../../utils/service/manual-commission'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    return commissionConflictsResponseSchema.parse({ data: manualCommissionConflicts(getDatabase().sqlite,
      adminSessionFor(event).user.id, await readAdminJsonBody(event)) })
  }
  catch (error) { asSafeApiError(error) }
})

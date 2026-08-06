import {
  adminSiteContentResponseSchema,
  siteBusinessStatusKindSchema,
  updateSiteBusinessStatusRequestSchema,
} from '../../../../../../../shared/schemas/site-content'
import { createApiError } from '../../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../../utils/route/auth-session'
import { getDatabase } from '../../../../../../utils/database'
import { readAdminJsonBody } from '../../../../../../utils/route/request-body'
import { updateSiteBusinessStatus } from '../../../../../../utils/service/site-content'
import { asSafeApiError } from '../../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const kind = siteBusinessStatusKindSchema.safeParse(
    getRouterParam(event, 'kind'),
  )
  const body = updateSiteBusinessStatusRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!kind.success || !body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Business status is invalid.')
  }
  try {
    return adminSiteContentResponseSchema.parse({
      data: updateSiteBusinessStatus(
        getDatabase().sqlite,
        kind.data,
        body.data.expectedVersion,
        body.data.payload,
        adminSessionFor(event).user.id,
      ),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

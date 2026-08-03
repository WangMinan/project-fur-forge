import {
  adminSiteContentResponseSchema,
  updateSiteContentRequestSchema,
} from '../../../../../../shared/schemas/site-content'
import { createApiError } from '../../../../../utils/api-error'
import { adminSessionFor } from '../../../../../utils/auth-session'
import { getDatabase } from '../../../../../utils/database'
import { readAdminJsonBody } from '../../../../../utils/request-body'
import { updateSiteContent } from '../../../../../utils/site-content'
import { asSafeApiError } from '../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const body = updateSiteContentRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Site content is invalid.')
  }
  try {
    return adminSiteContentResponseSchema.parse({
      data: updateSiteContent(
        getDatabase().sqlite,
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

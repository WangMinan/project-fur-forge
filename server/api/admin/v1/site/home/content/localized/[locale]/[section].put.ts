import { adminSiteCopyResponseSchema, siteCopyLocaleSchema, siteCopySectionSchema, updateSiteCopyRequestSchema } from '../../../../../../../../../shared/schemas/site-copy'
import { saveSiteCopy } from '../../../../../../../../utils/service/site-copy'
import { getDatabase } from '../../../../../../../../utils/database'
import { createApiError } from '../../../../../../../../utils/api-error'
import { readAdminJsonBody } from '../../../../../../../../utils/route/request-body'
import { adminSessionFor } from '../../../../../../../../utils/route/auth-session'
import { asSafeApiError } from '../../../../../../../../utils/service-error'

export default defineEventHandler(async (event) => {
  const locale = siteCopyLocaleSchema.safeParse(getRouterParam(event, 'locale'))
  const section = siteCopySectionSchema.safeParse(getRouterParam(event, 'section'))
  const body = updateSiteCopyRequestSchema.safeParse(await readAdminJsonBody(event))
  if (!locale.success || !section.success || !body.success) throw createApiError(400, 'VALIDATION_ERROR', 'Site copy is invalid.')
  try {
    return adminSiteCopyResponseSchema.parse({ data: saveSiteCopy(getDatabase().sqlite, locale.data, section.data,
      body.data.expectedVersion, body.data.payload, adminSessionFor(event).user.id) })
  }
  catch (error) { asSafeApiError(error) }
})

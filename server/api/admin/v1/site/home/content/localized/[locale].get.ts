import { adminSiteCopyResponseSchema, siteCopyLocaleSchema } from '../../../../../../../../shared/schemas/site-copy'
import { getAdminSiteCopy } from '../../../../../../../utils/repository/site-copy-repository'
import { getDatabase } from '../../../../../../../utils/database'
import { createApiError } from '../../../../../../../utils/api-error'

export default defineEventHandler((event) => {
  const locale = siteCopyLocaleSchema.safeParse(getRouterParam(event, 'locale'))
  if (!locale.success) throw createApiError(400, 'VALIDATION_ERROR', 'Unsupported language.')
  return adminSiteCopyResponseSchema.parse({ data: getAdminSiteCopy(getDatabase().sqlite, locale.data) })
})

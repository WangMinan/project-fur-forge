import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { publicSafeWorkPreviewResponseSchema } from '../../../../../../shared/schemas/work'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { asApiError } from '../../../../../utils/service-error'
import { getPublicSafeWorkPreview } from '../../../../../utils/work-management'

export default defineEventHandler((event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(404, 'NOT_FOUND', 'Work was not found.')
  }
  try {
    return publicSafeWorkPreviewResponseSchema.parse({
      data: getPublicSafeWorkPreview(getDatabase().sqlite, id.data),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

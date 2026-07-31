import { resourceIdSchema } from '../../../../../../shared/schemas/api'
import { workPublicationCheckResponseSchema } from '../../../../../../shared/schemas/publication'
import { createApiError } from '../../../../../utils/api-error'
import { getDatabase } from '../../../../../utils/database'
import { asApiError } from '../../../../../utils/service-error'
import { checkWorkPublication } from '../../../../../utils/work-publication'

export default defineEventHandler((event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(404, 'NOT_FOUND', 'Work was not found.')
  }
  try {
    return workPublicationCheckResponseSchema.parse({
      data: checkWorkPublication(getDatabase().sqlite, id.data),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

import { resourceIdSchema } from '../../../../../shared/schemas/api'
import { publicationOperationResponseSchema } from '../../../../../shared/schemas/publication'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { asApiError } from '../../../../utils/service-error'
import { getPublicationOperation } from '../../../../utils/work-publication'

export default defineEventHandler((event) => {
  const id = resourceIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!id.success) {
    throw createApiError(404, 'NOT_FOUND', 'Publication operation was not found.')
  }
  try {
    return publicationOperationResponseSchema.parse({
      data: getPublicationOperation(getDatabase().sqlite, id.data),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

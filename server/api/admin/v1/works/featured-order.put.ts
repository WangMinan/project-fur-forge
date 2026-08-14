import {
  featuredWorkOrderRequestSchema,
  featuredWorkOrderResponseSchema,
} from '../../../../../shared/schemas/work'
import { createApiError } from '../../../../utils/api-error'
import { getDatabase } from '../../../../utils/database'
import { readAdminJsonBody } from '../../../../utils/route/request-body'
import { asApiError } from '../../../../utils/service-error'
import { saveFeaturedManagedWorkOrder } from '../../../../utils/service/work-management'

export default defineEventHandler(async (event) => {
  const body = featuredWorkOrderRequestSchema.safeParse(
    await readAdminJsonBody(event),
  )
  if (!body.success) {
    throw createApiError(400, 'VALIDATION_ERROR', 'Featured work order is invalid.')
  }

  try {
    return featuredWorkOrderResponseSchema.parse({
      data: saveFeaturedManagedWorkOrder(
        getDatabase().sqlite,
        body.data.payload.items,
      ),
    })
  }
  catch (error) {
    asApiError(error)
  }
})

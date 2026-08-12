import { publicUpdateListResponseSchema } from '../../../../../shared/schemas/update'
import { getDatabase } from '../../../../utils/database'
import { listPublishedUpdates } from '../../../../utils/repository/public-update-repository'
import { asSafeApiError } from '../../../../utils/service-error'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    return publicUpdateListResponseSchema.parse({
      data: listPublishedUpdates(getDatabase().sqlite),
    })
  }
  catch (error) {
    asSafeApiError(error)
  }
})

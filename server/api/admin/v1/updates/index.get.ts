import { adminUpdateListResponseSchema } from '../../../../../shared/schemas/update'
import { getDatabase } from '../../../../utils/database'
import { listAdminUpdates } from '../../../../utils/service/update'

export default defineEventHandler(() => {
  return adminUpdateListResponseSchema.parse({
    data: listAdminUpdates(getDatabase().sqlite),
  })
})

import { featuredWorkOrderResponseSchema } from '../../../../../shared/schemas/work'
import { getDatabase } from '../../../../utils/database'
import { listFeaturedManagedWorks } from '../../../../utils/service/work-management'

export default defineEventHandler(() => featuredWorkOrderResponseSchema.parse({
  data: listFeaturedManagedWorks(getDatabase().sqlite),
}))

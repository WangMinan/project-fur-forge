import { workListResponseSchema } from '../../../../../shared/schemas/work'
import { getDatabase } from '../../../../utils/database'
import { listManagedWorks } from '../../../../utils/service/work-management'

export default defineEventHandler(() => workListResponseSchema.parse({
  data: listManagedWorks(getDatabase().sqlite),
}))

import { adoptionStatusReviewResponseSchema } from '../../../../../shared/schemas/work'
import { getDatabase } from '../../../../utils/database'
import { listAmbiguousAdoptionStatusReviews } from '../../../../utils/service/work-management'

export default defineEventHandler(() => adoptionStatusReviewResponseSchema.parse({
  data: listAmbiguousAdoptionStatusReviews(getDatabase().sqlite),
}))

import { commissionRetentionListResponseSchema } from '../../../../../shared/schemas/commission'
import { getDatabase } from '../../../../utils/database'
import { listCommissionRetentionCandidates } from '../../../../utils/service/commission-retention'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  return commissionRetentionListResponseSchema.parse({
    data: listCommissionRetentionCandidates(getDatabase().sqlite),
  })
})

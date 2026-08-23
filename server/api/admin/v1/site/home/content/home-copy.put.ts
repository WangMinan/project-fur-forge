import { updateHomeCopyContentRequestSchema } from '../../../../../../../shared/schemas/site-content'
import { defineSiteContentSectionHandler } from '../../../../../../utils/route/site-content-route'

export default defineEventHandler(defineSiteContentSectionHandler({
  requestSchema: updateHomeCopyContentRequestSchema,
  section: 'home-copy',
  toValues: payload => ({
    featuredLead: payload.featuredLead,
    commissionLead: payload.commissionLead,
    adoptionLead: payload.adoptionLead,
  }),
}))

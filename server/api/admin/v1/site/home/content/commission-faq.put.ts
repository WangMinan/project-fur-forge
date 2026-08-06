import { updateCommissionFaqRequestSchema } from '../../../../../../../shared/schemas/site-content'
import { defineSiteContentSectionHandler } from '../../../../../../utils/route/site-content-route'

export default defineEventHandler(defineSiteContentSectionHandler({
  requestSchema: updateCommissionFaqRequestSchema,
  section: 'commission-faq',
  toValues: payload => ({ faqJson: JSON.stringify(payload.faqs) }),
}))

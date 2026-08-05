import { updateTermsContentRequestSchema } from '../../../../../../../shared/schemas/site-content'
import { defineSiteContentSectionHandler } from '../../../../../../utils/site-content-route'

export default defineEventHandler(defineSiteContentSectionHandler({
  requestSchema: updateTermsContentRequestSchema,
  section: 'terms',
  toValues: payload => ({ basicTerms: payload.basicTerms }),
}))

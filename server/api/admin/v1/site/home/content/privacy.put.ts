import { updatePrivacyContentRequestSchema } from '../../../../../../../shared/schemas/site-content'
import { defineSiteContentSectionHandler } from '../../../../../../utils/site-content-route'

export default defineEventHandler(defineSiteContentSectionHandler({
  requestSchema: updatePrivacyContentRequestSchema,
  section: 'privacy',
  toValues: payload => ({ privacyPolicy: payload.privacyPolicy }),
}))

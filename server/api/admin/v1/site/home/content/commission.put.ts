import { updateCommissionContentRequestSchema } from '../../../../../../../shared/schemas/site-content'
import { defineSiteContentSectionHandler } from '../../../../../../utils/route/site-content-route'

export default defineEventHandler(defineSiteContentSectionHandler({
  requestSchema: updateCommissionContentRequestSchema,
  section: 'commission',
  toValues: payload => ({
    intro: payload.intro,
    estimateNote: payload.estimateNote,
    emailAction: payload.emailAction,
  }),
}))

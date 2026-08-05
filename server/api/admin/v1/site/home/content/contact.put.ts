import { updateContactContentRequestSchema } from '../../../../../../../shared/schemas/site-content'
import { defineSiteContentSectionHandler } from '../../../../../../utils/site-content-route'

export default defineEventHandler(defineSiteContentSectionHandler({
  requestSchema: updateContactContentRequestSchema,
  section: 'contact',
  toValues: payload => ({
    douyin: payload.douyin,
    antiScam: payload.antiScam,
  }),
}))

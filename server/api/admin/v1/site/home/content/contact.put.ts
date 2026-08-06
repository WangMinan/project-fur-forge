import { updateContactContentRequestSchema } from '../../../../../../../shared/schemas/site-content'
import { defineSiteContentSectionHandler } from '../../../../../../utils/route/site-content-route'

export default defineEventHandler(defineSiteContentSectionHandler({
  requestSchema: updateContactContentRequestSchema,
  section: 'contact',
  toValues: payload => ({
    email: payload.email,
    qq: payload.qq,
    douyin: payload.douyin,
    antiScam: payload.antiScam,
  }),
}))

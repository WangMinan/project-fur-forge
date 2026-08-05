import { updateAboutContentRequestSchema } from '../../../../../../../shared/schemas/site-content'
import { defineSiteContentSectionHandler } from '../../../../../../utils/site-content-route'

export default defineEventHandler(defineSiteContentSectionHandler({
  requestSchema: updateAboutContentRequestSchema,
  section: 'about',
  toValues: payload => ({
    studioFacts: payload.studioFacts,
    makingScope: payload.makingScope,
  }),
}))

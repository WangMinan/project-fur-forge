import { updateContactContentRequestSchema } from '../../../../../../../shared/schemas/site-content'
import { getDatabase } from '../../../../../../utils/database'
import { resolveContactQrLink } from '../../../../../../utils/recipe/contact-qr-link'
import { getAdminSiteContent } from '../../../../../../utils/service/site-content'
import { defineSiteContentSectionHandler } from '../../../../../../utils/route/site-content-route'

export default defineEventHandler(defineSiteContentSectionHandler({
  requestSchema: updateContactContentRequestSchema,
  section: 'contact',
  toValues: async (payload) => {
    const sqlite = getDatabase().sqlite
    const existing = getAdminSiteContent(sqlite).contact.officialChannels
    const channels = await Promise.all(payload.officialChannels.map(async channel => ({
      ...channel,
      qrLinkUrl: await resolveContactQrLink(
        sqlite,
        channel,
        existing.find(item => item.platform === channel.platform),
      ),
    })))
    return {
      email: payload.email,
      officialChannelsJson: JSON.stringify(channels),
      antiScam: payload.antiScam,
    }
  },
}))

import { updateContactContentRequestSchema } from '../../../../../../../shared/schemas/site-content'
import { getDatabase } from '../../../../../../utils/database'
import { resolveContactQrLink } from '../../../../../../utils/recipe/contact-qr-link'
import { getAdminSiteContent } from '../../../../../../utils/service/site-content'
import { defineSiteContentSectionHandler } from '../../../../../../utils/route/site-content-route'

export default defineEventHandler(defineSiteContentSectionHandler({
  requestSchema: updateContactContentRequestSchema,
  section: 'contact',
  /**
   * 保存时解出二维码里的官方跳转链接并一起入库：
   * QQ 短链 token 不可从账号推导，只能来自二维码本身；放在保存时做一次，
   * 公开请求便只读结果，不必每次解码。
   */
  toValues: async (payload) => {
    const sqlite = getDatabase().sqlite
    const existing = getAdminSiteContent(sqlite).contact.officialChannels
    const channels = await Promise.all(
      payload.officialChannels.map(async channel => ({
        ...channel,
        qrLinkUrl: await resolveContactQrLink(
          sqlite,
          channel,
          existing.find(item => item.platform === channel.platform),
        ),
      })),
    )
    return {
      email: payload.email,
      officialChannelsJson: JSON.stringify(channels),
      antiScam: payload.antiScam,
    }
  },
}))

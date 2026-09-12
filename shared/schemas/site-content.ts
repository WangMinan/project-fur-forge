import { xContactUrlSchema } from './contact-url'
import { plainTextSchema, publicSiteCopySchema, siteCopySchemas } from './site-copy'
import { z } from 'zod'
import { commissionRecipientsSchema, smtpStatusSchema } from './commission-email'
import { CONTACT_PLATFORMS } from '../constants/contact'
import { apiSuccessSchema, resourceVersionSchema, versionedRequestSchema } from './api'
import { contactEmailSchema, contactQqSchema } from './home'
import { publicPngSourceSetDtoSchema } from './media'

export const siteBusinessStatusKindSchema = z.enum([
  'commission',
])
export const siteBusinessStatusToneSchema = z.enum([
  'open',
  'closed',
])
const siteBusinessStatusFields = {
  kind: siteBusinessStatusKindSchema,
  tone: siteBusinessStatusToneSchema,
  label: plainTextSchema(40),
  href: z.literal('/commission'),
}

export const adminSiteBusinessStatusDtoSchema = z.object({
  ...siteBusinessStatusFields,
  version: resourceVersionSchema,
}).strict()

export const publicSiteBusinessStatusDtoSchema = z.object(
  siteBusinessStatusFields,
).strict()

/** 委托基础文案。需求3阶段 E 已永久退役 FAQ 契约。 */
export const commissionBasicContentSchema = siteCopySchemas.commission

/** 关于工作室与制作范围。 */
export const aboutBasicContentSchema = siteCopySchemas.about

export const termsContentSchema = z.object({
  basicTerms: plainTextSchema(8_000).nullable(),
}).strict()

export const privacyContentSchema = z.object({
  privacyPolicy: plainTextSchema(8_000).nullable(),
}).strict()

const aboutContentSchema = aboutBasicContentSchema
  .extend(termsContentSchema.shape)
  .extend(privacyContentSchema.shape)
  .strict()

export const contactPlatformSchema = z.enum(CONTACT_PLATFORMS)
export const contactQrLinkSchema = z.string()
  .regex(/^https:\/\/qm\.qq\.com\/q\/[A-Za-z0-9]{4,64}$/u)

export const adminOfficialChannelSchema = z.object({
  platform: contactPlatformSchema,
  account: plainTextSchema(120).nullable(),
  qrCodeAssetId: z.string().uuid().nullable(),
  /** 服务端从已上传二维码中解出的 QQ 官方短链；客户端不负责填写。 */
  qrLinkUrl: contactQrLinkSchema.nullable().default(null),
}).strict()

function isValidOfficialChannelAccount(
  account: string | null,
) {
  if (account === null) {
    return true
  }
  return contactQqSchema.safeParse(account).success
}

function validateOfficialChannels(
  channels: { platform: typeof CONTACT_PLATFORMS[number], account: string | null }[],
  context: z.RefinementCtx,
) {
  channels.forEach((channel, index) => {
    if (channel.platform !== CONTACT_PLATFORMS[index]) {
      context.addIssue({
        code: 'custom',
        message: '官方渠道必须按固定平台顺序提交',
        path: [index, 'platform'],
      })
    }
    if (!isValidOfficialChannelAccount(channel.account)) {
      context.addIssue({
        code: 'custom',
        message: '平台账号格式不正确',
        path: [index, 'account'],
      })
    }
  })
}

export const adminOfficialChannelsSchema = z.array(adminOfficialChannelSchema)
  .length(CONTACT_PLATFORMS.length)
  .superRefine(validateOfficialChannels)

const mutableOfficialChannelSchema = adminOfficialChannelSchema
  .omit({ qrLinkUrl: true })
  .strict()

const mutableOfficialChannelsSchema = z.array(mutableOfficialChannelSchema)
  .length(CONTACT_PLATFORMS.length)
  .superRefine(validateOfficialChannels)

export const publicOfficialChannelSchema = adminOfficialChannelSchema
  .omit({ qrCodeAssetId: true })
  .extend({
    account: plainTextSchema(120),
    qrCodeSources: publicPngSourceSetDtoSchema,
  })
  .strict()

export const publicOfficialChannelsSchema = z.array(publicOfficialChannelSchema)
  .max(CONTACT_PLATFORMS.length)
  .superRefine((channels, context) => {
    let previous = -1
    channels.forEach((channel, index) => {
      const order = CONTACT_PLATFORMS.indexOf(channel.platform)
      if (order <= previous) {
        context.addIssue({
          code: 'custom',
          message: '公开渠道不得重复且必须保持固定顺序',
          path: [index, 'platform'],
        })
      }
      previous = order
      if (!isValidOfficialChannelAccount(channel.account)) {
        context.addIssue({
          code: 'custom',
          message: '平台账号格式不正确',
          path: [index, 'account'],
        })
      }
    })
  })

/** 邮箱、QQ 和 QQ群共用 contact 分区版本。 */
const adminContactContentSchema = z.object({
  xContactUrl: xContactUrlSchema,
  commissionNotificationRecipients: commissionRecipientsSchema,
  smtpStatus: smtpStatusSchema,
  email: contactEmailSchema,
  officialChannels: adminOfficialChannelsSchema,
}).strict()

const mutableContactContentSchema = z.object({
  xContactUrl: xContactUrlSchema.optional(),
  commissionNotificationRecipients: commissionRecipientsSchema.optional(),
  email: contactEmailSchema,
  officialChannels: mutableOfficialChannelsSchema,
}).strict()

const publicContactContentSchema = z.object({
  xContactUrl: xContactUrlSchema,
  email: contactEmailSchema,
  officialChannels: publicOfficialChannelsSchema,
}).strict()

const statusPairSchema = <T extends z.ZodType>(status: T) => z.object({
  commission: status.nullable(),
}).strict()

export const updateSiteBusinessStatusRequestSchema = versionedRequestSchema(
  z.object({
    tone: siteBusinessStatusToneSchema,
    label: plainTextSchema(40),
  }).strict(),
)

/** 五个文案分区各自的乐观并发版本。 */
export const siteContentSectionVersionsSchema = z.object({
  commission: resourceVersionSchema,
  about: resourceVersionSchema,
  terms: resourceVersionSchema,
  privacy: resourceVersionSchema,
  contact: resourceVersionSchema,
}).strict()

export const adminSiteContentDtoSchema = z.object({
  version: resourceVersionSchema,
  sectionVersions: siteContentSectionVersionsSchema,
  statuses: statusPairSchema(adminSiteBusinessStatusDtoSchema),
  commission: commissionBasicContentSchema,
  about: aboutContentSchema,
  contact: adminContactContentSchema,
}).strict()

export const updateCommissionContentRequestSchema = versionedRequestSchema(
  commissionBasicContentSchema,
)
export const updateAboutContentRequestSchema = versionedRequestSchema(
  aboutBasicContentSchema,
)
export const updateTermsContentRequestSchema = versionedRequestSchema(
  termsContentSchema,
)
export const updatePrivacyContentRequestSchema = versionedRequestSchema(
  privacyContentSchema,
)
export const updateContactContentRequestSchema = versionedRequestSchema(
  mutableContactContentSchema,
)

export const publicSiteContentDtoSchema = z.object({
  copy: publicSiteCopySchema.default({}),
  statuses: statusPairSchema(publicSiteBusinessStatusDtoSchema),
  commission: commissionBasicContentSchema.extend({
    email: contactEmailSchema,
    termsHref: z.literal('/service'),
  }).strict(),
  about: aboutContentSchema.extend({
    officialChannels: publicOfficialChannelsSchema,
  }).strict(),
  contact: publicContactContentSchema,
}).strict()

export const adminSiteContentResponseSchema = apiSuccessSchema(
  adminSiteContentDtoSchema,
)
export const publicSiteContentResponseSchema = apiSuccessSchema(
  publicSiteContentDtoSchema,
)

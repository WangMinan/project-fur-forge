import { z } from 'zod'
import { CONTACT_PLATFORMS } from '../constants/contact'
import { apiSuccessSchema, resourceVersionSchema, versionedRequestSchema } from './api'
import { contactEmailSchema, contactQqSchema } from './home'
import { publicPngSourceSetDtoSchema } from './media'

const unsafePlainTextPattern = /[<>]|\b(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/iu

function plainTextSchema(max: number) {
  return z.string().trim().min(1).max(max).refine(
    value => !unsafePlainTextPattern.test(value),
    '只允许安全纯文本',
  )
}

/**
 * R4-E：领养营业状态已退役，只保留委托；开放程度只有开放与不开放两档。
 * 领养是否可领取由每个作品自己的 adoptionStatus 表达。
 */
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
  detail: plainTextSchema(240),
  href: z.enum(['/commission']),
}

export const adminSiteBusinessStatusDtoSchema = z.object({
  ...siteBusinessStatusFields,
  version: resourceVersionSchema,
}).strict()

export const publicSiteBusinessStatusDtoSchema = z.object(
  siteBusinessStatusFields,
).strict()

/** 委托基础文案。需求3阶段 E 已永久退役 FAQ 契约。 */
export const commissionBasicContentSchema = z.object({
  intro: plainTextSchema(240).nullable(),
  estimateNote: plainTextSchema(600).nullable(),
  emailAction: plainTextSchema(240).nullable(),
}).strict()

/** 关于工作室与制作范围。 */
export const aboutBasicContentSchema = z.object({
  studioFacts: plainTextSchema(1_200).nullable(),
  makingScope: plainTextSchema(1_200).nullable(),
}).strict()

/**
 * R4-E 首页 2-4 幕文字块导语。
 * 章节标题、英文 eyebrow 与按钮文字是业务语义/视觉元素，写死在组件中不入库。
 */
export const homeCopyContentSchema = z.object({
  featuredLead: plainTextSchema(120).nullable(),
  commissionLead: plainTextSchema(120).nullable(),
  adoptionLead: plainTextSchema(120).nullable(),
}).strict()

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

export const adminOfficialChannelSchema = z.object({
  platform: contactPlatformSchema,
  account: plainTextSchema(120).nullable(),
  qrCodeAssetId: z.string().uuid().nullable(),
  /**
   * 二维码里编码的官方跳转链接，由服务端在保存时解码得出，客户端不提交。
   * QQ 短链 token 不可从账号推导，因此只能来自二维码本身。
   */
  qrLinkUrl: z.string().url().nullable().default(null),
}).strict()

/** 只校验账号本身，因此不绑定整个渠道对象的形状。 */
function isValidOfficialChannelAccount(account: string | null) {
  if (account === null) {
    return true
  }
  return contactQqSchema.safeParse(account).success
}

export const adminOfficialChannelsSchema = z.array(adminOfficialChannelSchema)
  .length(CONTACT_PLATFORMS.length)
  .superRefine((channels, context) => {
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
  })

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

/** 需求3阶段 A：邮箱、QQ、QQ群和防诈骗提醒共用 contact 分区版本。 */
const mutableContactContentSchema = z.object({
  email: contactEmailSchema,
  officialChannels: adminOfficialChannelsSchema,
  antiScam: plainTextSchema(600).nullable(),
}).strict()

const publicContactContentSchema = z.object({
  email: contactEmailSchema,
  officialChannels: publicOfficialChannelsSchema,
  antiScam: plainTextSchema(600).nullable(),
}).strict()

/** R4-E：领养状态退役后只剩委托一档，但仍保留对象形状以免调用方全面改写。 */
const statusPairSchema = <T extends z.ZodType>(status: T) => z.object({
  commission: status.nullable(),
}).strict()

export const updateSiteBusinessStatusRequestSchema = versionedRequestSchema(
  z.object({
    tone: siteBusinessStatusToneSchema,
    label: plainTextSchema(40),
    detail: plainTextSchema(240),
  }).strict(),
)

/** 六个文案分区各自的乐观并发版本。 */
export const siteContentSectionVersionsSchema = z.object({
  commission: resourceVersionSchema,
  about: resourceVersionSchema,
  terms: resourceVersionSchema,
  privacy: resourceVersionSchema,
  contact: resourceVersionSchema,
  homeCopy: resourceVersionSchema,
}).strict()

export const SITE_CONTENT_SECTIONS = [
  'commission',
  'about',
  'terms',
  'privacy',
  'contact',
  'home-copy',
] as const

export const siteContentSectionSchema = z.enum(SITE_CONTENT_SECTIONS)

export const adminSiteContentDtoSchema = z.object({
  version: resourceVersionSchema,
  sectionVersions: siteContentSectionVersionsSchema,
  statuses: statusPairSchema(adminSiteBusinessStatusDtoSchema),
  commission: commissionBasicContentSchema,
  about: aboutContentSchema,
  contact: mutableContactContentSchema,
  homeCopy: homeCopyContentSchema,
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
export const updateHomeCopyContentRequestSchema = versionedRequestSchema(
  homeCopyContentSchema,
)

export const publicSiteContentDtoSchema = z.object({
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

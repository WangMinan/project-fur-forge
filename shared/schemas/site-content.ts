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

export const siteBusinessStatusKindSchema = z.enum([
  'commission',
  'adoption',
])
export const siteBusinessStatusToneSchema = z.enum([
  'open',
  'limited',
  'closed',
])
export const contactDouyinSchema = z.string().trim()
  .min(2)
  .max(30)
  .regex(/^[\p{L}\p{N}._-]+$/u)

/**
 * T34-F3：FAQ 项拥有稳定 ID，排序与身份分离。
 * 前端 key 用该 ID，不再用数组下标，新增/删除/重排不会复用错误组件状态。
 */
export const commissionFaqSchema = z.object({
  id: z.string().uuid(),
  question: plainTextSchema(120),
  answer: plainTextSchema(1_000),
}).strict()

export const commissionFaqListSchema = z.array(commissionFaqSchema)
  .max(8)
  .superRefine((items, context) => {
    const questions = new Set<string>()
    const ids = new Set<string>()
    for (const [index, item] of items.entries()) {
      if (questions.has(item.question)) {
        context.addIssue({
          code: 'custom',
          message: 'FAQ 问题不得重复',
          path: [index, 'question'],
        })
      }
      questions.add(item.question)
      if (ids.has(item.id)) {
        context.addIssue({
          code: 'custom',
          message: 'FAQ 标识不得重复',
          path: [index, 'id'],
        })
      }
      ids.add(item.id)
    }
  })

const siteBusinessStatusFields = {
  kind: siteBusinessStatusKindSchema,
  tone: siteBusinessStatusToneSchema,
  label: plainTextSchema(40),
  detail: plainTextSchema(240),
  href: z.enum(['/commission', '/adoptions']),
}

export const adminSiteBusinessStatusDtoSchema = z.object({
  ...siteBusinessStatusFields,
  version: resourceVersionSchema,
}).strict()

export const publicSiteBusinessStatusDtoSchema = z.object(
  siteBusinessStatusFields,
).strict()

/** 委托基础文案（不含 FAQ，FAQ 为独立并发分区）。 */
export const commissionBasicContentSchema = z.object({
  intro: plainTextSchema(240).nullable(),
  estimateNote: plainTextSchema(600).nullable(),
  emailAction: plainTextSchema(240).nullable(),
}).strict()

const commissionContentSchema = commissionBasicContentSchema.extend({
  faqs: commissionFaqListSchema,
}).strict()

/** 关于工作室与制作范围。 */
export const aboutBasicContentSchema = z.object({
  studioFacts: plainTextSchema(1_200).nullable(),
  makingScope: plainTextSchema(1_200).nullable(),
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
}).strict()

function isValidOfficialChannelAccount(
  channel: z.infer<typeof adminOfficialChannelSchema>,
) {
  if (channel.account === null) {
    return true
  }
  const schema = channel.platform === 'douyin'
    ? contactDouyinSchema
    : channel.platform === 'qq' || channel.platform === 'qq_group'
      ? contactQqSchema
      : null
  return schema === null || schema.safeParse(channel.account).success
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
      if (!isValidOfficialChannelAccount(channel)) {
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
      if (!isValidOfficialChannelAccount({
        platform: channel.platform,
        account: channel.account,
        qrCodeAssetId: null,
      })) {
        context.addIssue({
          code: 'custom',
          message: '平台账号格式不正确',
          path: [index, 'account'],
        })
      }
    })
  })

/** T02：邮箱、五个平台和防诈骗提醒共用 contact 分区版本。 */
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

const statusPairSchema = <T extends z.ZodType>(status: T) => z.object({
  commission: status.nullable(),
  adoption: status.nullable(),
}).strict()

export const updateSiteBusinessStatusRequestSchema = versionedRequestSchema(
  z.object({
    tone: siteBusinessStatusToneSchema,
    label: plainTextSchema(40),
    detail: plainTextSchema(240),
  }).strict(),
)

/** T34-F3：六个文案分区各自的乐观并发版本。 */
export const siteContentSectionVersionsSchema = z.object({
  commission: resourceVersionSchema,
  commissionFaq: resourceVersionSchema,
  about: resourceVersionSchema,
  terms: resourceVersionSchema,
  privacy: resourceVersionSchema,
  contact: resourceVersionSchema,
}).strict()

export const SITE_CONTENT_SECTIONS = [
  'commission',
  'commission-faq',
  'about',
  'terms',
  'privacy',
  'contact',
] as const

export const siteContentSectionSchema = z.enum(SITE_CONTENT_SECTIONS)

export const adminSiteContentDtoSchema = z.object({
  version: resourceVersionSchema,
  sectionVersions: siteContentSectionVersionsSchema,
  statuses: statusPairSchema(adminSiteBusinessStatusDtoSchema),
  commission: commissionContentSchema,
  about: aboutContentSchema,
  contact: mutableContactContentSchema,
}).strict()

export const updateCommissionContentRequestSchema = versionedRequestSchema(
  commissionBasicContentSchema,
)
export const updateCommissionFaqRequestSchema = versionedRequestSchema(
  z.object({ faqs: commissionFaqListSchema }).strict(),
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
  statuses: statusPairSchema(publicSiteBusinessStatusDtoSchema),
  commission: commissionContentSchema.extend({
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

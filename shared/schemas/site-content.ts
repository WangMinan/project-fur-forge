import { z } from 'zod'
import { apiSuccessSchema, resourceVersionSchema, versionedRequestSchema } from './api'
import { contactEmailSchema, contactQqSchema } from './home'

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

/**
 * T34-F3：官方渠道是一个整体。邮箱、QQ、抖音号和防诈骗提醒都在
 * contact 分区里编辑，使用 contact 分区版本；首屏设置不再重复提供入口。
 */
const mutableContactContentSchema = z.object({
  email: contactEmailSchema,
  qq: contactQqSchema,
  douyin: contactDouyinSchema.nullable(),
  antiScam: plainTextSchema(600).nullable(),
}).strict()

const publicContactContentSchema = mutableContactContentSchema

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
  contact: publicContactContentSchema,
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
    officialChannels: publicContactContentSchema.omit({ antiScam: true }),
  }).strict(),
  contact: publicContactContentSchema,
}).strict()

export const adminSiteContentResponseSchema = apiSuccessSchema(
  adminSiteContentDtoSchema,
)
export const publicSiteContentResponseSchema = apiSuccessSchema(
  publicSiteContentDtoSchema,
)

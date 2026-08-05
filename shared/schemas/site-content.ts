import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import { contactEmailSchema, contactQqSchema } from './contact'

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
export const siteContentSectionSchema = z.enum([
  'commission',
  'faq',
  'about',
  'terms',
  'privacy',
  'contact',
])
export const contactDouyinSchema = z.string().trim()
  .min(2)
  .max(30)
  .regex(/^[\p{L}\p{N}._-]+$/u)

export const commissionFaqSchema = z.object({
  question: plainTextSchema(120),
  answer: plainTextSchema(1_000),
}).strict()

export const commissionFaqListSchema = z.array(commissionFaqSchema)
  .max(8)
  .superRefine((items, context) => {
    const questions = new Set<string>()
    for (const [index, item] of items.entries()) {
      if (questions.has(item.question)) {
        context.addIssue({
          code: 'custom',
          message: 'FAQ 问题不得重复',
          path: [index, 'question'],
        })
      }
      questions.add(item.question)
    }
  })

export const adminCommissionFaqSchema = commissionFaqSchema.extend({
  id: resourceIdSchema,
}).strict()

export const adminCommissionFaqListSchema = z.array(adminCommissionFaqSchema)
  .max(8)
  .superRefine((items, context) => {
    const ids = new Set<string>()
    const questions = new Set<string>()
    for (const [index, item] of items.entries()) {
      if (ids.has(item.id)) {
        context.addIssue({ code: 'custom', message: 'FAQ ID 不得重复', path: [index, 'id'] })
      }
      if (questions.has(item.question)) {
        context.addIssue({ code: 'custom', message: 'FAQ 问题不得重复', path: [index, 'question'] })
      }
      ids.add(item.id)
      questions.add(item.question)
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

export const commissionContentFieldsSchema = z.object({
  intro: plainTextSchema(240).nullable(),
  estimateNote: plainTextSchema(600).nullable(),
  emailAction: plainTextSchema(240).nullable(),
}).strict()

export const aboutContentFieldsSchema = z.object({
  studioFacts: plainTextSchema(1_200).nullable(),
  makingScope: plainTextSchema(1_200).nullable(),
}).strict()

export const termsContentFieldsSchema = z.object({
  basicTerms: plainTextSchema(8_000).nullable(),
}).strict()

export const privacyContentFieldsSchema = z.object({
  privacyPolicy: plainTextSchema(8_000).nullable(),
}).strict()

export const mutableContactContentSchema = z.object({
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

export const updateCommissionContentRequestSchema = versionedRequestSchema(
  commissionContentFieldsSchema,
)
export const updateFaqContentRequestSchema = versionedRequestSchema(
  z.object({ faqs: adminCommissionFaqListSchema }).strict(),
)
export const updateAboutContentRequestSchema = versionedRequestSchema(
  aboutContentFieldsSchema,
)
export const updateTermsContentRequestSchema = versionedRequestSchema(
  termsContentFieldsSchema,
)
export const updatePrivacyContentRequestSchema = versionedRequestSchema(
  privacyContentFieldsSchema,
)
export const updateContactContentRequestSchema = versionedRequestSchema(
  mutableContactContentSchema,
)

export const updateSiteBusinessStatusRequestSchema = versionedRequestSchema(
  z.object({
    tone: siteBusinessStatusToneSchema,
    label: plainTextSchema(40),
    detail: plainTextSchema(240),
  }).strict(),
)

export const adminSiteContentDtoSchema = z.object({
  /** Legacy home-settings version; content cards use section versions below. */
  version: resourceVersionSchema,
  versions: z.object({
    commission: resourceVersionSchema,
    faq: resourceVersionSchema,
    about: resourceVersionSchema,
    terms: resourceVersionSchema,
    privacy: resourceVersionSchema,
    contact: resourceVersionSchema,
  }).strict(),
  statuses: statusPairSchema(adminSiteBusinessStatusDtoSchema),
  commission: commissionContentFieldsSchema.extend({
    faqs: adminCommissionFaqListSchema,
  }).strict(),
  about: aboutContentFieldsSchema.extend({
    basicTerms: termsContentFieldsSchema.shape.basicTerms,
    privacyPolicy: privacyContentFieldsSchema.shape.privacyPolicy,
  }).strict(),
  contact: publicContactContentSchema,
}).strict()

export const publicSiteContentDtoSchema = z.object({
  statuses: statusPairSchema(publicSiteBusinessStatusDtoSchema),
  commission: commissionContentFieldsSchema.extend({
    faqs: commissionFaqListSchema,
    email: contactEmailSchema,
    termsHref: z.literal('/service'),
  }).strict(),
  about: aboutContentFieldsSchema.extend({
    basicTerms: termsContentFieldsSchema.shape.basicTerms,
    privacyPolicy: privacyContentFieldsSchema.shape.privacyPolicy,
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

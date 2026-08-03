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

const commissionContentSchema = z.object({
  intro: plainTextSchema(240).nullable(),
  estimateNote: plainTextSchema(600).nullable(),
  emailAction: plainTextSchema(240).nullable(),
  faqs: commissionFaqListSchema,
}).strict()

const aboutContentSchema = z.object({
  studioFacts: plainTextSchema(1_200).nullable(),
  makingScope: plainTextSchema(1_200).nullable(),
  basicTerms: plainTextSchema(8_000).nullable(),
}).strict()

const mutableContactContentSchema = z.object({
  douyin: contactDouyinSchema.nullable(),
  antiScam: plainTextSchema(600).nullable(),
}).strict()

const publicContactContentSchema = mutableContactContentSchema.extend({
  email: contactEmailSchema,
  qq: contactQqSchema,
}).strict()

const statusPairSchema = <T extends z.ZodType>(status: T) => z.object({
  commission: status.nullable(),
  adoption: status.nullable(),
}).strict()

export const updateSiteContentRequestSchema = versionedRequestSchema(
  z.object({
    commission: commissionContentSchema,
    about: aboutContentSchema,
    contact: mutableContactContentSchema,
  }).strict(),
)

export const updateSiteBusinessStatusRequestSchema = versionedRequestSchema(
  z.object({
    tone: siteBusinessStatusToneSchema,
    label: plainTextSchema(40),
    detail: plainTextSchema(240),
  }).strict(),
)

export const adminSiteContentDtoSchema = z.object({
  version: resourceVersionSchema,
  statuses: statusPairSchema(adminSiteBusinessStatusDtoSchema),
  commission: commissionContentSchema,
  about: aboutContentSchema,
  contact: publicContactContentSchema,
}).strict()

export const publicSiteContentDtoSchema = z.object({
  statuses: statusPairSchema(publicSiteBusinessStatusDtoSchema),
  commission: commissionContentSchema.extend({
    email: contactEmailSchema,
    termsHref: z.literal('/about#terms'),
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

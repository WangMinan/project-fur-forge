import { z } from 'zod'
import {
  resourceIdSchema,
  resourceVersionSchema,
} from './api'

export const WORK_PURPOSE_VALUES = [
  'commission',
  'adoption',
  'showcase',
] as const

export const SUIT_TYPE_VALUES = [
  'full',
  'partial',
] as const

export const PUBLICATION_STATUS_VALUES = [
  'draft',
  'published',
  'unpublished',
] as const

export const ADOPTION_METHOD_VALUES = [
  'regular',
  'event_drop',
] as const

export const BUSINESS_STATUS_VALUES = [
  'preparing',
  'available',
  'event_sale',
  'scheduled',
  'in_production',
  'delivered',
] as const

export const RETURN_PHOTO_CONSENT_SOURCE_VALUES = [
  'qq',
  'email',
  'other',
] as const

export const workPurposeSchema = z.enum(WORK_PURPOSE_VALUES)
export const suitTypeSchema = z.enum(SUIT_TYPE_VALUES)
export const publicationStatusSchema = z.enum(PUBLICATION_STATUS_VALUES)
export const adoptionMethodSchema = z.enum(ADOPTION_METHOD_VALUES)
export const businessStatusSchema = z.enum(BUSINESS_STATUS_VALUES)
export const returnPhotoConsentSourceSchema = z.enum(
  RETURN_PHOTO_CONSENT_SOURCE_VALUES,
)

export const returnPhotoConsentSchema = z.object({
  consentSource: returnPhotoConsentSourceSchema.nullable(),
  consentConfirmedAt: z.string().datetime({ offset: true }).nullable(),
  consentNote: z.string().trim().max(500).nullable(),
}).strict()

export const workFeatureTagSchema = z.string()
  .trim()
  .refine(value => Array.from(value).length >= 1, '属性不能为空')
  .refine(value => Array.from(value).length <= 24, '属性最多 24 个字符')

export const workFeatureTagsSchema = z.array(workFeatureTagSchema)
  .max(8)
  .superRefine((values, context) => {
    const seen = new Set<string>()

    values.forEach((value, index) => {
      if (seen.has(value)) {
        context.addIssue({
          code: 'custom',
          message: '同一作品的属性不得重复',
          path: [index],
        })
      }

      seen.add(value)
    })
  })

export const cnyPriceSchema = z.object({
  currency: z.literal('CNY'),
  minorUnits: z.number().int().positive(),
}).strict()

const slugSchema = z.string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

const publicWorkBaseSchema = z.object({
  id: resourceIdSchema,
  version: resourceVersionSchema,
  slug: slugSchema,
  characterName: z.string().trim().min(1).max(100),
  species: z.string().trim().min(1).max(100),
  suitType: suitTypeSchema,
  ownerDisplay: z.string().trim().min(1).max(100),
  featureTags: workFeatureTagsSchema,
}).strict()

export const publicWorkDtoSchema = z.discriminatedUnion('purpose', [
  publicWorkBaseSchema.extend({
    purpose: z.literal('adoption'),
    adoptionMethod: adoptionMethodSchema,
    businessStatus: businessStatusSchema,
    price: cnyPriceSchema.optional(),
  }),
  publicWorkBaseSchema.extend({
    purpose: z.literal('commission'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    price: z.never().optional(),
  }),
  publicWorkBaseSchema.extend({
    purpose: z.literal('showcase'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    price: z.never().optional(),
  }),
])

const privateWorkFieldsSchema = z.object({
  ownerContact: z.string().max(500).nullable(),
}).strict()

const adminWorkBaseSchema = publicWorkBaseSchema.extend({
  publicationStatus: publicationStatusSchema,
  assetIds: z.array(resourceIdSchema).max(11),
  private: privateWorkFieldsSchema,
})

export const adminWorkDtoSchema = z.discriminatedUnion('purpose', [
  adminWorkBaseSchema.extend({
    purpose: z.literal('adoption'),
    adoptionMethod: adoptionMethodSchema.optional(),
    businessStatus: businessStatusSchema.optional(),
    priceCnyMinor: z.number().int().positive().optional(),
  }),
  adminWorkBaseSchema.extend({
    purpose: z.literal('commission'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    priceCnyMinor: z.never().optional(),
  }),
  adminWorkBaseSchema.extend({
    purpose: z.literal('showcase'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    priceCnyMinor: z.never().optional(),
  }),
])

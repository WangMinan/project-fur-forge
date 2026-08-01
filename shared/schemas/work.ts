import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import { watermarkAnchorSchema } from './upload'

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

export const slugSchema = z.string()
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

export const nonAdoptionWorkFieldsSchema = z.object({
  slug: slugSchema,
  characterName: z.string().trim().min(1).max(100),
  species: z.string().trim().min(1).max(100),
  suitType: suitTypeSchema,
  purpose: z.enum(['commission', 'showcase']),
  ownerDisplay: z.enum(['有点小狗工作室', '不公开']),
  ownerContact: z.string().trim().min(1).max(500).nullable(),
  featureTags: workFeatureTagsSchema,
}).strict()

export const createWorkRequestSchema = nonAdoptionWorkFieldsSchema
export const updateWorkRequestSchema = versionedRequestSchema(
  nonAdoptionWorkFieldsSchema,
)
export const deleteWorkRequestSchema = versionedRequestSchema(
  z.object({}).strict(),
)
export const deleteWorkResponseSchema = apiSuccessSchema(
  z.object({ id: resourceIdSchema }).strict(),
)

export const studioPhotoInputSchema = z.object({
  assetId: resourceIdSchema,
  alt: z.string().trim().min(1).max(500),
  primary: z.boolean(),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
  crop: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  }).strict().superRefine((crop, context) => {
    if (crop.x + crop.width > 1 || crop.y + crop.height > 1) {
      context.addIssue({
        code: 'custom',
        message: '裁切区域超出图片边界',
      })
    }
  }),
  watermarkAnchor: watermarkAnchorSchema,
}).strict()

export const studioPhotoCollectionSchema = z.array(studioPhotoInputSchema)
  .max(5)
  .superRefine((photos, context) => {
    if (new Set(photos.map(photo => photo.assetId)).size !== photos.length) {
      context.addIssue({
        code: 'custom',
        message: '同一资产不能重复关联',
      })
    }
    if (photos.length > 0 && photos.filter(photo => photo.primary).length !== 1) {
      context.addIssue({
        code: 'custom',
        message: '出厂照必须且只能设置一张主图',
      })
    }
  })

export const replaceStudioPhotosRequestSchema = versionedRequestSchema(
  z.object({ photos: studioPhotoCollectionSchema }).strict(),
)

export const managedStudioPhotoDtoSchema = studioPhotoInputSchema.extend({
  version: resourceVersionSchema,
  status: z.enum(['PENDING', 'READY', 'FAILED']),
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
  position: z.number().int().min(0).max(4),
  publicVariantCount: z.number().int().nonnegative(),
}).strict()

export const managedWorkDtoSchema = nonAdoptionWorkFieldsSchema.omit({
  ownerContact: true,
}).extend({
  id: resourceIdSchema,
  version: resourceVersionSchema,
  publicationStatus: publicationStatusSchema,
  studioPhotos: z.array(managedStudioPhotoDtoSchema).max(5),
  private: privateWorkFieldsSchema,
}).strict()

export const workListItemDtoSchema = managedWorkDtoSchema.pick({
  id: true,
  version: true,
  slug: true,
  characterName: true,
  species: true,
  suitType: true,
  purpose: true,
  ownerDisplay: true,
  publicationStatus: true,
}).extend({
  studioPhotoCount: z.number().int().min(0).max(5),
  primaryAssetId: resourceIdSchema.nullable(),
}).strict()

export const publicSafeWorkPreviewDtoSchema = managedWorkDtoSchema.omit({
  private: true,
}).extend({
  mediaReady: z.boolean(),
}).strict()

export const managedWorkResponseSchema = apiSuccessSchema(managedWorkDtoSchema)
export const workListResponseSchema = apiSuccessSchema(
  z.array(workListItemDtoSchema),
)
export const publicSafeWorkPreviewResponseSchema = apiSuccessSchema(
  publicSafeWorkPreviewDtoSchema,
)

import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import { watermarkAnchorSchema } from './upload'

export const WORK_PURPOSE_VALUES = ['commission', 'adoption', 'showcase'] as const
export const PUBLICATION_STATUS_VALUES = ['draft', 'published', 'unpublished'] as const

export const workPurposeSchema = z.enum(WORK_PURPOSE_VALUES)
export const publicationStatusSchema = z.enum(PUBLICATION_STATUS_VALUES)
export const adoptionStatusSchema = z.enum(['available', 'adopted'])

export const adoptionStatusReviewItemSchema = z.object({
  id: resourceIdSchema,
  characterName: z.string().min(1).max(120),
  publicationStatus: publicationStatusSchema,
}).strict()

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
  slug: slugSchema,
  characterName: z.string().trim().min(1).max(100),
  species: z.string().trim().min(1).max(100),
}).strict()

export const publicAdoptionWorkDtoSchema = publicWorkBaseSchema.extend({
  adoptionStatus: adoptionStatusSchema,
  price: cnyPriceSchema.optional(),
}).strict()

export const publicWorkDtoSchema = publicWorkBaseSchema

/**
 * 详情页作品事实：领养作品额外带领养状态与已录入价格，其它用途没有这两个字段。
 * 两个字段与 `/adoptions` 卡片同源（同一公开投影），详情页因此不需要额外请求。
 */
export const publicWorkDetailWorkDtoSchema = publicWorkBaseSchema.extend({
  adoptionStatus: adoptionStatusSchema.optional(),
  price: cnyPriceSchema.optional(),
}).strict()

const mutableWorkBaseSchema = z.object({
  slug: slugSchema,
  characterName: z.string().trim().min(1).max(100),
  species: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().nonnegative(),
  featured: z.boolean(),
}).strict()

export const workFieldsSchema = z.discriminatedUnion('purpose', [
  mutableWorkBaseSchema.extend({
    purpose: z.literal('adoption'),
    adoptionStatus: adoptionStatusSchema,
    priceCnyMinor: z.number().int().positive().nullable(),
  }).strict(),
  mutableWorkBaseSchema.extend({ purpose: z.literal('commission') }).strict(),
  mutableWorkBaseSchema.extend({ purpose: z.literal('showcase') }).strict(),
])

export const createWorkRequestSchema = workFieldsSchema
export const updateWorkRequestSchema = versionedRequestSchema(workFieldsSchema)
export const updateWorkPresentationRequestSchema = versionedRequestSchema(
  z.object({
    featured: z.boolean(),
    /** @deprecated 顺序只允许通过完整精选集合接口维护。 */
    sortOrder: z.number().int().nonnegative().optional(),
  }).strict(),
)
export const deleteWorkRequestSchema = versionedRequestSchema(z.object({}).strict())
export const deleteWorkResponseSchema = apiSuccessSchema(
  z.object({ id: resourceIdSchema }).strict(),
)

const studioPhotoBaseSchema = z.object({
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
      context.addIssue({ code: 'custom', message: '裁切区域超出图片边界' })
    }
  }),
}).strict()

export const studioPhotoInputSchema = studioPhotoBaseSchema.extend({
  /** Historical v1 identity only; brand-centered-v2 always uses center. */
  watermarkAnchor: watermarkAnchorSchema.optional(),
}).strict()

export const studioPhotoCollectionSchema = z.array(studioPhotoInputSchema)
  .max(5)
  .superRefine((photos, context) => {
    if (new Set(photos.map(photo => photo.assetId)).size !== photos.length) {
      context.addIssue({ code: 'custom', message: '同一资产不能重复关联' })
    }
    if (photos.length > 0 && photos.filter(photo => photo.primary).length !== 1) {
      context.addIssue({ code: 'custom', message: '出厂照必须且只能设置一张主图' })
    }
  })

export const replaceStudioPhotosRequestSchema = versionedRequestSchema(
  z.object({ photos: studioPhotoCollectionSchema }).strict(),
)

export const designSheetInputSchema = z.object({
  assetId: resourceIdSchema,
  alt: z.string().trim().min(1).max(500),
}).strict()

export const replaceDesignSheetRequestSchema = versionedRequestSchema(
  z.object({ designSheet: designSheetInputSchema.nullable() }).strict(),
)

export const managedDesignSheetDtoSchema = designSheetInputSchema.extend({
  alt: z.string().trim().min(1).max(500).nullable(),
  version: resourceVersionSchema,
  status: z.enum(['PENDING', 'READY', 'FAILED']),
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
  position: z.literal(0),
  publicVariantCount: z.number().int().nonnegative(),
}).strict()

export const adoptionCoverInputSchema = studioPhotoBaseSchema.omit({
  primary: true,
}).extend({
  alt: z.string().trim().min(1).max(500),
}).strict()

export const replaceAdoptionCoverRequestSchema = versionedRequestSchema(
  z.object({ adoptionCover: adoptionCoverInputSchema.nullable() }).strict(),
)

export const managedAdoptionCoverDtoSchema = adoptionCoverInputSchema.extend({
  version: resourceVersionSchema,
  status: z.enum(['PENDING', 'READY', 'FAILED']),
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
  position: z.literal(0),
  publicVariantCount: z.number().int().nonnegative(),
}).strict()

export const managedStudioPhotoDtoSchema = studioPhotoBaseSchema.extend({
  watermarkAnchor: watermarkAnchorSchema,
  version: resourceVersionSchema,
  status: z.enum(['PENDING', 'READY', 'FAILED']),
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
  position: z.number().int().min(0).max(4),
  publicVariantCount: z.number().int().nonnegative(),
}).strict()

const managedWorkBaseSchema = mutableWorkBaseSchema.extend({
  id: resourceIdSchema,
  version: resourceVersionSchema,
  publicationStatus: publicationStatusSchema,
  studioPhotos: z.array(managedStudioPhotoDtoSchema).max(5),
})

export const managedWorkDtoSchema = z.discriminatedUnion('purpose', [
  managedWorkBaseSchema.extend({
    purpose: z.literal('adoption'),
    adoptionStatus: adoptionStatusSchema.nullable(),
    adoptionCover: managedAdoptionCoverDtoSchema.nullable(),
    designSheet: managedDesignSheetDtoSchema.nullable(),
    priceCnyMinor: z.number().int().positive().nullable(),
  }).strict(),
  managedWorkBaseSchema.extend({ purpose: z.literal('commission') }).strict(),
  managedWorkBaseSchema.extend({ purpose: z.literal('showcase') }).strict(),
])

/** Legacy mapper response retained as a target-shaped internal DTO. */
export const adminWorkDtoSchema = z.object({
  id: resourceIdSchema,
  version: resourceVersionSchema,
  slug: slugSchema,
  characterName: z.string().trim().min(1).max(100),
  species: z.string().trim().min(1).max(100),
  purpose: workPurposeSchema,
  publicationStatus: publicationStatusSchema,
  assetIds: z.array(resourceIdSchema).max(12),
  adoptionStatus: adoptionStatusSchema.nullable(),
  priceCnyMinor: z.number().int().positive().nullable(),
  sortOrder: z.number().int().nonnegative(),
  featured: z.boolean(),
}).strict()

const workListItemBaseSchema = managedWorkBaseSchema.omit({
  studioPhotos: true,
}).extend({
  studioPhotoCount: z.number().int().min(0).max(5),
  primaryAssetId: resourceIdSchema.nullable(),
  portraitStudioPhotoAssetId: resourceIdSchema.nullable(),
})

export const workListItemDtoSchema = z.discriminatedUnion('purpose', [
  workListItemBaseSchema.extend({
    purpose: z.literal('adoption'),
    adoptionStatus: adoptionStatusSchema.nullable(),
    adoptionCoverAssetId: resourceIdSchema.nullable(),
    designSheetAssetId: resourceIdSchema.nullable(),
    priceCnyMinor: z.number().int().positive().nullable(),
  }).strict(),
  workListItemBaseSchema.extend({ purpose: z.literal('commission') }).strict(),
  workListItemBaseSchema.extend({ purpose: z.literal('showcase') }).strict(),
])

const publicSafeWorkPreviewBaseSchema = managedWorkBaseSchema.extend({
  mediaReady: z.boolean(),
})

export const publicSafeWorkPreviewDtoSchema = z.discriminatedUnion('purpose', [
  publicSafeWorkPreviewBaseSchema.extend({
    purpose: z.literal('adoption'),
    adoptionStatus: adoptionStatusSchema.nullable(),
    adoptionCover: managedAdoptionCoverDtoSchema.nullable(),
    designSheet: managedDesignSheetDtoSchema.nullable(),
    priceCnyMinor: z.number().int().positive().nullable(),
  }).strict(),
  publicSafeWorkPreviewBaseSchema.extend({ purpose: z.literal('commission') }).strict(),
  publicSafeWorkPreviewBaseSchema.extend({ purpose: z.literal('showcase') }).strict(),
])

export const managedWorkResponseSchema = apiSuccessSchema(managedWorkDtoSchema)
export const workListResponseSchema = apiSuccessSchema(z.array(workListItemDtoSchema))
export const adoptionStatusReviewResponseSchema = apiSuccessSchema(
  z.array(adoptionStatusReviewItemSchema),
)

export const featuredWorkOrderRequestSchema = z.object({
  payload: z.object({
    items: z.array(z.object({
      id: resourceIdSchema,
      expectedVersion: resourceVersionSchema,
    }).strict()),
  }).strict(),
}).strict().superRefine((input, context) => {
  const ids = input.payload.items.map(item => item.id)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: 'custom',
      message: '精选作品不能重复',
      path: ['payload', 'items'],
    })
  }
})

export const featuredWorkOrderResponseSchema = apiSuccessSchema(
  z.array(workListItemDtoSchema),
)
export const publicSafeWorkPreviewResponseSchema = apiSuccessSchema(
  publicSafeWorkPreviewDtoSchema,
)

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

export const REGULAR_ADOPTION_BUSINESS_STATUS_VALUES = [
  'preparing',
  'available',
  'scheduled',
  'in_production',
  'delivered',
] as const

export const workPurposeSchema = z.enum(WORK_PURPOSE_VALUES)
export const suitTypeSchema = z.enum(SUIT_TYPE_VALUES)
export const publicationStatusSchema = z.enum(PUBLICATION_STATUS_VALUES)
export const adoptionMethodSchema = z.enum(ADOPTION_METHOD_VALUES)
export const businessStatusSchema = z.enum(BUSINESS_STATUS_VALUES)
export const adoptionStatusSchema = z.enum(['available', 'adopted'])
export const adoptionStatusReviewItemSchema = z.object({
  id: resourceIdSchema,
  characterName: z.string().min(1).max(120),
  legacyBusinessStatus: businessStatusSchema.nullable(),
  publicationStatus: publicationStatusSchema,
}).strict()
export const regularAdoptionBusinessStatusSchema = z.enum(
  REGULAR_ADOPTION_BUSINESS_STATUS_VALUES,
)
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

/** 展会名称与展会时间：短展示文本，时间不解析为可调度日期。 */
export const eventNameSchema = z.string().trim().min(1).max(80)
export const eventTimeSchema = z.string().trim().min(1).max(80)

export const publicAdoptionWorkDtoSchema = publicWorkBaseSchema.extend({
  purpose: z.literal('adoption'),
  adoptionMethod: adoptionMethodSchema,
  businessStatus: businessStatusSchema,
  price: cnyPriceSchema.optional(),
  /**
   * T37 展会掉落：只有 event_drop 才有值，其他领养固定为 null。
   * 时间是展示文本，不参与结构化数据或倒计时。
   */
  eventName: eventNameSchema.nullable(),
  eventTime: eventTimeSchema.nullable(),
})

export const publicWorkDtoSchema = z.discriminatedUnion('purpose', [
  publicAdoptionWorkDtoSchema,
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
    adoptionMethod: adoptionMethodSchema.nullable(),
    businessStatus: businessStatusSchema.nullable(),
    eventName: eventNameSchema.nullable(),
    eventTime: eventTimeSchema.nullable(),
    priceCnyMinor: z.number().int().positive().nullable(),
    sortOrder: z.number().int().nonnegative(),
    featured: z.boolean(),
  }),
  adminWorkBaseSchema.extend({
    purpose: z.literal('commission'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    eventName: z.never().optional(),
    eventTime: z.never().optional(),
    priceCnyMinor: z.never().optional(),
    sortOrder: z.number().int().nonnegative(),
    featured: z.boolean(),
  }),
  adminWorkBaseSchema.extend({
    purpose: z.literal('showcase'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    eventName: z.never().optional(),
    eventTime: z.never().optional(),
    priceCnyMinor: z.never().optional(),
    sortOrder: z.number().int().nonnegative(),
    featured: z.boolean(),
  }),
])

const mutableWorkBaseSchema = z.object({
  slug: slugSchema,
  characterName: z.string().trim().min(1).max(100),
  species: z.string().trim().min(1).max(100),
  suitType: suitTypeSchema,
  ownerDisplay: z.string().trim().min(1).max(100),
  ownerContact: z.string().trim().min(1).max(500).nullable(),
  featureTags: workFeatureTagsSchema,
  sortOrder: z.number().int().nonnegative(),
  featured: z.boolean(),
}).strict()

/**
 * 可编辑作品字段。
 *
 * 管理端展示四个业务选项，但底层仍只有三种 purpose：
 * 委托作品 → commission；常规领养 → adoption + regular；
 * 展会掉落 → adoption + event_drop；纯展示 → showcase。
 *
 * 展会名称/时间只属于 event_drop 分支，因此其他分支在类型层面
 * 就无法携带这两个字段，切换业务类型不可能留下僵尸值。
 */
const mutableAdoptionSchema = mutableWorkBaseSchema.extend({
  purpose: z.literal('adoption'),
  adoptionMethod: adoptionMethodSchema,
  businessStatus: regularAdoptionBusinessStatusSchema,
  priceCnyMinor: z.number().int().positive().nullable(),
  /**
   * 展会名称与时间只属于 event_drop。
   * 草稿允许留空（发布检查负责拦截），但非掉落必须为空，
   * 因此切换业务类型不会留下僵尸值。
   */
  eventName: eventNameSchema.nullable().default(null),
  eventTime: eventTimeSchema.nullable().default(null),
}).superRefine((input, context) => {
  if (input.adoptionMethod === 'event_drop') {
    return
  }
  for (const field of ['eventName', 'eventTime'] as const) {
    if (input[field] !== null) {
      context.addIssue({
        code: 'custom',
        message: '只有展会掉落才能填写展会名称与展会时间',
        path: [field],
      })
    }
  }
})

export const workFieldsSchema = z.union([
  mutableAdoptionSchema,
  mutableWorkBaseSchema.extend({
    purpose: z.literal('commission'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    priceCnyMinor: z.never().optional(),
    eventName: z.never().optional(),
    eventTime: z.never().optional(),
  }),
  mutableWorkBaseSchema.extend({
    purpose: z.literal('showcase'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    priceCnyMinor: z.never().optional(),
    eventName: z.never().optional(),
    eventTime: z.never().optional(),
  }),
])

export const createWorkRequestSchema = workFieldsSchema
export const updateWorkRequestSchema = versionedRequestSchema(
  workFieldsSchema,
)
export const updateWorkPresentationRequestSchema = versionedRequestSchema(
  z.object({
    featured: z.boolean(),
    /** @deprecated T51-F8 起顺序只允许通过完整精选集合接口维护。 */
    sortOrder: z.number().int().nonnegative().optional(),
  }).strict(),
)
export const deleteWorkRequestSchema = versionedRequestSchema(
  z.object({}).strict(),
)
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
      context.addIssue({
        code: 'custom',
        message: '裁切区域超出图片边界',
      })
    }
  }),
}).strict()

export const studioPhotoInputSchema = studioPhotoBaseSchema.extend({
  /** @deprecated brand-centered-v2 ignores per-image corners. */
  watermarkAnchor: watermarkAnchorSchema.optional(),
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

export const designSheetInputSchema = z.object({
  assetId: resourceIdSchema,
  alt: z.string().trim().min(1).max(500),
}).strict()

export const replaceDesignSheetRequestSchema = versionedRequestSchema(
  z.object({
    designSheet: designSheetInputSchema.nullable(),
  }).strict(),
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
  z.object({
    adoptionCover: adoptionCoverInputSchema.nullable(),
  }).strict(),
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
  /** Historical v1 identity only; brand-centered-v2 always uses center. */
  watermarkAnchor: watermarkAnchorSchema,
  version: resourceVersionSchema,
  status: z.enum(['PENDING', 'READY', 'FAILED']),
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
  position: z.number().int().min(0).max(4),
  publicVariantCount: z.number().int().nonnegative(),
}).strict()

const managedWorkBaseSchema = mutableWorkBaseSchema.omit({
  ownerContact: true,
}).extend({
  id: resourceIdSchema,
  version: resourceVersionSchema,
  publicationStatus: publicationStatusSchema,
  studioPhotos: z.array(managedStudioPhotoDtoSchema).max(5),
  private: privateWorkFieldsSchema,
})

export const managedWorkDtoSchema = z.discriminatedUnion('purpose', [
  managedWorkBaseSchema.extend({
    purpose: z.literal('adoption'),
    adoptionStatus: adoptionStatusSchema.nullable(),
    adoptionCover: managedAdoptionCoverDtoSchema.nullable(),
    designSheet: managedDesignSheetDtoSchema.nullable(),
    adoptionMethod: adoptionMethodSchema.nullable(),
    businessStatus: businessStatusSchema.nullable(),
    eventName: eventNameSchema.nullable(),
    eventTime: eventTimeSchema.nullable(),
    priceCnyMinor: z.number().int().positive().nullable(),
  }),
  managedWorkBaseSchema.extend({
    purpose: z.literal('commission'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    eventName: z.never().optional(),
    eventTime: z.never().optional(),
    priceCnyMinor: z.never().optional(),
  }),
  managedWorkBaseSchema.extend({
    purpose: z.literal('showcase'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    eventName: z.never().optional(),
    eventTime: z.never().optional(),
    priceCnyMinor: z.never().optional(),
  }),
])

const workListItemBaseSchema = managedWorkBaseSchema.omit({
  featureTags: true,
  studioPhotos: true,
  private: true,
}).extend({
  studioPhotoCount: z.number().int().min(0).max(5),
  primaryAssetId: resourceIdSchema.nullable(),
})

export const workListItemDtoSchema = z.discriminatedUnion('purpose', [
  workListItemBaseSchema.extend({
    purpose: z.literal('adoption'),
    designSheetAssetId: resourceIdSchema.nullable(),
    adoptionMethod: adoptionMethodSchema.nullable(),
    businessStatus: businessStatusSchema.nullable(),
    eventName: eventNameSchema.nullable(),
    eventTime: eventTimeSchema.nullable(),
    priceCnyMinor: z.number().int().positive().nullable(),
  }),
  workListItemBaseSchema.extend({
    purpose: z.literal('commission'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    eventName: z.never().optional(),
    eventTime: z.never().optional(),
    priceCnyMinor: z.never().optional(),
  }),
  workListItemBaseSchema.extend({
    purpose: z.literal('showcase'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    eventName: z.never().optional(),
    eventTime: z.never().optional(),
    priceCnyMinor: z.never().optional(),
  }),
])

const publicSafeWorkPreviewBaseSchema = managedWorkBaseSchema.omit({
  private: true,
}).extend({ mediaReady: z.boolean() })

export const publicSafeWorkPreviewDtoSchema = z.discriminatedUnion('purpose', [
  publicSafeWorkPreviewBaseSchema.extend({
    purpose: z.literal('adoption'),
    adoptionStatus: adoptionStatusSchema.nullable(),
    adoptionCover: managedAdoptionCoverDtoSchema.nullable(),
    designSheet: managedDesignSheetDtoSchema.nullable(),
    adoptionMethod: adoptionMethodSchema.nullable(),
    businessStatus: businessStatusSchema.nullable(),
    eventName: eventNameSchema.nullable(),
    eventTime: eventTimeSchema.nullable(),
    priceCnyMinor: z.number().int().positive().nullable(),
  }),
  publicSafeWorkPreviewBaseSchema.extend({
    purpose: z.literal('commission'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    eventName: z.never().optional(),
    eventTime: z.never().optional(),
    priceCnyMinor: z.never().optional(),
  }),
  publicSafeWorkPreviewBaseSchema.extend({
    purpose: z.literal('showcase'),
    adoptionMethod: z.never().optional(),
    businessStatus: z.never().optional(),
    eventName: z.never().optional(),
    eventTime: z.never().optional(),
    priceCnyMinor: z.never().optional(),
  }),
])

export const managedWorkResponseSchema = apiSuccessSchema(managedWorkDtoSchema)
export const workListResponseSchema = apiSuccessSchema(
  z.array(workListItemDtoSchema),
)
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

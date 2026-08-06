import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import {
  publicAltSchema,
  publicHeroSlideDtoSchema,
  publicSourceSetDtoSchema,
} from './media'
import { publicationOperationDtoSchema } from './publication'
import { publicationStatusSchema, slugSchema } from './work'

export const homeTaglineSchema = z.string().trim().min(1).max(120)
export const contactEmailSchema = z.string().trim().email().max(254)
export const contactQqSchema = z.string().trim().regex(/^[1-9]\d{4,11}$/u)
export const heroPlacementSchema = z.enum(['home', 'commission'])

export const adminHeroAssetDtoSchema = z.object({
  assetId: resourceIdSchema,
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
}).strict()

export const adminHeroSlideDtoSchema = z.object({
  id: resourceIdSchema,
  version: resourceVersionSchema,
  alt: publicAltSchema,
  sortOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
  landscape: adminHeroAssetDtoSchema,
  portrait: adminHeroAssetDtoSchema,
  linkedWork: z.object({
    id: resourceIdSchema,
    slug: slugSchema,
    publicationStatus: publicationStatusSchema,
  }).strict().nullable(),
  upscaleReady: z.boolean(),
  upscaleOperation: publicationOperationDtoSchema.nullable(),
  missingVariantCount: z.number().int().min(0).max(12),
  publicationOperation: publicationOperationDtoSchema.nullable(),
}).strict()

export const adminHomeDtoSchema = z.object({
  version: resourceVersionSchema,
  tagline: homeTaglineSchema,
  contactEmail: contactEmailSchema,
  contactQq: contactQqSchema,
  autoRotate: z.boolean(),
  autoRotateIntervalMs: z.number().int().min(6_000).max(300_000),
  slides: z.array(adminHeroSlideDtoSchema),
}).strict()

const adminHeroPreviewImageDtoSchema = z.object({
  url: z.string().regex(
    /^\/api\/admin\/v1\/site\/home\/slides\/[0-9a-f-]+\/preview\/(?:landscape|portrait)(?:\?placement=commission)?$/u,
  ),
  expiresAt: z.string().datetime({ offset: true }),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict()

export const adminHeroPreviewDtoSchema = z.object({
  landscape: adminHeroPreviewImageDtoSchema,
  portrait: adminHeroPreviewImageDtoSchema,
}).strict()

export const homeEntryKindSchema = z.enum(['commission', 'adoption'])

/** 首页业务入口大图：独立无水印站点展示派生图，不复用其他页面公开 URL。 */
export const publicHomeEntryDtoSchema = z.object({
  kind: homeEntryKindSchema,
  href: z.enum(['/commission', '/adoptions']),
  alt: publicAltSchema,
  sources: publicSourceSetDtoSchema,
}).strict()

export const publicHomeEntriesDtoSchema = z.object({
  commission: publicHomeEntryDtoSchema.nullable(),
  adoption: publicHomeEntryDtoSchema.nullable(),
}).strict()

export const publicHomeDtoSchema = z.object({
  tagline: homeTaglineSchema,
  contactEmail: contactEmailSchema,
  contactQq: contactQqSchema,
  autoRotate: z.boolean(),
  autoRotateIntervalMs: z.number().int().min(6_000).max(300_000),
  slides: z.array(publicHeroSlideDtoSchema).max(5),
  entries: publicHomeEntriesDtoSchema.default({
    commission: null,
    adoption: null,
  }),
}).strict()

export const publicCommissionHeroDtoSchema = z.object({
  slide: publicHeroSlideDtoSchema.nullable(),
}).strict()

const heroSlideInputSchema = z.object({
  alt: publicAltSchema,
  sortOrder: z.number().int().min(0).max(9_999),
  landscapeAssetId: resourceIdSchema,
  portraitAssetId: resourceIdSchema,
  linkedWorkId: resourceIdSchema.nullable(),
}).strict()

export const createHeroSlideRequestSchema = versionedRequestSchema(
  heroSlideInputSchema,
)
export const updateHeroSlideRequestSchema = versionedRequestSchema(
  heroSlideInputSchema,
)
export const mutateHomeRequestSchema = versionedRequestSchema(
  z.object({}).strict(),
)
/**
 * T34-F3：首屏设置只写首页口号与轮播行为。
 * 官方邮箱与 QQ 改由 contact 分区编辑，因此这里不再接受这两个字段；
 * strict() 会拒绝旧版前端继续提交它们，避免出现两个可编辑入口。
 */
export const updateHomeSettingsRequestSchema = versionedRequestSchema(
  z.object({
    tagline: homeTaglineSchema,
    autoRotate: z.boolean(),
    autoRotateIntervalMs: z.number().int().min(6_000).max(300_000),
  }).strict(),
)
export const reorderHeroSlidesRequestSchema = versionedRequestSchema(
  z.object({
    slideIds: z.array(resourceIdSchema).min(1).max(5),
  }).strict().superRefine((value, context) => {
    if (new Set(value.slideIds).size !== value.slideIds.length) {
      context.addIssue({
        code: 'custom',
        message: '轮播项不得重复',
        path: ['slideIds'],
      })
    }
  }),
)

export const adminHomeResponseSchema = apiSuccessSchema(adminHomeDtoSchema)
export const adminHeroPreviewResponseSchema = apiSuccessSchema(
  adminHeroPreviewDtoSchema,
)
export const publicHomeResponseSchema = apiSuccessSchema(publicHomeDtoSchema)
export const publicCommissionHeroResponseSchema = apiSuccessSchema(
  publicCommissionHeroDtoSchema,
)

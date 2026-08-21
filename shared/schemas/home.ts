import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import {
  publicAltSchema,
  publicSourceSetDtoSchema,
} from './media'
import { publicationOperationDtoSchema } from './publication'

export const homeTaglineSchema = z.string().trim().min(1).max(120)
export const contactEmailSchema = z.string().trim().email().max(254)
export const contactQqSchema = z.string().trim().regex(/^[1-9]\d{4,11}$/u)
export const heroPlacementSchema = z.enum(['home', 'commission'])
export const heroOrientationSchema = z.enum(['landscape', 'portrait'])
export const heroCollectionOwnerIdSchema = z.enum([
  'hero-home-landscape',
  'hero-home-portrait',
  'hero-commission-landscape',
  'hero-commission-portrait',
])

// Migrated rows use the deterministic `<legacy UUID>:<orientation>` identity;
// all rows created after R3-B continue to use random UUIDs.
export const heroItemIdSchema = z.union([
  resourceIdSchema,
  z.string().regex(/^[0-9a-f-]{36}:(?:landscape|portrait)$/u),
])

export const adminHeroAssetDtoSchema = z.object({
  assetId: resourceIdSchema,
  version: resourceVersionSchema,
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
}).strict()

export const adminHeroItemDtoSchema = z.object({
  id: heroItemIdSchema,
  version: resourceVersionSchema,
  alt: publicAltSchema,
  sortOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
  asset: adminHeroAssetDtoSchema,
  upscaleReady: z.boolean(),
  upscaleOperation: publicationOperationDtoSchema.nullable(),
  missingVariantCount: z.number().int().min(0).max(16),
  publicationOperation: publicationOperationDtoSchema.nullable(),
}).strict()

export const adminHeroCollectionDtoSchema = z.object({
  placement: heroPlacementSchema,
  orientation: heroOrientationSchema,
  version: resourceVersionSchema,
  items: z.array(adminHeroItemDtoSchema),
}).strict()

export const adminHeroItemPreviewDtoSchema = z.object({
  url: z.string().regex(
    /^\/api\/admin\/v1\/site\/hero-collections\/(?:home|commission)\/(?:landscape|portrait)\/items\/[0-9a-f-]+(?::(?:landscape|portrait))?\/preview$/u,
  ),
  expiresAt: z.string().datetime({ offset: true }),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
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

export const publicHeroItemDtoSchema = z.object({
  alt: publicAltSchema,
  sortOrder: z.number().int().min(0).max(4),
  sources: publicSourceSetDtoSchema,
}).strict()

export const publicHeroPlacementDtoSchema = z.object({
  landscape: z.array(publicHeroItemDtoSchema).max(5),
  portrait: z.array(publicHeroItemDtoSchema).max(5),
}).strict()

export const publicHomeDtoSchema = publicHeroPlacementDtoSchema.extend({
  tagline: homeTaglineSchema,
  contactEmail: contactEmailSchema,
  contactQq: contactQqSchema,
  autoRotate: z.boolean(),
  autoRotateIntervalMs: z.number().int().min(6_000).max(300_000),
  entries: publicHomeEntriesDtoSchema.default({
    commission: null,
    adoption: null,
  }),
}).strict()

export const publicCommissionHeroDtoSchema = publicHeroPlacementDtoSchema

const heroItemInputSchema = z.object({
  alt: publicAltSchema,
  sortOrder: z.number().int().min(0).max(9_999),
  assetId: resourceIdSchema,
  assetVersion: resourceVersionSchema,
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
}).strict()

export const createHeroItemRequestSchema = versionedRequestSchema(
  heroItemInputSchema,
)
export const updateHeroItemRequestSchema = versionedRequestSchema(
  heroItemInputSchema,
)
export const mutateHeroCollectionRequestSchema = versionedRequestSchema(
  z.object({}).strict(),
)
export const reorderHeroItemsRequestSchema = versionedRequestSchema(
  z.object({
    itemIds: z.array(heroItemIdSchema).min(1).max(5),
  }).strict().superRefine((value, context) => {
    if (new Set(value.itemIds).size !== value.itemIds.length) {
      context.addIssue({
        code: 'custom',
        message: '轮播项不得重复',
        path: ['itemIds'],
      })
    }
  }),
)

export const adminHeroCollectionResponseSchema = apiSuccessSchema(
  adminHeroCollectionDtoSchema,
)
export const adminHeroItemPreviewResponseSchema = apiSuccessSchema(
  adminHeroItemPreviewDtoSchema,
)
export const publicHomeResponseSchema = apiSuccessSchema(publicHomeDtoSchema)
export const publicCommissionHeroResponseSchema = apiSuccessSchema(
  publicCommissionHeroDtoSchema,
)

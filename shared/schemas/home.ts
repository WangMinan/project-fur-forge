import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import {
  privateAssetPreviewDtoSchema,
  publicAltSchema,
  publicHeroSlideDtoSchema,
} from './media'
import { publicationStatusSchema, slugSchema } from './work'

export const homeTaglineSchema = z.string().trim().min(1).max(120)

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
  missingVariantCount: z.number().int().min(0).max(12),
}).strict()

export const adminHomeDtoSchema = z.object({
  version: resourceVersionSchema,
  tagline: homeTaglineSchema,
  autoRotate: z.boolean(),
  autoRotateIntervalMs: z.number().int().min(6_000).max(300_000),
  slides: z.array(adminHeroSlideDtoSchema),
}).strict()

const adminHeroPreviewImageDtoSchema = privateAssetPreviewDtoSchema.extend({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

export const adminHeroPreviewDtoSchema = z.object({
  landscape: adminHeroPreviewImageDtoSchema,
  portrait: adminHeroPreviewImageDtoSchema,
}).strict()

export const publicHomeDtoSchema = z.object({
  tagline: homeTaglineSchema,
  autoRotate: z.boolean(),
  autoRotateIntervalMs: z.number().int().min(6_000).max(300_000),
  slides: z.array(publicHeroSlideDtoSchema).max(5),
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

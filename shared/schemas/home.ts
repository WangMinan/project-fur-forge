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
} from './media'
import { publicationOperationDtoSchema } from './publication'
import { publicationStatusSchema, slugSchema } from './work'

export const homeTaglineSchema = z.string().trim().min(1).max(120)
export const contactEmailSchema = z.string().trim().email().max(254)
export const contactQqSchema = z.string().trim().regex(/^[1-9]\d{4,11}$/u)

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
    /^\/api\/admin\/v1\/site\/home\/slides\/[0-9a-f-]+\/preview\/(?:landscape|portrait)$/u,
  ),
  expiresAt: z.string().datetime({ offset: true }),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict()

export const adminHeroPreviewDtoSchema = z.object({
  landscape: adminHeroPreviewImageDtoSchema,
  portrait: adminHeroPreviewImageDtoSchema,
}).strict()

export const publicHomeDtoSchema = z.object({
  tagline: homeTaglineSchema,
  contactEmail: contactEmailSchema,
  contactQq: contactQqSchema,
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
    contactEmail: contactEmailSchema,
    contactQq: contactQqSchema,
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

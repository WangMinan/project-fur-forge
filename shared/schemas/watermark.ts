import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import { expectedUploadSchema } from './upload'

export const WATERMARK_PROFILE_NAME = 'brand-centered-v2' as const
export const WATERMARK_DEFAULT_OPACITY = 50
export const WATERMARK_DEFAULT_SCALE = 60

export const watermarkProfileStatusSchema = z.enum([
  'DRAFT',
  'APPLYING',
  'ACTIVE',
  'RETIRED',
  'FAILED',
])

export const watermarkOperationStatusSchema = z.enum([
  'GENERATING_PUBLIC',
  'VERIFYING_PUBLIC',
  'SWITCHING_PROFILE',
  'CLEANING_PUBLIC',
  'FAILED',
  'DONE',
])

export const watermarkProfileDtoSchema = z.object({
  id: resourceIdSchema,
  profileName: z.literal(WATERMARK_PROFILE_NAME),
  sourceAssetId: resourceIdSchema,
  position: z.literal('center'),
  opacityPercent: z.number().int().min(10).max(90),
  scalePercent: z.number().int().min(20).max(90),
  configDigestSuffix: z.string().regex(/^[0-9a-f]{12}$/u),
  status: watermarkProfileStatusSchema,
  version: resourceVersionSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict()

export const watermarkCandidateDtoSchema = z.object({
  assetId: resourceIdSchema,
  version: resourceVersionSchema,
  status: z.literal('READY'),
  mimeType: z.literal('image/png'),
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
  digestSuffix: z.string().regex(/^[0-9a-f]{12}$/u),
  createdAt: z.string().datetime({ offset: true }),
  active: z.boolean(),
  draft: z.boolean(),
  previewUrl: z.string().startsWith('/api/admin/'),
}).strict()

export const watermarkImpactDtoSchema = z.object({
  publishedWorkCount: z.number().int().nonnegative(),
  enabledHeroSlideCount: z.number().int().nonnegative(),
  targetVariantCount: z.number().int().nonnegative(),
}).strict()

export const watermarkBrandingDtoSchema = z.object({
  version: resourceVersionSchema,
  activeProfile: watermarkProfileDtoSchema.nullable(),
  draftProfile: watermarkProfileDtoSchema.nullable(),
  lastOperationId: resourceIdSchema.nullable(),
  candidates: z.array(watermarkCandidateDtoSchema),
  impact: watermarkImpactDtoSchema,
}).strict()

export const watermarkBrandingResponseSchema = apiSuccessSchema(
  watermarkBrandingDtoSchema,
)

export const createWatermarkUploadSessionRequestSchema = versionedRequestSchema(
  z.object({
    expected: expectedUploadSchema.extend({
      byteSize: z.number().int().min(1).max(20_000_000),
    }).strict(),
  }).strict(),
).superRefine((input, context) => {
  if (input.payload.expected.contentType !== 'image/png') {
    context.addIssue({
      code: 'custom',
      message: '水印候选只接受透明 PNG',
      path: ['payload', 'expected', 'contentType'],
    })
  }
})

export const createWatermarkProfileRequestSchema = versionedRequestSchema(
  z.object({
    sourceAssetId: resourceIdSchema,
    opacityPercent: z.number().int().min(10).max(90)
      .default(WATERMARK_DEFAULT_OPACITY),
    scalePercent: z.number().int().min(20).max(90)
      .default(WATERMARK_DEFAULT_SCALE),
  }).strict(),
)

export const watermarkProfileMutationRequestSchema = versionedRequestSchema(
  z.object({ brandingVersion: resourceVersionSchema }).strict(),
)

export const watermarkOperationRetryRequestSchema = versionedRequestSchema(
  z.object({}).strict(),
)

export const watermarkPreviewKindSchema = z.enum([
  'work-card',
  'detail',
  'home-hero-landscape',
  'home-hero-portrait',
])

export const watermarkOperationDtoSchema = z.object({
  operationId: resourceIdSchema,
  operationType: z.enum(['WATERMARK_PREVIEW', 'WATERMARK_REBUILD']),
  profileId: resourceIdSchema,
  status: watermarkOperationStatusSchema,
  affectedWorkCount: z.number().int().nonnegative(),
  affectedHeroSlideCount: z.number().int().nonnegative(),
  targetVariantCount: z.number().int().nonnegative(),
  generatedVariantCount: z.number().int().nonnegative(),
  verifiedVariantCount: z.number().int().nonnegative(),
  cleanupPendingCount: z.number().int().nonnegative(),
  previews: z.array(z.object({
    kind: watermarkPreviewKindSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.enum(['webp', 'jpeg', 'png']),
    url: z.string().startsWith('/api/admin/'),
  }).strict()),
  failureCode: z.string().min(1).max(100).nullable(),
  version: resourceVersionSchema,
  startedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).nullable(),
}).strict()

export const watermarkProfileResponseSchema = apiSuccessSchema(
  watermarkProfileDtoSchema,
)
export const watermarkOperationResponseSchema = apiSuccessSchema(
  watermarkOperationDtoSchema,
)

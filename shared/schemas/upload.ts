import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import { mediaRoleSchema } from './media'

export const UPLOAD_SESSION_STATUS_VALUES = [
  'AWAITING_UPLOAD',
  'VALIDATING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const

export const UPLOAD_FAILURE_CODE_VALUES = [
  'UPLOAD_OBJECT_MISSING',
  'UPLOAD_METADATA_MISMATCH',
  'UPLOAD_IMAGE_INVALID',
  'UPLOAD_DIMENSIONS_INVALID',
  'UPLOAD_STORAGE_FAILURE',
  'UPLOAD_PREPROCESS_FAILURE',
  'UPLOAD_CLEANUP_FAILED',
] as const

export const UPLOAD_FAILURE_STAGE_VALUES = [
  'HEAD',
  'DIGEST',
  'IMAGE_INFO',
  'PREPROCESS',
  'DATABASE',
  'CLEANUP',
] as const

export const uploadSessionStatusSchema = z.enum(
  UPLOAD_SESSION_STATUS_VALUES,
)
export const uploadFailureCodeSchema = z.enum(UPLOAD_FAILURE_CODE_VALUES)
export const uploadFailureStageSchema = z.enum(UPLOAD_FAILURE_STAGE_VALUES)

export const imageContentTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const workUploadOwnerSchema = z.object({
  type: z.literal('work'),
  id: resourceIdSchema,
  expectedVersion: resourceVersionSchema,
}).strict()

const siteUploadOwnerSchema = z.object({
  type: z.literal('site'),
  id: z.enum(['home', 'branding']),
  expectedVersion: resourceVersionSchema,
}).strict()

export const uploadOwnerSchema = z.discriminatedUnion('type', [
  workUploadOwnerSchema,
  siteUploadOwnerSchema,
])

export const uploadOwnerDtoSchema = z.discriminatedUnion('type', [
  workUploadOwnerSchema.omit({ expectedVersion: true }),
  siteUploadOwnerSchema.omit({ expectedVersion: true }),
])

export const expectedUploadSchema = z.object({
  contentType: imageContentTypeSchema,
  byteSize: z.number().int().min(1).max(30_000_000),
  contentMd5: z.string().regex(/^[A-Za-z0-9+/]{22}==$/u),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  width: z.number().int().min(1).max(12_000),
  height: z.number().int().min(1).max(12_000),
}).strict()

export const createUploadSessionRequestSchema = z.object({
  owner: uploadOwnerSchema,
  mediaRole: mediaRoleSchema,
  expected: expectedUploadSchema,
}).strict().superRefine((input, context) => {
  const workRole = input.mediaRole === 'design_sheet'
    || input.mediaRole === 'studio_photo'
  const siteRoleMatches = input.owner.type === 'site'
    && (
      (input.owner.id === 'home' && input.mediaRole.startsWith('home_hero_'))
      || (input.owner.id === 'branding' && input.mediaRole === 'watermark_logo')
    )
  if ((input.owner.type === 'work') !== workRole || (
    input.owner.type === 'site' && !siteRoleMatches
  )) {
    context.addIssue({
      code: 'custom',
      message: '媒体角色与归属类型不匹配',
      path: ['mediaRole'],
    })
  }
  if (
    input.mediaRole === 'watermark_logo'
    && input.expected.contentType !== 'image/png'
  ) {
    context.addIssue({
      code: 'custom',
      message: '水印候选只接受透明 PNG',
      path: ['expected', 'contentType'],
    })
  }
})

export const uploadSessionDtoSchema = z.object({
  uploadSessionId: resourceIdSchema,
  owner: uploadOwnerDtoSchema,
  ownerVersion: resourceVersionSchema,
  mediaRole: mediaRoleSchema,
  expected: expectedUploadSchema,
  createdBy: resourceIdSchema,
  status: uploadSessionStatusSchema,
  version: resourceVersionSchema,
  failureCode: uploadFailureCodeSchema.nullable(),
  failureStage: uploadFailureStageSchema.nullable(),
  assetId: resourceIdSchema.nullable(),
  createdAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
}).strict()

export const WATERMARK_ANCHOR_VALUES = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const

export const watermarkAnchorSchema = z.enum(WATERMARK_ANCHOR_VALUES)
export const fitModeSchema = z.enum(['cover', 'contain'])
export const previewAspectSchema = z.enum([
  '3:4',
  '16:9',
  '9:16',
  'original',
])

export const completeUploadSessionRequestSchema = versionedRequestSchema(
  z.object({
    focalX: z.number().min(0).max(1),
    focalY: z.number().min(0).max(1),
    watermarkAnchor: watermarkAnchorSchema.optional(),
  }).strict(),
)

export const verifiedAssetDtoSchema = z.object({
  assetId: resourceIdSchema,
  version: resourceVersionSchema,
  role: mediaRoleSchema,
  status: z.enum(['PENDING', 'READY', 'FAILED']),
  mimeType: imageContentTypeSchema,
  byteSize: z.number().int().min(1).max(30_000_000),
  width: z.number().int().min(1).max(12_000),
  height: z.number().int().min(1).max(12_000),
  exifOrientation: z.number().int().min(1).max(8),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
  fitMode: fitModeSchema,
  watermarkAnchor: watermarkAnchorSchema,
  processingFailureCode: uploadFailureCodeSchema.nullable(),
  processingFailureStage: z.literal('PREPROCESS').nullable(),
  previews: z.array(z.object({
    usage: z.enum([
      'work-card',
      'detail',
      'design-sheet',
      'home-hero-landscape',
      'home-hero-portrait',
    ]),
    aspect: previewAspectSchema,
    fitMode: fitModeSchema,
  }).strict()),
}).strict()

export const completeUploadSessionResponseSchema = apiSuccessSchema(z.object({
  session: uploadSessionDtoSchema,
  asset: verifiedAssetDtoSchema,
}).strict())

export const conditionalPutDtoSchema = z.object({
  method: z.literal('PUT'),
  url: z.string().url(),
  expiresAt: z.string().datetime({ offset: true }),
  headers: z.object({
    'Content-Type': imageContentTypeSchema,
    'Content-MD5': z.string().regex(/^[A-Za-z0-9+/]{22}==$/u),
    'x-oss-meta-sha256': z.string().regex(/^[0-9a-f]{64}$/u),
    'x-oss-forbid-overwrite': z.literal('true'),
  }).strict(),
}).strict()

export const createUploadSessionResponseSchema = apiSuccessSchema(z.object({
  session: uploadSessionDtoSchema,
  upload: conditionalPutDtoSchema,
}).strict())

export const uploadSessionResponseSchema = apiSuccessSchema(
  uploadSessionDtoSchema,
)

export const uploadSessionMutationRequestSchema = versionedRequestSchema(
  z.object({}).strict(),
)

export const retryAssetProcessingRequestSchema = uploadSessionMutationRequestSchema
export const retryAssetProcessingResponseSchema = apiSuccessSchema(
  verifiedAssetDtoSchema,
)

export const retryUploadSessionResponseSchema
  = createUploadSessionResponseSchema

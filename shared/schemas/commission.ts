import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
} from './api'
import {
  conditionalPutDtoSchema,
  imageContentTypeSchema,
  uploadFailureCodeSchema,
  uploadFailureStageSchema,
} from './upload'

export const COMMISSION_UPLOAD_STATUS_VALUES = [
  'AWAITING_UPLOAD',
  'VALIDATING',
  'COMPLETED',
  'CONSUMED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const

export const commissionUploadStatusSchema = z.enum(
  COMMISSION_UPLOAD_STATUS_VALUES,
)

export const commissionUploadExpectedSchema = z.object({
  contentType: imageContentTypeSchema,
  byteSize: z.number().int().min(1).max(20_000_000),
  contentMd5: z.string().regex(/^[A-Za-z0-9+/]{22}==$/u),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  width: z.number().int().min(64).max(12_000),
  height: z.number().int().min(64).max(12_000),
}).strict()

export const createCommissionUploadRequestSchema = z.object({
  expected: commissionUploadExpectedSchema,
  // Honeypot: real clients leave this absent or empty.
  website: z.string().max(0).optional(),
}).strict()

export const commissionUploadSessionDtoSchema = z.object({
  uploadSessionId: resourceIdSchema,
  status: commissionUploadStatusSchema,
  version: resourceVersionSchema,
  failureCode: uploadFailureCodeSchema.nullable(),
  failureStage: uploadFailureStageSchema.nullable(),
  assetId: resourceIdSchema.nullable(),
  createdAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
}).strict()

export const createCommissionUploadResponseSchema = apiSuccessSchema(z.object({
  session: commissionUploadSessionDtoSchema,
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
  upload: conditionalPutDtoSchema,
}).strict())

export const completeCommissionUploadRequestSchema = z.object({
  expectedVersion: resourceVersionSchema,
}).strict()

export const completeCommissionUploadResponseSchema = apiSuccessSchema(z.object({
  session: commissionUploadSessionDtoSchema,
}).strict())

export const commissionSubmissionStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
])

export const commissionSubmissionListItemDtoSchema = z.object({
  id: resourceIdSchema,
  receiptCode: z.string().min(8).max(24),
  nickname: z.string().min(1).max(50),
  status: commissionSubmissionStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  version: resourceVersionSchema,
}).strict()

export const commissionSubmissionDetailDtoSchema
  = commissionSubmissionListItemDtoSchema.extend({
    phone: z.object({
      countryCode: z.literal('+86'),
      number: z.string().regex(/^1[3-9]\d{9}$/u),
    }).strict(),
    qq: z.string().regex(/^[1-9]\d{4,11}$/u),
    heightCm: z.number().int().min(80).max(250),
    weightKg: z.number().min(20).max(300),
    internalNote: z.string().max(2_000).nullable(),
    updatedAt: z.string().datetime({ offset: true }),
    handledAt: z.string().datetime({ offset: true }).nullable(),
    designReferencePreviewHref: z.string().regex(
      /^\/api\/admin\/v1\/commissions\/[0-9a-f-]+\/design-reference$/u,
    ),
  }).strict()

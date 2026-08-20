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

export const cancelCommissionUploadRequestSchema
  = completeCommissionUploadRequestSchema
export const cancelCommissionUploadResponseSchema
  = completeCommissionUploadResponseSchema
export const retryCommissionUploadRequestSchema
  = completeCommissionUploadRequestSchema
export const retryCommissionUploadResponseSchema
  = createCommissionUploadResponseSchema

const commissionPhoneSchema = z.object({
  countryCode: z.literal('+86'),
  number: z.string().regex(/^1[3-9]\d{9}$/u),
}).strict()

export const createCommissionSubmissionRequestSchema = z.object({
  adultConfirmed: z.literal(true),
  uploadSessionId: resourceIdSchema,
  expectedUploadVersion: resourceVersionSchema,
  nickname: z.string().trim().min(1).max(50),
  species: z.string().trim().min(1).max(50),
  phone: commissionPhoneSchema,
  qq: z.string().regex(/^[1-9]\d{4,11}$/u),
  heightCm: z.number().int().min(80).max(250),
  weightKg: z.number().min(20).max(300).multipleOf(0.1),
  privacyNoticeAcknowledged: z.literal(true),
  // Honeypot: real clients leave this absent or empty.
  website: z.string().max(0).optional(),
}).strict()

export const createCommissionSubmissionResponseSchema = apiSuccessSchema(
  z.object({
    receiptCode: z.string().regex(/^[A-Z0-9-]{8,24}$/u),
  }).strict(),
)

export const commissionSubmissionStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
])

export const commissionSubmissionListItemDtoSchema = z.object({
  id: resourceIdSchema,
  receiptCode: z.string().min(8).max(24),
  nickname: z.string().min(1).max(50),
  species: z.string().min(1).max(50).nullable(),
  status: commissionSubmissionStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  version: resourceVersionSchema,
}).strict()

export const commissionSubmissionDetailDtoSchema
  = commissionSubmissionListItemDtoSchema.extend({
    phone: commissionPhoneSchema,
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

export const commissionSubmissionListResponseSchema = apiSuccessSchema(
  z.array(commissionSubmissionListItemDtoSchema),
)
export const commissionSubmissionDetailResponseSchema = apiSuccessSchema(
  commissionSubmissionDetailDtoSchema,
)
export const updateCommissionSubmissionRequestSchema = z.object({
  expectedVersion: resourceVersionSchema,
  payload: z.object({
    status: commissionSubmissionStatusSchema,
    internalNote: z.string().trim().min(1).max(2_000).nullable(),
  }).strict(),
}).strict()
export const updateCommissionSubmissionResponseSchema
  = commissionSubmissionDetailResponseSchema

export const COMMISSION_DELETE_CONFIRMATION
  = 'DELETE COMMISSION APPLICATION DATA' as const

export const commissionRetentionCandidateDtoSchema = z.object({
  submissionIdDigest: z.string().regex(/^[0-9a-f]{16}$/u),
  maskedReceiptCode: z.string().min(3).max(24),
  status: z.enum(['pending', 'rejected']),
  createdAt: z.string().datetime({ offset: true }),
  handledAt: z.string().datetime({ offset: true }).nullable(),
  reason: z.enum([
    'REJECTED_READY_FOR_DELETION',
    'STALE_PENDING_REVIEW',
  ]),
}).strict()

export const commissionRetentionListResponseSchema = apiSuccessSchema(
  z.array(commissionRetentionCandidateDtoSchema),
)

export const commissionDeletionBlockerSchema = z.enum([
  'ASSET_RELATION_INVALID',
  'EXTERNAL_REFERENCE_FOUND',
  'PRIVATE_VARIANT_INVALID',
  'STATUS_NOT_REJECTED',
  'STORAGE_INSPECTION_FAILED',
  'UPLOAD_SESSION_RELATION_INVALID',
])

export const commissionDeletionResultDtoSchema = z.object({
  status: z.enum(['already_deleted', 'blocked', 'deleted', 'ready']),
  databaseRows: z.object({
    assets: z.number().int().nonnegative(),
    auditRelations: z.number().int().nonnegative(),
    submissions: z.number().int().nonnegative(),
    uploadSessions: z.number().int().nonnegative(),
    variants: z.number().int().nonnegative(),
  }).strict(),
  privateObjects: z.object({
    current: z.number().int().nonnegative(),
    deleteMarkers: z.number().int().nonnegative(),
    keys: z.number().int().nonnegative(),
    versions: z.number().int().nonnegative(),
  }).strict(),
  blockers: z.array(commissionDeletionBlockerSchema),
}).strict()

export const commissionDeletionRequestSchema = z.discriminatedUnion('execute', [
  z.object({ execute: z.literal(false) }).strict(),
  z.object({
    execute: z.literal(true),
    confirmation: z.literal(COMMISSION_DELETE_CONFIRMATION),
  }).strict(),
])

export const commissionDeletionResponseSchema = apiSuccessSchema(
  commissionDeletionResultDtoSchema,
)

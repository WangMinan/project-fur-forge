import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import { publicationStatusSchema } from './work'

export const PUBLICATION_OPERATION_STATUS_VALUES = [
  'PREPARING_SOURCE',
  'GENERATING_PUBLIC',
  'APPLYING_WATERMARK',
  'VERIFYING_PUBLIC',
  'COMMITTING',
  'CLEANING_PUBLIC',
  'FAILED',
  'DONE',
] as const

export const PUBLICATION_FAILURE_STAGE_VALUES = [
  'PREPARING_SOURCE',
  'VALIDATING',
  'GENERATING_PUBLIC',
  'APPLYING_WATERMARK',
  'VERIFYING_PUBLIC',
  'COMMITTING',
  'CLEANING_PUBLIC',
] as const

export const EDGE_PURGE_STATUS_VALUES = [
  'NOT_REQUIRED',
  'PENDING',
  'PURGING',
  'COMPLETE',
  'FAILED',
] as const

export const PUBLICATION_BLOCKER_VALUES = [
  'WORK_FIELDS_INVALID',
  'ADOPTION_STATUS_REQUIRED',
  'ADOPTION_COVER_REQUIRED',
  'ADOPTION_COVER_NOT_READY',
  'ADOPTION_COVER_ALT_REQUIRED',
  'ADOPTION_MEDIA_REQUIRED',
  'DESIGN_SHEET_NOT_READY',
  'DESIGN_SHEET_SOURCE_TOO_SMALL',
  'DESIGN_SHEET_ALT_REQUIRED',
  'STUDIO_PHOTO_REQUIRED',
  'PRIMARY_STUDIO_PHOTO_REQUIRED',
  'STUDIO_PHOTO_NOT_READY',
  'STUDIO_PHOTO_ALT_REQUIRED',
  'WATERMARK_PROFILE_REQUIRED',
] as const

export const publicationOperationStatusSchema = z.enum(
  PUBLICATION_OPERATION_STATUS_VALUES,
)
export const publicationFailureStageSchema = z.enum(
  PUBLICATION_FAILURE_STAGE_VALUES,
)
export const publicationBlockerSchema = z.enum(PUBLICATION_BLOCKER_VALUES)
export const edgePurgeStatusSchema = z.enum(EDGE_PURGE_STATUS_VALUES)

export const publicationOperationDtoSchema = z.object({
  operationId: resourceIdSchema,
  operationType: z.enum(['PUBLISH', 'UNPUBLISH', 'UPSCALE']),
  entityId: resourceIdSchema,
  requestedVersion: resourceVersionSchema,
  status: publicationOperationStatusSchema,
  failureStage: publicationFailureStageSchema.nullable(),
  failureCode: z.string().min(1).max(100).nullable(),
  cleanupPendingCount: z.number().int().nonnegative(),
  edgePurgeStatus: edgePurgeStatusSchema,
  edgePurgeFailureReason: z.string().min(1).max(100).nullable(),
  edgePurgeFileCount: z.number().int().min(0).max(1_000),
  version: resourceVersionSchema,
  startedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).nullable(),
}).strict()

export const workPublicationCheckDtoSchema = z.object({
  workId: resourceIdSchema,
  version: resourceVersionSchema,
  canPublish: z.boolean(),
  blockers: z.array(publicationBlockerSchema),
  adoptionCoverCount: z.number().int().min(0).max(1),
  adoptionCoverNeedsPreprocess: z.boolean(),
  designSheetCount: z.number().int().min(0).max(1),
  designSheetNeedsPreprocess: z.boolean(),
  studioPhotoCount: z.number().int().min(0).max(5),
  studioPhotoNeedsPreprocess: z.boolean(),
  requiredVariantCount: z.number().int().nonnegative(),
  missingVariantCount: z.number().int().nonnegative(),
}).strict()

export const publicationWorkStateDtoSchema = z.object({
  workId: resourceIdSchema,
  version: resourceVersionSchema,
  publicationStatus: publicationStatusSchema,
}).strict()

export const publicationMutationRequestSchema = versionedRequestSchema(
  z.object({}).strict(),
)

export const publicationActionResponseSchema = apiSuccessSchema(z.object({
  operation: publicationOperationDtoSchema,
  work: publicationWorkStateDtoSchema,
}).strict())
export const publicationOperationResponseSchema = apiSuccessSchema(
  publicationOperationDtoSchema,
)
export const workPublicationCheckResponseSchema = apiSuccessSchema(
  workPublicationCheckDtoSchema,
)

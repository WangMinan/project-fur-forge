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

export const PUBLICATION_BLOCKER_VALUES = [
  /** T37：展会掉落缺少展会名称或展会时间。 */
  'EVENT_DROP_FIELDS_REQUIRED',
  'WORK_FIELDS_INVALID',
  'DESIGN_SHEET_REQUIRED',
  'DESIGN_SHEET_NOT_READY',
  'DESIGN_SHEET_SOURCE_TOO_SMALL',
  'DESIGN_SHEET_ALT_REQUIRED',
  'STUDIO_PHOTO_REQUIRED',
  'PRIMARY_STUDIO_PHOTO_REQUIRED',
  'STUDIO_PHOTO_NOT_READY',
  'STUDIO_PHOTO_SOURCE_TOO_SMALL',
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

export const publicationOperationDtoSchema = z.object({
  operationId: resourceIdSchema,
  operationType: z.enum(['PUBLISH', 'UNPUBLISH', 'UPSCALE']),
  entityId: resourceIdSchema,
  requestedVersion: resourceVersionSchema,
  status: publicationOperationStatusSchema,
  failureStage: publicationFailureStageSchema.nullable(),
  failureCode: z.string().min(1).max(100).nullable(),
  cleanupPendingCount: z.number().int().nonnegative(),
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
  designSheetCount: z.number().int().min(0).max(1),
  studioPhotoCount: z.number().int().min(0).max(5),
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

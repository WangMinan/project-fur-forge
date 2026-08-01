import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import { publicationStatusSchema } from './work'

export const PUBLICATION_OPERATION_STATUS_VALUES = [
  'GENERATING_PUBLIC',
  'APPLYING_WATERMARK',
  'VERIFYING_PUBLIC',
  'COMMITTING',
  'CLEANING_PUBLIC',
  'FAILED',
  'DONE',
] as const

export const PUBLICATION_FAILURE_STAGE_VALUES = [
  'VALIDATING',
  'GENERATING_PUBLIC',
  'APPLYING_WATERMARK',
  'VERIFYING_PUBLIC',
  'COMMITTING',
  'CLEANING_PUBLIC',
] as const

export const PUBLICATION_BLOCKER_VALUES = [
  'ADOPTION_FLOW_NOT_READY',
  'WORK_FIELDS_INVALID',
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

export const publicationOperationDtoSchema = z.object({
  operationId: resourceIdSchema,
  operationType: z.enum(['PUBLISH', 'UNPUBLISH']),
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
  studioPhotoCount: z.number().int().min(0).max(5),
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

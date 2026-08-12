import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import { publicationStatusSchema } from './work'

export const UPDATE_TYPE_VALUES = [
  'event',
  'drop',
  'commission_open',
  'other',
] as const

export const updateTypeSchema = z.enum(UPDATE_TYPE_VALUES)

export const updateFieldsSchema = z.object({
  type: updateTypeSchema,
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20_000),
}).strict()

export const adminUpdateDtoSchema = updateFieldsSchema.extend({
  id: resourceIdSchema,
  publicationStatus: publicationStatusSchema,
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  version: resourceVersionSchema.refine(version => version > 0),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict()

/** 公开投影仅包含访客展示所需字段，不暴露版本或内部时间。 */
export const publicUpdateDtoSchema = updateFieldsSchema.extend({
  id: resourceIdSchema,
  publishedAt: z.string().datetime({ offset: true }),
}).strict()

export const createUpdateRequestSchema = updateFieldsSchema
export const updateUpdateRequestSchema = versionedRequestSchema(
  updateFieldsSchema,
)
export const mutateUpdateRequestSchema = versionedRequestSchema(
  z.object({}).strict(),
)

export const adminUpdateResponseSchema = apiSuccessSchema(adminUpdateDtoSchema)
export const adminUpdateListResponseSchema = apiSuccessSchema(
  z.array(adminUpdateDtoSchema),
)
export const deleteUpdateResponseSchema = apiSuccessSchema(
  z.object({ id: resourceIdSchema }).strict(),
)
export const publicUpdateListResponseSchema = apiSuccessSchema(
  z.array(publicUpdateDtoSchema),
)

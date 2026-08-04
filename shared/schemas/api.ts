import { z } from 'zod'

export const ERROR_CODE_VALUES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'HOST_NOT_ALLOWED',
  'INTERNAL_ERROR',
] as const

export const errorCodeSchema = z.enum(ERROR_CODE_VALUES)

export const resourceIdSchema = z.string().uuid()

export const resourceVersionSchema = z.number()
  .int()
  .nonnegative()

export const idempotencyKeySchema = z.string()
  .trim()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/)

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1).max(200),
  }).strict(),
}).strict()

export function apiSuccessSchema<T extends z.ZodType>(data: T) {
  return z.object({
    data,
  }).strict()
}

export function idempotentRequestSchema<T extends z.ZodType>(payload: T) {
  return z.object({
    idempotencyKey: idempotencyKeySchema,
    payload,
  }).strict()
}

export function versionedRequestSchema<T extends z.ZodType>(payload: T) {
  return z.object({
    expectedVersion: resourceVersionSchema,
    payload,
  }).strict()
}

import { z } from 'zod'

export const ERROR_CODE_VALUES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'HOST_NOT_ALLOWED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const

export const errorCodeSchema = z.enum(ERROR_CODE_VALUES)

/**
 * T34-F4 稳定业务原因。
 *
 * `code` 是通用类别，`reason` 是稳定业务原因，`message` 是可改的说明文字。
 * 前端业务分支只允许匹配 `reason`；服务端英文 `message` 可以随时改写，
 * 不影响任何前端判断。新增业务分支必须先在此登记 reason。
 */
export const ERROR_REASON_VALUES = [
  // 通用
  'VERSION_CONFLICT',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  // Hero / 首页
  'HERO_LAST_ENABLED_SLIDE',
  'HERO_LAST_ENABLED_ITEM',
  'HERO_SLIDE_ENABLED',
  'HERO_ASSETS_NOT_READY',
  'HERO_ASSET_ALREADY_ASSIGNED',
  'HERO_ASSETS_REQUIRE_UPSCALE',
  'HERO_ORDER_STALE',
  'HERO_SLOT_LIMIT',
  'LINKED_WORK_NOT_PUBLISHED',
  // 作品
  'WORK_FIELDS_INVALID',
  'WORK_SLUG_TAKEN',
  'WORK_PUBLISHED_READONLY',
  'WORK_DESIGN_SHEET_PRESENT',
  'WORK_PUBLICATION_BLOCKED',
  'ASSET_ALREADY_LINKED',
  'FEATURED_ORDER_CONFLICT',
  // 媒体 / 发布
  'ACTIVE_OPERATION_EXISTS',
  'OPERATION_NOT_RETRYABLE',
  'PUBLICATION_CLEANUP_PENDING',
  'PUBLIC_VARIANT_INCOMPLETE',
  'MEDIA_SOURCE_TOO_SMALL',
  'MEDIA_SOURCE_UNAVAILABLE',
  'UPLOAD_SESSION_EXPIRED',
  // 委托投递
  'COMMISSION_PHONE_PENDING',
  'COMMISSION_PRIVACY_POLICY_NOT_READY',
  'COMMISSION_DELETE_BLOCKED',
  'COMMISSION_DELETE_IN_PROGRESS',
  // 水印
  'WATERMARK_DRAFT_STALE',
  'WATERMARK_PREVIEW_REQUIRED',
  'WATERMARK_PROFILE_UNAVAILABLE',
] as const

export const errorReasonSchema = z.enum(ERROR_REASON_VALUES)

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
    /** 稳定业务原因；通用失败（如 500）可以没有。 */
    reason: errorReasonSchema.optional(),
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

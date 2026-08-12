import { z } from 'zod'
import {
  resourceIdSchema,
  resourceVersionSchema,
} from './api'

export const MEDIA_ROLE_VALUES = [
  'design_sheet',
  'studio_photo',
  'home_hero_landscape',
  'home_hero_portrait',
  'watermark_logo',
  /** T36 返图私有永久原图；不得与 studio_photo 互相冒充。 */
  'return_photo',
  'contact_qr',
] as const

export const ASSET_STATUS_VALUES = [
  'PENDING',
  'READY',
  'FAILED',
] as const

export const mediaRoleSchema = z.enum(MEDIA_ROLE_VALUES)
export const assetStatusSchema = z.enum(ASSET_STATUS_VALUES)

const publicAltContactPattern = /(?:https?:\/\/|mailto:|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:QQ|微信|VX|电话|手机)\s*[:：]?\s*[A-Z0-9_-]{5,})/iu

export const publicAltSchema = z.string()
  .trim()
  .min(1)
  .max(500)
  .refine(value => Array.from(value).every((character) => {
    const code = character.codePointAt(0) ?? 0
    return code > 31 && code !== 127
  }))
  .refine(value => !publicAltContactPattern.test(value))

export const adminAssetDtoSchema = z.object({
  assetId: resourceIdSchema,
  version: resourceVersionSchema,
  role: mediaRoleSchema,
  status: assetStatusSchema,
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
}).strict()

export const publicVariantDtoSchema = z.object({
  src: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.enum(['webp', 'jpeg', 'png']),
}).strict()

const publicWebpVariantDtoSchema = publicVariantDtoSchema.extend({
  format: z.literal('webp'),
})

const publicFallbackVariantDtoSchema = publicVariantDtoSchema.extend({
  format: z.enum(['jpeg', 'png']),
})

export const publicSourceSetDtoSchema = z.object({
  webp: z.array(publicWebpVariantDtoSchema).min(1),
  fallback: z.array(publicFallbackVariantDtoSchema).min(1),
}).strict()

/** 二维码保持 PNG，不生成会影响边缘清晰度的有损或 WebP 版本。 */
export const publicPngSourceSetDtoSchema = z.object({
  webp: z.array(publicWebpVariantDtoSchema).max(0),
  fallback: z.array(publicVariantDtoSchema.extend({
    format: z.literal('png'),
  })).min(1),
}).strict()

export const publicHeroSlideDtoSchema = z.object({
  alt: publicAltSchema,
  sortOrder: z.number().int().min(0).max(4),
  landscape: publicSourceSetDtoSchema,
  portrait: publicSourceSetDtoSchema,
  linkedWorkHref: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(),
}).strict()

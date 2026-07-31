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
] as const

export const ASSET_STATUS_VALUES = [
  'PENDING',
  'READY',
  'FAILED',
] as const

export const mediaRoleSchema = z.enum(MEDIA_ROLE_VALUES)
export const assetStatusSchema = z.enum(ASSET_STATUS_VALUES)

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
  variantId: resourceIdSchema,
  src: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.enum(['webp', 'jpeg', 'png']),
}).strict()

export const publicHeroSlideDtoSchema = z.object({
  id: resourceIdSchema,
  version: resourceVersionSchema,
  alt: z.string().trim().min(1).max(500),
  sortOrder: z.number().int().min(0).max(4),
  landscape: z.array(publicVariantDtoSchema).min(1),
  portrait: z.array(publicVariantDtoSchema).min(1),
  linkedWorkSlug: z.string().min(1).max(120).nullable(),
}).strict()

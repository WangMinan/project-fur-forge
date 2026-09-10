import { z } from 'zod'

export const COMPOSITION_USAGES = ['detail-thumbnail', 'work-catalog', 'home-featured', 'adoption-catalog', 'home-adoption'] as const
export const compositionUsageSchema = z.enum(COMPOSITION_USAGES)
export type CompositionUsage = z.infer<typeof compositionUsageSchema>
export const cropRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).strict().refine(rect => rect.x + rect.width <= 1 && rect.y + rect.height <= 1, '裁切区域超出图片边界')
export type CropRect = z.infer<typeof cropRectSchema>
export const imageCompositionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('contain') }).strict(),
  z.object({ mode: z.literal('crop'), rect: cropRectSchema }).strict(),
])
export type ImageComposition = z.infer<typeof imageCompositionSchema>
export const imageCompositionsSchema = z.partialRecord(compositionUsageSchema, imageCompositionSchema.nullable())
export type ImageCompositions = z.infer<typeof imageCompositionsSchema>

export const adoptionCoverSourceSchema = z.enum(['auto', 'adoption_cover', 'design_sheet'])
export const workDisplaySettingsSchema = z.object({
  showAdoptionCoverInDetail: z.boolean(),
  showDesignSheetInDetail: z.boolean(),
  adoptionCoverSource: adoptionCoverSourceSchema,
}).strict()
export type WorkDisplaySettings = z.infer<typeof workDisplaySettingsSchema>

import { z } from 'zod'
import { apiSuccessSchema, resourceIdSchema } from './api'
import {
  publicAltSchema,
  publicSourceSetDtoSchema,
} from './media'
import {
  publicAdoptionWorkDtoSchema,
  publicWorkDtoSchema,
  suitTypeSchema,
  workPurposeSchema,
} from './work'

export const publicWorkCardDtoSchema = z.object({
  assetId: resourceIdSchema,
  alt: publicAltSchema,
  sources: publicSourceSetDtoSchema,
}).strict()

export const publicWorkGalleryItemDtoSchema = z.object({
  assetId: resourceIdSchema,
  alt: publicAltSchema,
  position: z.number().int().min(0).max(4),
  sources: publicSourceSetDtoSchema,
}).strict()

export const publicDesignSheetDtoSchema = z.object({
  assetId: resourceIdSchema,
  alt: publicAltSchema,
  sources: publicSourceSetDtoSchema,
}).strict()

export const publicWorkSummaryDtoSchema = z.object({
  work: publicWorkDtoSchema,
  href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  card: publicWorkCardDtoSchema,
}).strict()

export const publicWorkDetailDtoSchema = z.object({
  work: publicWorkDtoSchema,
  href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  media: z.object({
    primaryAssetId: resourceIdSchema.nullable(),
    primaryStudioPhotoAssetId: resourceIdSchema.nullable(),
    card: publicWorkCardDtoSchema,
    gallery: z.array(publicWorkGalleryItemDtoSchema).max(5),
    designSheet: publicDesignSheetDtoSchema.optional(),
    studioPhotos: z.array(publicWorkGalleryItemDtoSchema).max(5),
  }).strict(),
  navigation: z.object({
    previous: z.object({
      characterName: z.string().trim().min(1).max(120),
      href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
    }).strict().nullable(),
    next: z.object({
      characterName: z.string().trim().min(1).max(120),
      href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
    }).strict().nullable(),
  }).strict().default({ previous: null, next: null }),
  related: z.array(publicWorkSummaryDtoSchema).max(3),
}).strict()

export const publicWorkFilterStateSchema = z.object({
  valid: z.boolean(),
  purpose: workPurposeSchema.nullable(),
  suitType: suitTypeSchema.nullable(),
}).strict()

export const publicWorkListDtoSchema = z.object({
  items: z.array(publicWorkSummaryDtoSchema),
  resultCount: z.number().int().nonnegative(),
  filter: publicWorkFilterStateSchema,
}).strict()

export const publicFeaturedWorksDtoSchema = z.object({
  items: z.array(publicWorkSummaryDtoSchema).max(6),
  resultCount: z.number().int().min(0).max(6),
}).strict()

export const publicAdoptionListItemDtoSchema = z.object({
  work: publicAdoptionWorkDtoSchema.extend({
    adoptionMethod: z.literal('regular'),
  }),
  href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  designSheet: publicDesignSheetDtoSchema,
}).strict()

export const publicAdoptionListDtoSchema = z.object({
  items: z.array(publicAdoptionListItemDtoSchema),
  resultCount: z.number().int().nonnegative(),
}).strict()

export const publicWorkListQuerySchema = z.object({
  purpose: workPurposeSchema.optional(),
  suitType: suitTypeSchema.optional(),
}).strict()

export const publicWorkDetailResponseSchema = apiSuccessSchema(
  publicWorkDetailDtoSchema,
)
export const publicWorkListResponseSchema = apiSuccessSchema(
  publicWorkListDtoSchema,
)
export const publicFeaturedWorksResponseSchema = apiSuccessSchema(
  publicFeaturedWorksDtoSchema,
)
export const publicAdoptionListResponseSchema = apiSuccessSchema(
  publicAdoptionListDtoSchema,
)

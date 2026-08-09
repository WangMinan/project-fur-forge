import { z } from 'zod'
import { apiSuccessSchema, resourceIdSchema } from './api'
import {
  publicHomeDtoSchema,
  publicHomeEntryDtoSchema,
} from './home'
import {
  publicAltSchema,
  publicSourceSetDtoSchema,
} from './media'
import { publicSiteBusinessStatusDtoSchema } from './site-content'
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

/** 公开图片列表固定页长；访客端不提供每页数量选择。 */
export const PUBLIC_WORKS_PAGE_SIZE = 12
export const PUBLIC_ADOPTIONS_PAGE_SIZE = 8

export const publicCatalogPageQuerySchema = z.object({
  page: z.number().int().min(1).max(10_000).optional(),
}).strict()

export const publicWorkListDtoSchema = z.object({
  items: z.array(publicWorkSummaryDtoSchema),
  resultCount: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.literal(PUBLIC_WORKS_PAGE_SIZE),
  pageCount: z.number().int().nonnegative(),
  filter: publicWorkFilterStateSchema,
}).strict()

export const publicFeaturedWorksDtoSchema = z.object({
  items: z.array(publicWorkSummaryDtoSchema).max(6),
  resultCount: z.number().int().min(0).max(6),
}).strict()

/** T37：领养列表同时容纳常规领养与展会掉落。 */
export const publicAdoptionListItemDtoSchema = z.object({
  work: publicAdoptionWorkDtoSchema,
  href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  designSheet: publicDesignSheetDtoSchema,
}).strict()

/** `/adoptions` 的轻量筛选：全部 / 常规领养 / 展会掉落。 */
export const PUBLIC_ADOPTION_FILTER_VALUES = [
  'all',
  'regular',
  'event_drop',
] as const

export const publicAdoptionFilterSchema = z.enum(
  PUBLIC_ADOPTION_FILTER_VALUES,
)

export const publicAdoptionListQuerySchema = z.object({
  method: publicAdoptionFilterSchema.optional(),
}).strict()

export const publicAdoptionListDtoSchema = z.object({
  items: z.array(publicAdoptionListItemDtoSchema),
  resultCount: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.literal(PUBLIC_ADOPTIONS_PAGE_SIZE),
  pageCount: z.number().int().nonnegative(),
  /** 当前筛选状态；非法值收敛为 all 并标记 valid=false。 */
  filter: z.object({
    valid: z.boolean(),
    method: publicAdoptionFilterSchema,
  }).strict(),
  /** 各筛选下的真实数量，用于区分“没有领养”与“没有掉落”。 */
  counts: z.object({
    all: z.number().int().nonnegative(),
    regular: z.number().int().nonnegative(),
    event_drop: z.number().int().nonnegative(),
  }).strict(),
}).strict()

export const publicWorkListQuerySchema = z.object({
  purpose: workPurposeSchema.optional(),
  suitType: suitTypeSchema.optional(),
}).strict()

/**
 * T34-F2 首页聚合投影。
 * 非关键区块用 `available` 表达受控降级：Hero、导航和页面骨架不因精选作品或
 * 当前领养异常而整体 500，也不把服务端错误详情暴露给匿名访客。
 */
function homeSectionSchema<T extends z.ZodType>(item: T) {
  return z.object({
    available: z.boolean(),
    items: z.array(item),
  }).strict()
}

/** 统一业务入口卡：图片、标题、状态、短说明和单一行动入口。 */
export const publicHomeEntryCardDtoSchema = publicHomeEntryDtoSchema.extend({
  title: z.string().trim().min(1).max(40),
  status: publicSiteBusinessStatusDtoSchema.nullable(),
  summary: z.string().trim().min(1).max(240).nullable(),
}).strict()

export const publicHomeAggregateDtoSchema = z.object({
  hero: publicHomeDtoSchema,
  entries: z.object({
    commission: publicHomeEntryCardDtoSchema.nullable(),
    adoption: publicHomeEntryCardDtoSchema.nullable(),
  }).strict(),
  featured: homeSectionSchema(publicWorkSummaryDtoSchema),
  currentAdoptions: homeSectionSchema(publicAdoptionListItemDtoSchema),
}).strict()

export const publicHomeAggregateResponseSchema = apiSuccessSchema(
  publicHomeAggregateDtoSchema,
)

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

import { z } from 'zod'
import { PUBLIC_FEATURED_LIMIT } from '../constants/featured'
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

/**
 * 卡片方向：`portrait` 为 3:4 primary 出厂照，`landscape` 为仅有横版领养封面
 * （只做了单头、客户尚未提供 DTD 的领养作品）时的回落。默认竖版保持既有行为。
 */
export const publicWorkCardOrientationSchema = z
  .enum(['landscape', 'portrait'])
  .default('portrait')

export const publicWorkSummaryDtoSchema = z.object({
  work: publicWorkDtoSchema,
  href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  card: publicWorkCardDtoSchema,
  cardOrientation: publicWorkCardOrientationSchema,
}).strict()

export const publicWorkDetailDtoSchema = z.object({
  work: publicWorkDtoSchema,
  href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  media: z.object({
    primaryAssetId: resourceIdSchema.nullable(),
    card: publicWorkCardDtoSchema,
    cardOrientation: publicWorkCardOrientationSchema,
    /** 领养作品的横版封面；只做了单头时是详情页唯一的成果图。 */
    adoptionCover: publicWorkCardDtoSchema.optional(),
    gallery: z.array(publicWorkGalleryItemDtoSchema).max(5),
    designSheet: publicDesignSheetDtoSchema.optional(),
  }).strict(),
  related: z.array(publicWorkSummaryDtoSchema).max(3),
}).strict()

export const publicWorkFilterStateSchema = z.object({
  valid: z.boolean(),
}).strict()

/** 公开图片列表固定页长；访客端不提供每页数量选择。 */
export const PUBLIC_WORKS_PAGE_SIZE = 12
export const PUBLIC_ADOPTIONS_PAGE_SIZE = 8

export const publicCatalogSearchQuerySchema = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).max(100).optional(),
)

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
  items: z.array(publicWorkSummaryDtoSchema).max(PUBLIC_FEATURED_LIMIT),
  resultCount: z.number().int().min(0).max(PUBLIC_FEATURED_LIMIT),
}).strict()

export const publicAdoptionListItemDtoSchema = z.object({
  work: publicAdoptionWorkDtoSchema,
  href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  cover: publicWorkCardDtoSchema,
}).strict()

export const publicAdoptionListQuerySchema = z.object({
  q: publicCatalogSearchQuerySchema,
}).strict()

export const publicAdoptionListDtoSchema = z.object({
  items: z.array(publicAdoptionListItemDtoSchema),
  resultCount: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.literal(PUBLIC_ADOPTIONS_PAGE_SIZE),
  pageCount: z.number().int().nonnegative(),
  filter: z.object({ valid: z.boolean() }).strict(),
}).strict()

export const publicWorkListQuerySchema = z.object({
  q: publicCatalogSearchQuerySchema,
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

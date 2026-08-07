import { z } from 'zod'
import {
  apiSuccessSchema,
  resourceIdSchema,
  resourceVersionSchema,
  versionedRequestSchema,
} from './api'
import { publicAltSchema, publicSourceSetDtoSchema } from './media'
import {
  publicationStatusSchema,
  returnPhotoConsentSourceSchema,
  slugSchema,
} from './work'
import { publicationOperationDtoSchema } from './publication'

/**
 * T35/T36 返图契约。
 *
 * 一条返图 = 一件作品 + 一张 `return_photo` 私有原图 + 一个 alt。
 * 授权记录（来源 / 确认时间 / 内部备注）只出现在受认证管理 DTO，
 * 公开 DTO 里没有对应字段，因此不可能因为投影疏漏而泄漏。
 */

/** 公开返图墙每页条数；由 `.design` 与 SPEC 锁定为 24。 */
export const RETURN_WALL_PAGE_SIZE = 24

export const RETURN_PHOTO_BLOCKER_VALUES = [
  'RETURN_PHOTO_WORK_NOT_PUBLISHED',
  'RETURN_PHOTO_ALT_REQUIRED',
  'RETURN_PHOTO_ASSET_REQUIRED',
  'RETURN_PHOTO_ASSET_NOT_READY',
  'RETURN_PHOTO_SOURCE_TOO_SMALL',
  'RETURN_PHOTO_VARIANT_INCOMPLETE',
] as const

export const returnPhotoBlockerSchema = z.enum(RETURN_PHOTO_BLOCKER_VALUES)

/** 授权记录：三项全部可空，缺失不阻止保存或发布。 */
export const returnPhotoAuthorizationSchema = z.object({
  source: returnPhotoConsentSourceSchema.nullable(),
  confirmedAt: z.string().datetime({ offset: true }).nullable(),
  note: z.string().trim().min(1).max(500).nullable(),
}).strict()

const returnPhotoAltSchema = publicAltSchema

export const returnPhotoFieldsSchema = z.object({
  workId: resourceIdSchema,
  alt: returnPhotoAltSchema,
  sortOrder: z.number().int().nonnegative().max(100_000),
  authorization: returnPhotoAuthorizationSchema,
}).strict()

export const createReturnPhotoRequestSchema = returnPhotoFieldsSchema
export const updateReturnPhotoRequestSchema = versionedRequestSchema(
  returnPhotoFieldsSchema,
)
export const deleteReturnPhotoRequestSchema = versionedRequestSchema(
  z.object({}).strict(),
)
export const deleteReturnPhotoResponseSchema = apiSuccessSchema(
  z.object({ id: resourceIdSchema }).strict(),
)

/** 管理端关联作品摘要：只给景宸看得懂的作品事实，不含私有联系人。 */
export const returnPhotoWorkSummarySchema = z.object({
  workId: resourceIdSchema,
  characterName: z.string().trim().min(1).max(100),
  slug: slugSchema,
  publicationStatus: publicationStatusSchema,
}).strict()

/** 受控私有原图摘要：只有 assetId、尺寸和状态，永不返回私有 Object Key。 */
export const returnPhotoAssetSummarySchema = z.object({
  assetId: resourceIdSchema,
  status: z.enum(['PENDING', 'READY', 'FAILED']),
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
}).strict()

export const adminReturnPhotoDtoSchema = z.object({
  id: resourceIdSchema,
  version: resourceVersionSchema,
  publicationStatus: publicationStatusSchema,
  alt: returnPhotoAltSchema,
  sortOrder: z.number().int().nonnegative(),
  work: returnPhotoWorkSummarySchema,
  /** 未上传返图图片时为 null；此时发布检查会给出明确阻断。 */
  asset: returnPhotoAssetSummarySchema.nullable(),
  authorization: returnPhotoAuthorizationSchema,
  /** 无水印公开变体数量；完整时才允许发布。 */
  publicVariantCount: z.number().int().nonnegative(),
  /**
   * 无水印公开预览：直接给出访客会看到的真实衍生图地址。
   * 由服务端计算，管理端因此不需要跨 Host 调用公开接口
   * （管理 Host 会拒绝 `/api/public/**`）。未生成时为 null。
   */
  publicPreview: z.object({
    src: z.string().url(),
    width: z.number().int().positive().max(12_000),
    height: z.number().int().positive().max(12_000),
  }).strict().nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict()

export const returnPhotoPublicationCheckDtoSchema = z.object({
  returnPhotoId: resourceIdSchema,
  version: resourceVersionSchema,
  canPublish: z.boolean(),
  blockers: z.array(returnPhotoBlockerSchema),
  requiredVariantCount: z.number().int().nonnegative(),
  missingVariantCount: z.number().int().nonnegative(),
}).strict()

export const returnPhotoStateDtoSchema = z.object({
  returnPhotoId: resourceIdSchema,
  version: resourceVersionSchema,
  publicationStatus: publicationStatusSchema,
}).strict()

export const adminReturnPhotoListQuerySchema = z.object({
  page: z.number().int().min(1).max(10_000).optional(),
  workId: resourceIdSchema.optional(),
  publicationStatus: publicationStatusSchema.optional(),
}).strict()

export const adminReturnPhotoListDtoSchema = z.object({
  items: z.array(adminReturnPhotoDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  pageCount: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(),
}).strict()

export const adminReturnPhotoResponseSchema = apiSuccessSchema(
  adminReturnPhotoDtoSchema,
)
export const adminReturnPhotoListResponseSchema = apiSuccessSchema(
  adminReturnPhotoListDtoSchema,
)
export const returnPhotoPublicationCheckResponseSchema = apiSuccessSchema(
  returnPhotoPublicationCheckDtoSchema,
)
export const returnPhotoPublicationActionResponseSchema = apiSuccessSchema(
  z.object({
    operation: publicationOperationDtoSchema,
    returnPhoto: returnPhotoStateDtoSchema,
  }).strict(),
)

/**
 * 公开返图 DTO：只有图片、固有尺寸、alt 和关联作品的公开入口。
 * 没有授权记录、返图者信息、日期、私有 Key、签名 URL 或 EXIF 字段。
 */
export const publicReturnPhotoDtoSchema = z.object({
  id: resourceIdSchema,
  image: z.object({
    sources: publicSourceSetDtoSchema,
    width: z.number().int().positive().max(12_000),
    height: z.number().int().positive().max(12_000),
    alt: publicAltSchema,
  }).strict(),
  work: z.object({
    characterName: z.string().trim().min(1).max(100),
    slug: slugSchema,
    href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }).strict(),
}).strict()

export const publicReturnWallDtoSchema = z.object({
  items: z.array(publicReturnPhotoDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  pageCount: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(),
}).strict()

export const publicReturnWallQuerySchema = z.object({
  page: z.number().int().min(1).max(10_000).optional(),
}).strict()

export const publicReturnWallResponseSchema = apiSuccessSchema(
  publicReturnWallDtoSchema,
)

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
import { publicCatalogSearchQuerySchema } from './public-content'

/**
 * T35-F1 返图契约。
 *
 * 两级模型：**设定**（`return_characters`）+ 它的**多张返图**。
 * 设定有自己的名称与可选 `@昵称`，关联作品是可选的，
 * 因此老作品没上过架、甚至没有作品记录时也可以有返图。
 *
 * 授权记录（来源 / 确认时间 / 内部备注）按设定保存，且只出现在受认证
 * 管理 DTO；公开 DTO 里没有对应字段，因此不可能因为投影疏漏而泄漏。
 */

/** 公开返图墙每页条数；由 `.design` 与 SPEC 锁定为 24。 */
export const RETURN_WALL_PAGE_SIZE = 24
export const returnWallSeedSchema = z.string().regex(/^[0-9a-f]{32}$/u)

export const RETURN_PHOTO_BLOCKER_VALUES = [
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

const returnCharacterNameSchema = z.string().trim().min(1).max(100)
/** 昵称公开显示为 `@昵称`，因此这里不再存前导 `@`。 */
const returnCharacterNicknameSchema = z.string().trim().min(1).max(50)

export const returnCharacterFieldsSchema = z.object({
  /**
   * 公开地址 `/returns/{slug}`。设定名称通常是中文，无法自动派生合法 slug，
   * 因此与作品一样由管理员填写，规则和冲突提示也保持一致。
   */
  slug: slugSchema,
  name: returnCharacterNameSchema,
  nickname: returnCharacterNicknameSchema.nullable(),
  /** 可选便利入口：留空是正常状态，不影响返图发布。 */
  workId: resourceIdSchema.nullable(),
  authorization: returnPhotoAuthorizationSchema,
}).strict()

export const createReturnCharacterRequestSchema = returnCharacterFieldsSchema
export const updateReturnCharacterRequestSchema = versionedRequestSchema(
  returnCharacterFieldsSchema,
)
export const deleteReturnCharacterRequestSchema = versionedRequestSchema(
  z.object({}).strict(),
)
export const deleteReturnCharacterResponseSchema = apiSuccessSchema(
  z.object({ id: resourceIdSchema }).strict(),
)

/**
 * 单张返图的可编辑字段：只有 alt。
 * 新增返图靠上传图片本身完成（一个设定可以有多张），
 * 主图与发布状态各有专用接口。
 */
export const returnPhotoFieldsSchema = z.object({
  alt: publicAltSchema,
}).strict()

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
export const returnCharacterWorkSummarySchema = z.object({
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
  characterId: resourceIdSchema,
  publicationStatus: publicationStatusSchema,
  alt: publicAltSchema,
  /** 该设定的封面；一个设定最多一张。 */
  primary: z.boolean(),
  /** 未上传返图图片时为 null；此时发布检查会给出明确阻断。 */
  asset: returnPhotoAssetSummarySchema.nullable(),
  /** 无水印公开变体数量；完整时才允许发布。 */
  publicVariantCount: z.number().int().nonnegative(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict()

export const adminReturnCharacterDtoSchema = z.object({
  id: resourceIdSchema,
  version: resourceVersionSchema,
  slug: slugSchema,
  name: returnCharacterNameSchema,
  nickname: returnCharacterNicknameSchema.nullable(),
  /** 没有关联作品时为 null，是正常状态。 */
  work: returnCharacterWorkSummarySchema.nullable(),
  authorization: returnPhotoAuthorizationSchema,
  photos: z.array(adminReturnPhotoDtoSchema),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict()

/** 设定列表项：不带完整照片数组，只带主图与张数摘要。 */
export const adminReturnCharacterListItemDtoSchema = z.object({
  id: resourceIdSchema,
  version: resourceVersionSchema,
  slug: slugSchema,
  name: returnCharacterNameSchema,
  nickname: returnCharacterNicknameSchema.nullable(),
  work: returnCharacterWorkSummarySchema.nullable(),
  /** 主图的 assetId；没有主图时为 null。 */
  primaryAssetId: resourceIdSchema.nullable(),
  photoCount: z.number().int().nonnegative(),
  publishedPhotoCount: z.number().int().nonnegative(),
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

export const adminReturnCharacterListQuerySchema = z.object({
  page: z.number().int().min(1).max(10_000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  /** 按名称或昵称查找；服务端做包含匹配。 */
  query: z.string().trim().min(1).max(100).optional(),
}).strict()

export const adminReturnCharacterListDtoSchema = z.object({
  items: z.array(adminReturnCharacterListItemDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  pageCount: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(),
}).strict()

export const adminReturnCharacterResponseSchema = apiSuccessSchema(
  adminReturnCharacterDtoSchema,
)
export const adminReturnCharacterListResponseSchema = apiSuccessSchema(
  adminReturnCharacterListDtoSchema,
)
export const adminReturnPhotoResponseSchema = apiSuccessSchema(
  adminReturnPhotoDtoSchema,
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

/** 设定公开身份：名称、可选 `@昵称` 与设定页地址。 */
export const publicReturnCharacterRefSchema = z.object({
  id: resourceIdSchema,
  name: returnCharacterNameSchema,
  nickname: returnCharacterNicknameSchema.nullable(),
  slug: slugSchema,
  href: z.string().regex(/^\/returns\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict()

/** 公开图片：无水印 SourceSet、固有宽高与 alt。没有 EXIF 或私有 Key。 */
export const publicReturnImageSchema = z.object({
  sources: publicSourceSetDtoSchema,
  width: z.number().int().positive().max(12_000),
  height: z.number().int().positive().max(12_000),
  alt: publicAltSchema,
}).strict()

/**
 * 公开返图 DTO：图片本身 + 所属设定入口。
 * 没有授权记录、私有 Key、签名 URL、拍摄日期或 EXIF 字段。
 */
export const publicReturnPhotoDtoSchema = z.object({
  id: resourceIdSchema,
  image: publicReturnImageSchema,
  character: publicReturnCharacterRefSchema,
}).strict()

export const publicReturnWallDtoSchema = z.object({
  items: z.array(publicReturnPhotoDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  pageCount: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(),
  /** 一次浏览的随机顺序身份；分页链接显式传递，避免跨页重复或遗漏。 */
  seed: returnWallSeedSchema,
}).strict()

export const publicReturnWallQuerySchema = z.object({
  page: z.number().int().min(1).max(10_000).optional(),
  q: publicCatalogSearchQuerySchema,
  seed: returnWallSeedSchema.optional(),
}).strict()

export const publicReturnWallResponseSchema = apiSuccessSchema(
  publicReturnWallDtoSchema,
)

/**
 * 公开设定页 DTO：圆形主图 + 名称/昵称 + 该设定全部已发布返图，
 * 外加可选的关联作品入口（没有关联作品时为 null）。
 */
export const publicReturnCharacterDtoSchema = z.object({
  character: publicReturnCharacterRefSchema,
  /** 主图；设定至少有一张已发布返图时才会有值。 */
  primaryImage: publicReturnImageSchema.nullable(),
  photos: z.array(publicReturnPhotoDtoSchema),
  work: z.object({
    characterName: z.string().trim().min(1).max(100),
    slug: slugSchema,
    href: z.string().regex(/^\/works\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }).strict().nullable(),
}).strict()

export const publicReturnCharacterResponseSchema = apiSuccessSchema(
  publicReturnCharacterDtoSchema,
)

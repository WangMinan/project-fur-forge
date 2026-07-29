import type {
  AdoptionMethod,
  BusinessStatus,
  PublicationStatus,
  SuitType,
  WorkPurpose,
} from '../../shared/types/contracts'

/** 公开站与管理端共用的枚举中文标签；纯展示映射，不改变契约值。 */

export const WORK_PURPOSE_LABELS: Record<WorkPurpose, string> = {
  commission: '委托作品',
  adoption: '领养作品',
  showcase: '展示作品',
}

/** 筛选条使用的短标签。 */
export const WORK_PURPOSE_FILTER_LABELS: Record<WorkPurpose, string> = {
  commission: '委托',
  adoption: '领养',
  showcase: '展示',
}

export const SUIT_TYPE_LABELS: Record<SuitType, string> = {
  full: '全装',
  partial: '半装',
}

export const ADOPTION_METHOD_LABELS: Record<AdoptionMethod, string> = {
  regular: '常规领养',
  event_drop: '展会掉落',
}

export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  preparing: '准备中',
  available: '可领养',
  event_sale: '展会出售中',
  scheduled: '排期中',
  in_production: '制作中',
  delivered: '已完成交付',
}

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: '草稿',
  published: '已发布',
  unpublished: '已下架',
}

import type {
  AdoptionStatus,
  PublicationStatus,
  WorkPurpose,
} from '../../shared/types/contracts'

export const WORK_PURPOSE_LABELS: Record<WorkPurpose, string> = {
  commission: '委托作品',
  adoption: '领养作品',
  showcase: '纯展示',
}

export const ADOPTION_STATUS_LABELS: Record<AdoptionStatus, string> = {
  available: '可领养',
  adopted: '已领养',
}

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: '草稿',
  published: '已发布',
  unpublished: '已下架',
}

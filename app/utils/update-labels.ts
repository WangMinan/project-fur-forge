import type {
  PublicationStatus,
  UpdateType,
} from '~~/shared/types/contracts'

export const UPDATE_TYPE_LABELS: Record<UpdateType, string> = {
  event: '参展资讯',
  drop: '掉落预告',
  commission_open: '开单通知',
  other: '其它',
}

export const UPDATE_PUBLICATION_LABELS: Record<PublicationStatus, string> = {
  draft: '草稿',
  published: '已发布',
  unpublished: '已下架',
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatUpdateDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}

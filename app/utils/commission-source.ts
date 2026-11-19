import type { CommissionSubmissionListItemDto } from '~~/shared/types/contracts'

export function commissionSourceLabel(item: Pick<CommissionSubmissionListItemDto, 'origin' | 'channel' | 'channelLabel'>) {
  if (item.origin !== 'manual') return '官网提交'
  return `后台录入 · ${item.channel === 'qq' ? 'QQ' : item.channel === 'wechat' ? '微信' : item.channelLabel ?? '其他'}`
}

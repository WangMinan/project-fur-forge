import type { SuitType, WorkPurpose } from '../../shared/types/contracts'

/**
 * 作品列表筛选的共享类型。
 * 解析与过滤均在服务端完成（GET /api/public/v1/works 回显 filter），
 * 前端只消费服务端回显的合法状态。
 */
export interface WorkFilter {
  purpose: WorkPurpose | null
  suitType: SuitType | null
}

export const EMPTY_WORK_FILTER: WorkFilter = { purpose: null, suitType: null }

export function isWorkFilterEmpty(filter: WorkFilter): boolean {
  return filter.purpose === null && filter.suitType === null
}

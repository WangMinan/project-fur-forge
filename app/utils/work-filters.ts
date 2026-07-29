import type {
  SuitType,
  WorkPurpose,
} from '../../shared/types/contracts'
import {
  SUIT_TYPE_VALUES,
  WORK_PURPOSE_VALUES,
} from '../../shared/schemas/work'

/**
 * 作品列表“用途 × 装型”交集筛选。
 * 筛选不产生新的 canonical，只通过 query 表达；非法值视为未选。
 */

export interface WorkFilter {
  purpose: WorkPurpose | null
  suitType: SuitType | null
}

export const EMPTY_WORK_FILTER: WorkFilter = {
  purpose: null,
  suitType: null,
}

type RawQueryValue = string | null | (string | null)[] | undefined

function firstValue(value: RawQueryValue): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null
  }
  return typeof value === 'string' ? value : null
}

export function parseWorkFilter(query: Record<string, RawQueryValue>): WorkFilter {
  const purpose = firstValue(query.purpose)
  const suitType = firstValue(query.suit)

  return {
    purpose: (WORK_PURPOSE_VALUES as readonly string[]).includes(purpose ?? '')
      ? (purpose as WorkPurpose)
      : null,
    suitType: (SUIT_TYPE_VALUES as readonly string[]).includes(suitType ?? '')
      ? (suitType as SuitType)
      : null,
  }
}

export function isWorkFilterEmpty(filter: WorkFilter): boolean {
  return filter.purpose === null && filter.suitType === null
}

export function filterWorks<T extends { dto: { purpose: WorkPurpose, suitType: SuitType } }>(
  works: readonly T[],
  filter: WorkFilter,
): T[] {
  return works.filter((work) => {
    if (filter.purpose !== null && work.dto.purpose !== filter.purpose) {
      return false
    }
    if (filter.suitType !== null && work.dto.suitType !== filter.suitType) {
      return false
    }
    return true
  })
}

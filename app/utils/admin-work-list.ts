import type {
  PublicationStatus,
  SuitType,
  WorkPurpose,
} from '../../shared/types/contracts'

export const ADMIN_WORK_PAGE_SIZES = [10, 20, 50] as const

export interface AdminWorkListEntry {
  characterName: string
  species: string
  purpose: WorkPurpose
  publicationStatus: PublicationStatus
  suitType: SuitType
}

export interface AdminWorkListFilters {
  publicationStatus: PublicationStatus | 'all'
  purpose: WorkPurpose | 'all'
  query: string
  suitType: SuitType | 'all'
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

export function filterAdminWorks<T extends AdminWorkListEntry>(
  works: readonly T[],
  filters: AdminWorkListFilters,
): T[] {
  const query = normalized(filters.query)
  return works.filter(work => (
    (filters.purpose === 'all' || work.purpose === filters.purpose)
    && (filters.suitType === 'all' || work.suitType === filters.suitType)
    && (filters.publicationStatus === 'all'
      || work.publicationStatus === filters.publicationStatus)
    && (!query || normalized(`${work.characterName} ${work.species}`).includes(query))
  ))
}

export function adminWorkPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function clampAdminWorkPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), adminWorkPageCount(total, pageSize))
}

export function paginateAdminWorks<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): T[] {
  const safePage = clampAdminWorkPage(page, items.length, pageSize)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}

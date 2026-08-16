import type {
  PublicationStatus,
  WorkPurpose,
} from '../../shared/types/contracts'
import { includesSearchText } from '~~/shared/utils/search'

export const ADMIN_WORK_PAGE_SIZES = [10, 20, 50] as const

export interface AdminWorkListEntry {
  characterName: string
  species: string
  purpose: WorkPurpose
  publicationStatus: PublicationStatus
}

export interface AdminWorkListFilters {
  publicationStatus: PublicationStatus | 'all'
  purpose: WorkPurpose | 'all'
  query: string
}

export function filterAdminWorks<T extends AdminWorkListEntry>(
  works: readonly T[],
  filters: AdminWorkListFilters,
): T[] {
  return works.filter(work => (
    (filters.purpose === 'all' || work.purpose === filters.purpose)
    && (filters.publicationStatus === 'all'
      || work.publicationStatus === filters.publicationStatus)
    && includesSearchText(`${work.characterName} ${work.species}`, filters.query)
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

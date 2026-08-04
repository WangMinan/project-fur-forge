import type { Ref } from 'vue'
import type {
  PublicationStatus,
  SuitType,
  WorkListItemDto,
  WorkPurpose,
} from '~~/shared/types/contracts'
import {
  adminWorkPageCount,
  filterAdminWorks,
  paginateAdminWorks,
} from '~/utils/admin-work-list'

export function useAdminWorkListView(works: Ref<WorkListItemDto[]>) {
  const query = shallowRef('')
  const purpose = shallowRef<WorkPurpose | 'all'>('all')
  const suitType = shallowRef<SuitType | 'all'>('all')
  const publicationStatus = shallowRef<PublicationStatus | 'all'>('all')
  const page = shallowRef(1)
  const pageSize = shallowRef(10)

  const filteredWorks = computed(() => filterAdminWorks(works.value, {
    publicationStatus: publicationStatus.value,
    purpose: purpose.value,
    query: query.value,
    suitType: suitType.value,
  }))
  const pageCount = computed(() => adminWorkPageCount(filteredWorks.value.length, pageSize.value))
  const visibleWorks = computed(() => paginateAdminWorks(
    filteredWorks.value,
    page.value,
    pageSize.value,
  ))
  const visibleFrom = computed(() => filteredWorks.value.length === 0
    ? 0
    : (page.value - 1) * pageSize.value + 1)
  const visibleTo = computed(() => Math.min(
    page.value * pageSize.value,
    filteredWorks.value.length,
  ))
  const filtersActive = computed(() => (
    query.value.trim().length > 0
    || purpose.value !== 'all'
    || suitType.value !== 'all'
    || publicationStatus.value !== 'all'
  ))

  watch([query, purpose, suitType, publicationStatus, pageSize], () => {
    page.value = 1
  })
  watch(pageCount, (count) => {
    if (page.value > count) {
      page.value = count
    }
  })

  function resetFilters() {
    query.value = ''
    purpose.value = 'all'
    suitType.value = 'all'
    publicationStatus.value = 'all'
  }

  return {
    filteredWorks,
    filtersActive,
    page,
    pageCount,
    pageSize,
    publicationStatus,
    purpose,
    query,
    resetFilters,
    suitType,
    visibleFrom,
    visibleTo,
    visibleWorks,
  }
}

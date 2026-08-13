<script setup lang="ts">
import type { SuitType, WorkPurpose } from '~~/shared/types/contracts'
import { SUIT_TYPE_VALUES, WORK_PURPOSE_VALUES } from '~~/shared/schemas/work'

/**
 * 作品列表筛选条：普通链接切换 query，无 JS 也可用。
 * 选中态来自服务端回显的 filter（非法参数已被服务端复位为 null）。
 * 胶囊样式由 PublicFilterChips 与 /adoptions 共用。
 */
const props = defineProps<{
  filter: { purpose: WorkPurpose | null, suitType: SuitType | null }
  query?: string
}>()

function buildQuery(purpose: WorkPurpose | null, suitType: SuitType | null) {
  const query: Record<string, string> = {}
  if (purpose) {
    query.purpose = purpose
  }
  if (suitType) {
    query.suitType = suitType
  }
  if (props.query) {
    query.q = props.query
  }
  return query
}

function optionLink(purpose: WorkPurpose | null, suitType: SuitType | null) {
  return { path: '/works', query: buildQuery(purpose, suitType) }
}

const purposeOptions = computed(() => [
  { key: 'all', label: '全部用途', to: optionLink(null, props.filter.suitType) },
  ...WORK_PURPOSE_VALUES.map(value => ({
    key: value,
    label: WORK_PURPOSE_FILTER_LABELS[value],
    to: optionLink(value, props.filter.suitType),
  })),
])

const suitOptions = computed(() => [
  { key: 'all', label: '全部装型', to: optionLink(props.filter.purpose, null) },
  ...SUIT_TYPE_VALUES.map(value => ({
    key: value,
    label: SUIT_TYPE_LABELS[value],
    to: optionLink(props.filter.purpose, value),
  })),
])
</script>

<template>
  <div class="work-filter">
    <div class="work-filter__row">
      <PublicFilterChips
        label="按用途筛选"
        :options="purposeOptions"
        :selected="filter.purpose ?? 'all'"
      />
      <PublicFilterChips
        label="按装型筛选"
        :options="suitOptions"
        :selected="filter.suitType ?? 'all'"
      />
    </div>
  </div>
</template>

<style scoped>
.work-filter {
  margin-top: 0;
}

.work-filter__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-6);
}

</style>

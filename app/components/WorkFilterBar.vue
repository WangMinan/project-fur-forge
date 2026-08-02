<script setup lang="ts">
import type { SuitType, WorkPurpose } from '~~/shared/types/contracts'
import { SUIT_TYPE_VALUES, WORK_PURPOSE_VALUES } from '~~/shared/schemas/work'

/**
 * 作品列表筛选条：普通链接（NuxtLink）切换 query，无 JS 也可用。
 * 选中态来自服务端回显的 filter（非法参数已被服务端复位为 null）。
 */
const props = defineProps<{
  filter: { purpose: WorkPurpose | null, suitType: SuitType | null }
  resultCount: number
}>()

const purposeOptions = computed(() => [
  { value: null, label: '全部用途' },
  ...WORK_PURPOSE_VALUES.map(value => ({
    value,
    label: WORK_PURPOSE_FILTER_LABELS[value],
  })),
])

const suitOptions = computed(() => [
  { value: null, label: '全部装型' },
  ...SUIT_TYPE_VALUES.map(value => ({
    value,
    label: SUIT_TYPE_LABELS[value],
  })),
])

function buildQuery(purpose: WorkPurpose | null, suitType: SuitType | null) {
  const query: Record<string, string> = {}
  if (purpose) {
    query.purpose = purpose
  }
  if (suitType) {
    query.suitType = suitType
  }
  return query
}

function optionLink(purpose: WorkPurpose | null, suitType: SuitType | null) {
  return { path: '/works', query: buildQuery(purpose, suitType) }
}

const purposeLink = (purpose: WorkPurpose | null) => optionLink(purpose, props.filter.suitType)
const suitLink = (suitType: SuitType | null) => optionLink(props.filter.purpose, suitType)
</script>

<template>
  <div class="work-filter">
    <div class="work-filter__row">
      <div
        class="work-filter__group"
        role="group"
        aria-label="按用途筛选"
      >
        <NuxtLink
          v-for="option in purposeOptions"
          :key="option.value ?? 'all'"
          :to="purposeLink(option.value)"
          class="work-filter__chip"
          :class="{ 'work-filter__chip--active': filter.purpose === option.value }"
          :aria-current="filter.purpose === option.value ? 'true' : undefined"
        >
          {{ option.label }}
        </NuxtLink>
      </div>
      <div
        class="work-filter__group"
        role="group"
        aria-label="按装型筛选"
      >
        <NuxtLink
          v-for="option in suitOptions"
          :key="option.value ?? 'all'"
          :to="suitLink(option.value)"
          class="work-filter__chip"
          :class="{ 'work-filter__chip--active': filter.suitType === option.value }"
          :aria-current="filter.suitType === option.value ? 'true' : undefined"
        >
          {{ option.label }}
        </NuxtLink>
      </div>
    </div>
    <p class="work-filter__count" role="status">
      共 {{ resultCount }} 件作品
    </p>
  </div>
</template>

<style scoped>
.work-filter {
  margin-top: var(--space-6);
}

.work-filter__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-6);
}

.work-filter__group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.work-filter__chip {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--public-border-subtle);
  border-radius: 999px;
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.work-filter__chip:hover {
  border-color: var(--public-border-strong);
  color: var(--public-text-primary);
}

.work-filter__chip--active,
.work-filter__chip--active:hover {
  background: var(--public-surface-strong);
  border-color: var(--public-surface-strong);
  color: var(--public-text-inverse);
}

.work-filter__count {
  margin-top: var(--space-4);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}
</style>

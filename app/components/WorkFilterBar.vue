<script setup lang="ts">
import type { WorkFilter } from '~/utils/work-filters'
import {
  SUIT_TYPE_VALUES,
  WORK_PURPOSE_VALUES,
} from '~~/shared/schemas/work'

/**
 * 用途 × 装型交集筛选：每组选项都是带 query 的普通链接，
 * SSR 直接渲染筛选结果，键盘与无 JS 场景完整可用。
 */
const props = defineProps<{
  filter: WorkFilter
  resultCount: number
}>()

interface FilterOption {
  value: string | null
  label: string
  to: string
  current: boolean
}

function buildQuery(overrides: { purpose?: string | null, suit?: string | null }) {
  const query: Record<string, string> = {}
  const purpose = overrides.purpose === undefined ? props.filter.purpose : overrides.purpose
  const suit = overrides.suit === undefined ? props.filter.suitType : overrides.suit

  if (purpose) {
    query.purpose = purpose
  }
  if (suit) {
    query.suit = suit
  }

  const params = new URLSearchParams(query)
  const serialized = params.toString()
  return serialized ? `/works?${serialized}` : '/works'
}

const purposeOptions = computed<FilterOption[]>(() => [
  {
    value: null,
    label: '全部用途',
    to: buildQuery({ purpose: null }),
    current: props.filter.purpose === null,
  },
  ...WORK_PURPOSE_VALUES.map(value => ({
    value,
    label: WORK_PURPOSE_FILTER_LABELS[value],
    to: buildQuery({ purpose: value }),
    current: props.filter.purpose === value,
  })),
])

const suitOptions = computed<FilterOption[]>(() => [
  {
    value: null,
    label: '全部装型',
    to: buildQuery({ suit: null }),
    current: props.filter.suitType === null,
  },
  ...SUIT_TYPE_VALUES.map(value => ({
    value,
    label: SUIT_TYPE_LABELS[value],
    to: buildQuery({ suit: value }),
    current: props.filter.suitType === value,
  })),
])
</script>

<template>
  <div class="work-filter" data-testid="work-filter">
    <div class="work-filter__groups">
      <div class="work-filter__group" role="group" aria-label="按用途筛选">
        <NuxtLink
          v-for="option in purposeOptions"
          :key="option.value ?? 'all'"
          :to="option.to"
          class="work-filter__option"
          :aria-current="option.current ? 'true' : undefined"
        >
          {{ option.label }}
        </NuxtLink>
      </div>

      <div class="work-filter__group" role="group" aria-label="按装型筛选">
        <NuxtLink
          v-for="option in suitOptions"
          :key="option.value ?? 'all'"
          :to="option.to"
          class="work-filter__option"
          :aria-current="option.current ? 'true' : undefined"
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-5);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0 var(--public-page-padding);
}

.work-filter__groups {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-5);
}

.work-filter__group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.work-filter__option {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: var(--space-2) var(--space-4);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-full);
  transition:
    color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard);
}

.work-filter__option:hover {
  color: var(--public-accent-primary);
  border-color: var(--public-accent-primary);
}

.work-filter__option[aria-current='true'] {
  color: var(--public-text-inverse);
  background: var(--public-accent-primary);
  border-color: var(--public-accent-primary);
}

.work-filter__count {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}
</style>

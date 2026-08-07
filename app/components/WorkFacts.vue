<script setup lang="ts">
import type { PublicWorkDto } from '~~/shared/types/contracts'

/** 作品事实列表：物种、装型、主人公开值、用途与适用业务事实。 */
const props = defineProps<{
  dto: PublicWorkDto
}>()

interface FactRow {
  term: string
  value: string
}

const rows = computed<FactRow[]>(() => {
  const base: FactRow[] = [
    { term: '物种', value: props.dto.species },
    { term: '装型', value: SUIT_TYPE_LABELS[props.dto.suitType] },
    { term: '角色主人', value: props.dto.ownerDisplay },
    { term: '用途', value: WORK_PURPOSE_LABELS[props.dto.purpose] },
  ]

  if (props.dto.purpose === 'adoption') {
    base.push({
      term: '领养方式',
      value: ADOPTION_METHOD_LABELS[props.dto.adoptionMethod],
    })
    base.push({
      term: '业务状态',
      value: BUSINESS_STATUS_LABELS[props.dto.businessStatus],
    })
    // T37：只有展会掉落显示展会名称与时间；常规领养不出现空行。
    // 展会时间只是展示文本，不是可解析的日程。
    if (props.dto.adoptionMethod === 'event_drop') {
      if (props.dto.eventName) {
        base.push({ term: '展会名称', value: props.dto.eventName })
      }
      if (props.dto.eventTime) {
        base.push({ term: '展会时间', value: props.dto.eventTime })
      }
    }
  }

  return base
})
</script>

<template>
  <dl class="work-facts" data-testid="work-facts">
    <div v-for="row in rows" :key="row.term" class="work-facts__row">
      <dt class="work-facts__term">
        {{ row.term }}
      </dt>
      <dd class="work-facts__value">
        {{ row.value }}
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.work-facts {
  margin: 0;
}

.work-facts__row {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--public-border-secondary);
}

.work-facts__row:first-child {
  padding-top: 0;
}

.work-facts__term {
  flex-shrink: 0;
  width: 4.5rem;
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
}

.work-facts__value {
  margin: 0;
  color: var(--public-text-primary);
}
</style>

<script setup lang="ts">
import type { WorkListItemDto } from '~~/shared/types/contracts'
import { parseSortOrderInput } from '~/utils/work-form'

/**
 * 列表内的人工排序与首页精选编辑。
 * 当前数据量下用数字输入 + 勾选即可可靠维护顺序，不引入拖拽库。
 * 已发布作品在服务端不可更新，这里直接禁用并说明原因。
 */
const props = defineProps<{
  error: string | null
  pending: boolean
  /** 表格与卡片两套布局同时存在于 DOM，用作用域前缀保证控件 id 唯一。 */
  scope: string
  work: WorkListItemDto
}>()

const emit = defineEmits<{
  update: [{ featured?: boolean, sortOrder?: number }]
}>()

const draft = ref(String(props.work.sortOrder))
const localError = ref<string | null>(null)

watch(() => props.work.sortOrder, (value) => {
  draft.value = String(value)
  localError.value = null
})

const locked = computed(() => props.work.publicationStatus === 'published')
const lockedHint = computed(() =>
  locked.value ? '已发布作品需先下架才能修改排序与精选' : undefined,
)

const sortInputId = computed(() => `${props.scope}-sort-${props.work.id}`)
const featuredInputId = computed(() => `${props.scope}-featured-${props.work.id}`)
const messageId = computed(() => `${props.scope}-ordering-message-${props.work.id}`)

const message = computed(() => localError.value ?? props.error)

function commitSortOrder() {
  const parsed = parseSortOrderInput(draft.value)
  if (parsed.value === undefined) {
    localError.value = parsed.error
    return
  }
  localError.value = null
  if (parsed.value === props.work.sortOrder) {
    return
  }
  emit('update', { sortOrder: parsed.value })
}

function commitFeatured(event: Event) {
  localError.value = null
  emit('update', { featured: (event.target as HTMLInputElement).checked })
}
</script>

<template>
  <div class="ordering">
    <div class="ordering__row">
      <label class="ordering__label" :for="sortInputId">排序</label>
      <input
        :id="sortInputId"
        v-model="draft"
        class="ordering__number"
        type="number"
        min="0"
        step="1"
        :disabled="locked || pending"
        :title="lockedHint"
        :aria-invalid="message ? 'true' : undefined"
        :aria-describedby="message ? messageId : undefined"
        @change="commitSortOrder"
      >
    </div>
    <div class="ordering__row">
      <input
        :id="featuredInputId"
        class="ordering__checkbox"
        type="checkbox"
        :checked="work.featured"
        :disabled="locked || pending"
        :title="lockedHint"
        @change="commitFeatured"
      >
      <label class="ordering__label" :for="featuredInputId">精选</label>
    </div>
    <p v-if="pending" class="ordering__status" role="status">保存中…</p>
    <p v-else-if="message" :id="messageId" class="ordering__error" role="alert">
      {{ message }}
    </p>
    <p v-else-if="locked" class="ordering__status">已发布 · 需先下架</p>
  </div>
</template>

<style scoped>
.ordering {
  display: grid;
  gap: var(--admin-space-2);
  min-width: 0;
}

.ordering__row {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
}

.ordering__label {
  font-size: var(--admin-font-xs);
  color: var(--admin-text-secondary);
}

.ordering__number {
  width: 4.5rem;
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  font: inherit;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
}

.ordering__number:focus,
.ordering__checkbox:focus-visible {
  border-color: var(--admin-border-focus);
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.ordering__number[aria-invalid='true'] {
  border-color: var(--admin-status-error);
}

.ordering__number:disabled,
.ordering__checkbox:disabled {
  opacity: 0.55;
  cursor: default;
}

.ordering__checkbox {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--admin-accent-primary);
}

.ordering__status {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.ordering__error {
  margin: 0;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  color: var(--admin-status-error);
}
</style>

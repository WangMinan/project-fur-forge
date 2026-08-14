<script setup lang="ts">
import type { WorkListItemDto } from '~~/shared/types/contracts'
/**
 * 列表内只维护首页精选成员；具体顺序统一进入精选 Tab 编排。
 * 展示设置使用独立接口，已发布作品也可直接更新。
 */
const props = defineProps<{
  pending: boolean
  /** 表格与卡片两套布局同时存在于 DOM，用作用域前缀保证控件 id 唯一。 */
  scope: string
  work: WorkListItemDto
}>()

const emit = defineEmits<{
  update: [{ featured: boolean }]
}>()
const featuredInputId = computed(() => `${props.scope}-featured-${props.work.id}`)

function commitFeatured(event: Event) {
  emit('update', { featured: (event.target as HTMLInputElement).checked })
}
</script>

<template>
  <div class="ordering">
    <div class="ordering__row">
      <input
        :id="featuredInputId"
        class="ordering__checkbox"
        type="checkbox"
        :checked="work.featured"
        :disabled="pending"
        @change="commitFeatured"
      >
      <label class="ordering__label" :for="featuredInputId">加入首页精选</label>
    </div>
    <span v-if="work.featured" class="ordering__position">当前第 {{ work.sortOrder + 1 }} 位</span>
    <NuxtLink v-if="work.featured" to="/admin/works?tab=featured" class="ordering__link">
      前往调整顺序
    </NuxtLink>
    <p v-if="pending" class="ordering__status" role="status">保存中…</p>
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

.ordering__checkbox:focus-visible {
  border-color: var(--admin-border-focus);
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.ordering__checkbox:disabled {
  opacity: 0.55;
  cursor: default;
}

.ordering__checkbox {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--admin-accent-primary);
}

.ordering__status,
.ordering__position,
.ordering__link {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.ordering__link {
  color: var(--admin-accent-primary);
  font-weight: 600;
}
</style>

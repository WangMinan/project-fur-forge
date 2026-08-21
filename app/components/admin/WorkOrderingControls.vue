<script setup lang="ts">
import type { WorkListItemDto } from '~~/shared/types/contracts'
import { PUBLIC_FEATURED_LIMIT } from '~~/shared/constants/featured'
/**
 * 列表内只维护代表作品成员；具体顺序统一进入代表作品 Tab 编排。
 * 展示设置使用独立接口，已发布作品也可直接更新。
 */
const props = defineProps<{
  limitReached: boolean
  pending: boolean
  /** 表格与卡片两套布局同时存在于 DOM，用作用域前缀保证控件 id 唯一。 */
  scope: string
  work: WorkListItemDto
}>()

const emit = defineEmits<{
  update: [{ featured: boolean }]
}>()
const featuredInputId = computed(() => `${props.scope}-featured-${props.work.id}`)
const unavailableReason = computed(() => {
  if (props.work.featured) {
    return null
  }
  if (!props.work.portraitStudioPhotoAssetId) {
    return '需先上传至少一张竖版出厂照'
  }
  return props.limitReached ? `代表作品已达到 ${PUBLIC_FEATURED_LIMIT} 件上限` : null
})

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
        :disabled="pending || unavailableReason !== null"
        @change="commitFeatured"
      >
      <label class="ordering__label" :for="featuredInputId">设为代表作品</label>
    </div>
    <span v-if="unavailableReason" class="ordering__requirement">{{ unavailableReason }}</span>
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
.ordering__requirement,
.ordering__link {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.ordering__requirement {
  color: var(--admin-status-warning);
}

.ordering__link {
  color: var(--admin-accent-primary);
  font-weight: 600;
}
</style>

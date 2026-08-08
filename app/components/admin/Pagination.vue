<script setup lang="ts">
import { ADMIN_WORK_PAGE_SIZES } from '~/utils/admin-work-list'

withDefaults(defineProps<{
  /** 无障碍名称与计数单位随列表类型变化，默认沿用作品列表。 */
  label?: string
  pageCount: number
  resultCount: number
  unit?: string
  visibleFrom: number
  visibleTo: number
}>(), {
  label: '作品列表分页',
  unit: '件',
})

const page = defineModel<number>('page', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })
</script>

<template>
  <nav class="admin-pagination" :aria-label="label">
    <p class="admin-pagination__summary" role="status">
      <template v-if="resultCount > 0">显示 {{ visibleFrom }}–{{ visibleTo }}，共 {{ resultCount }} {{ unit }}</template>
      <template v-else>共 0 {{ unit }}</template>
    </p>

    <label class="admin-pagination__size">
      <span>每页</span>
      <select v-model.number="pageSize" class="admin-pagination__select">
        <option v-for="size in ADMIN_WORK_PAGE_SIZES" :key="size" :value="size">
          {{ size }} {{ unit }}
        </option>
      </select>
    </label>

    <div class="admin-pagination__controls">
      <button type="button" :disabled="page <= 1" @click="page = 1">首页</button>
      <button type="button" :disabled="page <= 1" @click="page -= 1">上一页</button>
      <span class="admin-pagination__current">第 {{ page }} / {{ pageCount }} 页</span>
      <button type="button" :disabled="page >= pageCount" @click="page += 1">下一页</button>
      <button type="button" :disabled="page >= pageCount" @click="page = pageCount">末页</button>
    </div>
  </nav>
</template>

<style scoped>
.admin-pagination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--admin-space-3);
  margin-top: var(--admin-space-4);
  padding-top: var(--admin-space-4);
  border-top: 1px solid var(--admin-border-secondary);
}

.admin-pagination__summary {
  flex: 1 1 12rem;
  margin: 0;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.admin-pagination__size {
  display: inline-flex;
  align-items: center;
  gap: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.admin-pagination__select,
.admin-pagination__controls button {
  min-height: var(--admin-control-height);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
}

.admin-pagination__select {
  padding: 0 var(--admin-space-3);
}

.admin-pagination__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--admin-space-2);
}

.admin-pagination__controls button {
  padding: 0 var(--admin-space-3);
  cursor: pointer;
}

.admin-pagination__controls button:hover:not(:disabled) {
  background: var(--admin-bg-subtle);
}

.admin-pagination__controls button:disabled {
  opacity: 0.45;
  cursor: default;
}

.admin-pagination__current {
  min-width: 6.5rem;
  text-align: center;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

@media (min-width: 768px) {
  .admin-pagination {
    flex-wrap: nowrap;
  }
}
</style>

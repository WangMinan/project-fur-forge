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

    <div class="admin-pagination__size">
      <span>每页</span>
      <AdminSelect v-model="pageSize" aria-label="每页" :options="ADMIN_WORK_PAGE_SIZES.map(value => ({ value, label: `${value} ${unit}` }))" />
    </div>

    <div class="admin-pagination__controls">
      <AdminAction :disabled="page <= 1" @click="page = 1">首页</AdminAction>
      <AdminAction :disabled="page <= 1" @click="page -= 1">上一页</AdminAction>
      <span class="admin-pagination__current">第 {{ page }} / {{ pageCount }} 页</span>
      <AdminAction :disabled="page >= pageCount" @click="page += 1">下一页</AdminAction>
      <AdminAction :disabled="page >= pageCount" @click="page = pageCount">末页</AdminAction>
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

.admin-pagination__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--admin-space-2);
}

.admin-pagination__controls :deep(.admin-action) { padding: 0 var(--admin-space-3); font-size: var(--admin-font-sm); }

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

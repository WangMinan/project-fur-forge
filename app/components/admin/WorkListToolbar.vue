<script setup lang="ts">
import {
  PUBLICATION_STATUS_VALUES,
  WORK_PURPOSE_VALUES,
} from '~~/shared/schemas/work'
import type {
  PublicationStatus,
  WorkPurpose,
} from '~~/shared/types/contracts'
import {
  PUBLICATION_STATUS_LABELS,
  WORK_PURPOSE_LABELS,
} from '~/utils/work-labels'

defineProps<{
  filtersActive: boolean
  resultCount: number
  totalCount: number
}>()

const emit = defineEmits<{
  reset: []
}>()

const query = defineModel<string>('query', { required: true })
const purpose = defineModel<WorkPurpose | 'all'>('purpose', { required: true })
const publicationStatus = defineModel<PublicationStatus | 'all'>('publicationStatus', {
  required: true,
})
</script>

<template>
  <!-- 标签与控件样式来自 admin-base.css 的 .admin-list-toolbar-*：
       列表页查找与筛选保持同一字号。 -->
  <section class="admin-list-toolbar work-list-toolbar" aria-label="查找和筛选作品">
    <div class="admin-list-toolbar__field">
      <label class="admin-list-toolbar__label" for="admin-work-search">查找作品</label>
      <input
        id="admin-work-search"
        v-model="query"
        class="admin-list-toolbar__control"
        type="search"
        placeholder="角色名或物种"
        autocomplete="off"
      >
    </div>

    <div class="admin-list-toolbar__field">
      <label class="admin-list-toolbar__label" for="admin-work-purpose">用途</label>
      <select id="admin-work-purpose" v-model="purpose" class="admin-list-toolbar__control">
        <option value="all">全部用途</option>
        <option v-for="value in WORK_PURPOSE_VALUES" :key="value" :value="value">
          {{ WORK_PURPOSE_LABELS[value] }}
        </option>
      </select>
    </div>

    <div class="admin-list-toolbar__field">
      <label class="admin-list-toolbar__label" for="admin-work-publication">发布状态</label>
      <select
        id="admin-work-publication"
        v-model="publicationStatus"
        class="admin-list-toolbar__control"
      >
        <option value="all">全部状态</option>
        <option v-for="value in PUBLICATION_STATUS_VALUES" :key="value" :value="value">
          {{ PUBLICATION_STATUS_LABELS[value] }}
        </option>
      </select>
    </div>

    <div class="work-list-toolbar__summary">
      <p class="work-list-toolbar__count" role="status">
        {{ filtersActive ? `找到 ${resultCount} / ${totalCount} 件` : `共 ${totalCount} 件` }}
      </p>
      <button
        type="button"
        class="work-list-toolbar__reset"
        :disabled="!filtersActive"
        @click="emit('reset')"
      >清除</button>
    </div>
  </section>
</template>

<style scoped>
/* 容器、标签与控件来自 .admin-list-toolbar*；这里只加四列布局与统计行。 */

.work-list-toolbar__summary {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--admin-space-3);
}

.work-list-toolbar__count {
  margin: 0;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.work-list-toolbar__reset {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-4);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
  cursor: pointer;
}

.work-list-toolbar__reset:hover:not(:disabled) {
  background: var(--admin-bg-subtle);
}

.work-list-toolbar__reset:disabled {
  opacity: 0.5;
  cursor: default;
}

@media (min-width: 768px) {
  /* 同时带上共用类，specificity 高于 admin-base.css 的容器规则，
     因此不依赖样式表加载顺序。 */
  .admin-list-toolbar.work-list-toolbar {
    grid-template-columns: minmax(14rem, 2fr) repeat(2, minmax(8rem, 1fr));
    align-items: end;
  }

  .work-list-toolbar__summary {
    grid-column: 1 / -1;
  }
}
</style>

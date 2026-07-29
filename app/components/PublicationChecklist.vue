<script setup lang="ts">
import type { PublicationChecklist } from '~/utils/publication-checklist'

defineProps<{
  checklist: PublicationChecklist
}>()

const STATE_META = {
  satisfied: { icon: '✓', label: '满足', tone: 'success' },
  missing: { icon: '!', label: '缺少', tone: 'error' },
  processing: { icon: '…', label: '进行中', tone: 'info' },
  blocked: { icon: '×', label: '阻塞', tone: 'error' },
} as const
</script>

<template>
  <section class="checklist" aria-labelledby="checklist-title">
    <div class="checklist__header">
      <h2 id="checklist-title" class="checklist__title">发布检查</h2>
      <AdminStatusBadge
        :tone="checklist.publishable ? 'success' : 'warning'"
        :label="checklist.publishable ? '可以发布' : '暂不可发布'"
      />
    </div>
    <ul class="checklist__items" role="list">
      <li
        v-for="item in checklist.items"
        :key="item.id"
        class="checklist__item"
        :data-state="item.state"
      >
        <span
          class="checklist__icon"
          :data-tone="STATE_META[item.state].tone"
          aria-hidden="true"
        >{{ STATE_META[item.state].icon }}</span>
        <div class="checklist__body">
          <p class="checklist__label">
            {{ item.label }}
            <span class="sr-only">：{{ STATE_META[item.state].label }}</span>
          </p>
          <p class="checklist__detail">{{ item.detail }}</p>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.checklist {
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-5);
}

.checklist__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-3);
  margin-bottom: var(--admin-space-4);
}

.checklist__title {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.checklist__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--admin-space-3);
}

.checklist__item {
  display: flex;
  gap: var(--admin-space-3);
  align-items: flex-start;
}

.checklist__icon {
  flex: none;
  width: 1.375rem;
  height: 1.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: var(--admin-font-xs);
  font-weight: 700;
}

.checklist__icon[data-tone='success'] {
  color: var(--admin-status-success);
  background: var(--admin-status-success-soft);
}

.checklist__icon[data-tone='info'] {
  color: var(--admin-status-info);
  background: var(--admin-status-info-soft);
}

.checklist__icon[data-tone='error'] {
  color: var(--admin-status-error);
  background: var(--admin-status-error-soft);
}

.checklist__label {
  margin: 0;
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.checklist__detail {
  margin: 0.1rem 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-secondary);
  line-height: var(--admin-line-normal);
}
</style>

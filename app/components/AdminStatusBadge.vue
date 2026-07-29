<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  label: string
}>(), {
  tone: 'neutral',
})
</script>

<template>
  <span class="admin-badge" :data-tone="tone">{{ label }}</span>
</template>

<style scoped>
.admin-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--admin-space-1);
  min-height: 1.5rem;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  white-space: nowrap;
}

.admin-badge[data-tone='success'] {
  color: var(--admin-status-success);
  background: var(--admin-status-success-soft);
}

.admin-badge[data-tone='warning'] {
  color: var(--admin-status-warning);
  background: var(--admin-status-warning-soft);
}

.admin-badge[data-tone='error'] {
  color: var(--admin-status-error);
  background: var(--admin-status-error-soft);
}

.admin-badge[data-tone='info'] {
  color: var(--admin-status-info);
  background: var(--admin-status-info-soft);
}

.admin-badge[data-tone='neutral'] {
  color: var(--admin-text-secondary);
  background: var(--admin-bg-subtle);
}
</style>

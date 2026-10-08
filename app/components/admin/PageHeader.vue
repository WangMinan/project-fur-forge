<script setup lang="ts">
defineProps<{ title: string, meta?: string | undefined }>()
</script>

<template>
  <header class="admin-page-header">
    <h1 class="admin-page-header__title">{{ title }}</h1>
    <p v-if="meta" class="admin-page-header__meta">{{ meta }}</p>
    <div v-if="$slots.default" class="admin-page-header__actions"><slot /></div>
  </header>
</template>

<style scoped>
.admin-page-header {
  display: flex;
  align-items: center;
  gap: var(--admin-space-4);
  padding-bottom: var(--admin-space-5);
  margin-bottom: var(--admin-space-5);
  border-bottom: 1px solid var(--admin-border-secondary);
}
.admin-page-header__title {
  display: flex;
  align-items: center;
  flex: none;
  min-height: var(--admin-control-height);
  margin: 0;
  font-family: var(--font-admin-display);
  font-size: var(--admin-font-xl);
  font-weight: var(--admin-type-display-weight);
  line-height: var(--admin-type-display-line-height);
}
.admin-page-header__meta {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--admin-text-secondary);
  font-family: var(--font-admin-metadata);
  font-size: var(--admin-font-sm);
}
.admin-page-header__actions { display: flex; flex: none; gap: var(--admin-space-2); margin-left: auto; }
</style>

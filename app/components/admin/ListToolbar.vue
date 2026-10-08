<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  filtersActive: boolean
  resultCount: number
  totalCount: number
  unit?: string
}>(), { unit: '件' })

const emit = defineEmits<{ reset: [] }>()
</script>

<template>
  <section class="admin-list-toolbar" :aria-label="label">
    <div class="admin-list-toolbar__fields"><slot /></div>
    <div class="admin-list-toolbar__summary">
      <p class="admin-list-toolbar__count" role="status">
        {{ filtersActive ? `找到 ${resultCount} / ${totalCount} ${unit}` : `共 ${totalCount} ${unit}` }}
      </p>
      <AdminAction :disabled="!filtersActive" @click="emit('reset')">清除</AdminAction>
    </div>
  </section>
</template>

<style scoped>
.admin-list-toolbar__fields {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--admin-space-3);
}
.admin-list-toolbar__fields :slotted(.admin-list-toolbar__field) { flex: 1 1 10rem; }
.admin-list-toolbar__fields :slotted(.admin-list-toolbar__field:first-child) { flex: 2 1 20rem; }
.admin-list-toolbar__summary {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--admin-space-3);
}
.admin-list-toolbar__count {
  margin: 0;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}
</style>

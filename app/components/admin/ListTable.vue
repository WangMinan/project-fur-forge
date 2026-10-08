<script setup lang="ts">
defineProps<{
  label: string
  columns: string[]
}>()
</script>

<template>
  <div class="admin-list-table-view">
    <div class="admin-list-table-view__desktop">
      <table class="admin-list-table" :aria-label="label">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column" scope="col">{{ column }}</th>
          </tr>
        </thead>
        <tbody><slot /></tbody>
      </table>
    </div>
    <div class="admin-list-table-view__mobile"><slot name="mobile" /></div>
  </div>
</template>

<style scoped>
.admin-list-table-view { min-width: 0; }
.admin-list-table-view__desktop { display: none; }

@media (min-width: 1024px) {
  .admin-list-table-view__desktop { display: block; overflow-x: auto; }
  .admin-list-table-view__mobile { display: none; }
}
</style>

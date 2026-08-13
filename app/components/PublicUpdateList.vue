<script setup lang="ts">
import type { PublicUpdateDto } from '~~/shared/types/contracts'

withDefaults(defineProps<{
  items: PublicUpdateDto[]
  variant?: 'full' | 'summary'
}>(), {
  variant: 'full',
})
</script>

<template>
  <ol
    class="update-list"
    :class="`update-list--${variant}`"
    aria-label="最新动态列表"
    data-testid="public-update-list"
  >
    <li v-for="item in items" :key="item.id" class="update-list__item" :data-update-id="item.id">
      <PublicUpdateCard :item="item" :variant="variant" />
    </li>
  </ol>
</template>

<style scoped>
.update-list {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.update-list__item {
  min-width: 0;
}

@media (min-width: 768px) {
  .update-list--summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .update-list--summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>

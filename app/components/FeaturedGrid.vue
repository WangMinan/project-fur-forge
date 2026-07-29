<script setup lang="ts">
import type { VisualWorkFixture } from '~~/shared/fixtures/visual-home'

defineProps<{
  works: VisualWorkFixture[]
}>()

const GRID_SIZES = '(min-width: 1024px) 40vw, (min-width: 768px) 45vw, 92vw'
</script>

<template>
  <div class="featured-grid" data-testid="featured-grid">
    <FeaturedWorkItem
      v-for="(work, index) in works"
      :key="work.dto.id"
      :work="work"
      :sizes="GRID_SIZES"
      class="featured-grid__item"
      :class="{ 'featured-grid__item--lead': index === 0 }"
    />
  </div>
</template>

<style scoped>
.featured-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5) var(--space-4);
}

.featured-grid__item--lead {
  grid-column: 1 / -1;
  max-width: 34rem;
}

@media (min-width: 768px) {
  .featured-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-6) var(--space-5);
  }

  .featured-grid__item {
    grid-column: auto;
    max-width: none;
  }

  .featured-grid__item:nth-child(even) {
    margin-top: var(--space-7);
  }
}

@media (min-width: 1024px) {
  .featured-grid {
    gap: var(--space-8) var(--space-5);
  }
}
</style>

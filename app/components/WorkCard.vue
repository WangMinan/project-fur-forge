<script setup lang="ts">
import type { WorkCatalogEntry } from '~~/shared/fixtures/visual-works'

const props = withDefaults(defineProps<{
  work: WorkCatalogEntry
  sizes?: string | undefined
  loading?: 'lazy' | 'eager'
}>(), {
  sizes: undefined,
  loading: 'lazy',
})

const meta = computed(
  () => `${props.work.dto.species} · ${SUIT_TYPE_LABELS[props.work.dto.suitType]}`,
)
</script>

<template>
  <NuxtLink
    :to="`/works/${work.dto.slug}`"
    class="work-card"
    :data-work-slug="work.dto.slug"
  >
    <span class="work-card__frame">
      <ResponsiveAsset
        class="work-card__image"
        :src="work.card.src"
        :alt="work.card.alt"
        :width="work.card.width"
        :height="work.card.height"
        :focal-desktop="work.card.focal.desktop"
        :focal-mobile="work.card.focal.mobile"
        :sizes="sizes"
        :loading="loading"
      />
    </span>
    <span class="work-card__name">{{ work.dto.characterName }}</span>
    <span class="work-card__meta">{{ meta }}</span>
  </NuxtLink>
</template>

<style scoped>
.work-card {
  display: block;
  color: var(--public-text-primary);
}

.work-card:hover {
  color: var(--public-text-primary);
}

.work-card__frame {
  display: block;
  aspect-ratio: var(--ratio-work-card);
  background: var(--image-placeholder);
  overflow: hidden;
}

.work-card__frame :deep(.responsive-asset) {
  height: 100%;
}

.work-card__image {
  transition: transform var(--duration-section) var(--easing-standard);
}

.work-card:hover .work-card__image {
  transform: scale(var(--image-hover-scale));
}

@media (prefers-reduced-motion: reduce) {
  .work-card:hover .work-card__image {
    transform: none;
  }
}

.work-card__name {
  display: block;
  margin-top: var(--space-3);
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
  line-height: var(--line-height-heading);
}

.work-card__meta {
  display: block;
  margin-top: var(--space-1);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}
</style>

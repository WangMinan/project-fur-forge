<script setup lang="ts">
import type { VisualWorkFixture } from '~~/shared/fixtures/visual-home'

const props = defineProps<{
  work: VisualWorkFixture
  sizes?: string
}>()

const SUIT_TYPE_LABELS: Record<VisualWorkFixture['dto']['suitType'], string> = {
  full: '全装',
  partial: '半装',
}

const meta = computed(
  () => `${props.work.dto.species} · ${SUIT_TYPE_LABELS[props.work.dto.suitType]}`,
)
</script>

<template>
  <NuxtLink
    :to="`/works/${work.dto.slug}`"
    class="featured-item"
    :data-work-slug="work.dto.slug"
  >
    <span class="featured-item__frame">
      <ResponsiveAsset
        class="featured-item__image"
        :src="work.card.src"
        :alt="work.card.alt"
        :width="work.card.width"
        :height="work.card.height"
        :focal-desktop="work.card.focal.desktop"
        :focal-mobile="work.card.focal.mobile"
        :sizes="sizes"
      />
    </span>
    <span class="featured-item__name">{{ work.dto.characterName }}</span>
    <span class="featured-item__meta">{{ meta }}</span>
  </NuxtLink>
</template>

<style scoped>
.featured-item {
  display: block;
  color: var(--public-text-primary);
}

.featured-item:hover {
  color: var(--public-text-primary);
}

.featured-item__frame {
  display: block;
  background: var(--image-placeholder);
  overflow: hidden;
}

.featured-item__image {
  transition: transform var(--duration-section) var(--easing-standard);
}

.featured-item:hover .featured-item__image {
  transform: scale(var(--image-hover-scale));
}

@media (prefers-reduced-motion: reduce) {
  .featured-item:hover .featured-item__image {
    transform: none;
  }
}

.featured-item__name {
  display: block;
  margin-top: var(--space-3);
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
  line-height: var(--line-height-heading);
}

.featured-item__meta {
  display: block;
  margin-top: var(--space-1);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}
</style>

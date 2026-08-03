<script setup lang="ts">
import type { PublicAdoptionListItemDto } from '~~/shared/types/contracts'
import { formatCnyMinorUnits } from '~/utils/format'
import {
  BUSINESS_STATUS_LABELS,
  SUIT_TYPE_LABELS,
} from '~/utils/work-labels'

const props = defineProps<{
  adoption: PublicAdoptionListItemDto
}>()

const price = computed(() => props.adoption.work.price
  ? formatCnyMinorUnits(props.adoption.work.price.minorUnits)
  : null,
)
</script>

<template>
  <NuxtLink
    :to="adoption.href"
    class="adoption-card"
    :data-work-slug="adoption.work.slug"
  >
    <span class="adoption-card__canvas">
      <ResponsivePicture
        :sources="adoption.designSheet.sources"
        :alt="adoption.designSheet.alt"
        sizes="(min-width: 1024px) 44vw, 100vw"
      />
    </span>
    <span class="adoption-card__body">
      <span class="adoption-card__heading">
        <span class="adoption-card__name">{{ adoption.work.characterName }}</span>
        <span class="adoption-card__status">
          {{ BUSINESS_STATUS_LABELS[adoption.work.businessStatus] }}
        </span>
      </span>
      <span class="adoption-card__meta">
        {{ adoption.work.species }} · {{ SUIT_TYPE_LABELS[adoption.work.suitType] }}
      </span>
      <span v-if="adoption.work.featureTags.length > 0" class="adoption-card__tags">
        <span v-for="tag in adoption.work.featureTags" :key="tag">{{ tag }}</span>
      </span>
      <span v-if="price" class="adoption-card__price">{{ price }}</span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.adoption-card {
  display: block;
  color: var(--public-text-primary);
}

.adoption-card:hover {
  color: var(--public-text-primary);
}

.adoption-card__canvas {
  display: block;
  overflow: hidden;
  background: var(--image-placeholder);
}

.adoption-card__canvas :deep(.responsive-picture__image) {
  width: 100%;
  height: auto;
  object-fit: contain;
  transition: transform var(--duration-section) var(--easing-standard);
}

.adoption-card:hover .adoption-card__canvas :deep(.responsive-picture__image) {
  transform: scale(var(--image-hover-scale));
}

.adoption-card__body,
.adoption-card__heading,
.adoption-card__tags {
  display: flex;
}

.adoption-card__body {
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
}

.adoption-card__heading {
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.adoption-card__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
  line-height: var(--line-height-heading);
}

.adoption-card__status {
  flex: none;
  color: var(--public-status-open);
  font-size: var(--font-size-sm);
}

.adoption-card__meta {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.adoption-card__tags {
  flex-wrap: wrap;
  gap: var(--space-2);
}

.adoption-card__tags span {
  padding: var(--space-1) var(--space-3);
  color: var(--public-text-secondary);
  font-size: var(--font-size-xs);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-full);
}

.adoption-card__price {
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
}

@media (prefers-reduced-motion: reduce) {
  .adoption-card:hover .adoption-card__canvas :deep(.responsive-picture__image) {
    transform: none;
  }
}
</style>

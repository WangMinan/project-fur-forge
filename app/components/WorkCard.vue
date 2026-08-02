<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'

const props = withDefaults(defineProps<{
  work: PublicWorkSummaryDto
  sizes?: string | undefined
  loading?: 'lazy' | 'eager'
}>(), {
  sizes: undefined,
  loading: 'lazy',
})

// 只列适用事实：非领养作品不出现业务状态或价格占位。
const meta = computed(() => {
  const dto = props.work.work
  const facts = [dto.species, SUIT_TYPE_LABELS[dto.suitType]]
  if (dto.purpose === 'adoption') {
    facts.push(BUSINESS_STATUS_LABELS[dto.businessStatus])
  }
  return facts.join(' · ')
})
</script>

<template>
  <NuxtLink
    :to="work.href"
    class="work-card"
    :data-work-slug="work.work.slug"
  >
    <span class="work-card__frame">
      <ResponsivePicture
        class="work-card__image"
        :sources="work.card.sources"
        :alt="work.card.alt"
        :sizes="sizes"
        :loading="loading"
      />
    </span>
    <span class="work-card__name">{{ work.work.characterName }}</span>
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

.work-card__frame :deep(.responsive-picture) {
  height: 100%;
}

.work-card__frame :deep(.responsive-picture__image) {
  height: 100%;
  object-fit: cover;
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

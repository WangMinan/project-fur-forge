<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'

withDefaults(defineProps<{
  work: PublicWorkSummaryDto
  sizes?: string | undefined
  loading?: 'lazy' | 'eager'
}>(), {
  sizes: undefined,
  loading: 'lazy',
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
    <span class="work-card__caption">
      <span class="work-card__name">{{ work.work.characterName }}</span>
      <span class="work-card__separator" aria-hidden="true">·</span>
      <span class="work-card__meta">{{ work.work.species }}</span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.work-card {
  display: block;
  color: var(--public-text-primary);
  transition: transform var(--duration-normal) var(--easing-standard);
}

.work-card:hover {
  color: var(--public-text-primary);
}

.work-card__frame {
  display: block;
  aspect-ratio: var(--ratio-work-card);
  background: var(--image-placeholder);
  border-radius: var(--radius-image);
  overflow: hidden;
  transition: box-shadow var(--duration-normal) var(--easing-standard);
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

@media (hover: hover) and (pointer: fine) {
  .work-card:hover {
    transform: translateY(-0.25rem);
  }

  .work-card:hover .work-card__frame {
    box-shadow: 0 1rem 2.25rem rgb(17 20 25 / 0.14);
  }

  .work-card:hover .work-card__image {
    transform: scale(var(--image-hover-scale));
  }
}

@media (prefers-reduced-motion: reduce) {
  .work-card,
  .work-card__frame,
  .work-card__image {
    transition: none;
  }

  .work-card:hover,
  .work-card:hover .work-card__image {
    transform: none;
  }
}

/* 名称与物种同一行，用「·」分隔；窄屏放不下时整组换行而不是拆散分隔符。 */
.work-card__caption {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--space-2);
  margin-top: var(--space-3);
}

.work-card__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
  line-height: var(--line-height-heading);
}

.work-card__separator,
.work-card__meta {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}
</style>

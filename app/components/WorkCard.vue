<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'
import WorkIdentityLabel from '~/components/WorkIdentityLabel.vue'

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
    :class="`work-card--${work.cardOrientation}`"
    :data-work-slug="work.work.slug"
  >
    <span
      class="work-card__frame"
      :data-orientation="work.cardOrientation"
    >
      <ResponsivePicture
        class="work-card__image"
        :sources="work.card.sources"
        :alt="work.card.alt"
        :sizes="sizes"
        :loading="loading"
      />
    </span>
    <span class="work-card__caption">
      <WorkIdentityLabel
        :character-name="work.work.characterName"
        :species="work.work.species"
      />
    </span>
  </NuxtLink>
</template>

<style scoped>
/*
 * `--card-ratio` 由 public-base.css 的 .work-card--portrait / --landscape 提供
 * （容器也要读同一个值来做等高排版）。这里只消费，不重复定义。
 */
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
  aspect-ratio: var(--card-ratio);
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

.work-card__caption {
  display: block;
  margin-top: var(--space-3);
}
</style>

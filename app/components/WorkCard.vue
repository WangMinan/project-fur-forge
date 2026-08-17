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
    :data-work-slug="work.work.slug"
  >
    <span
      class="work-card__frame"
      :class="`work-card__frame--${work.cardOrientation}`"
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
.work-card {
  display: block;
  color: var(--public-text-primary);
  transition: transform var(--duration-normal) var(--easing-standard);
}

.work-card:hover {
  color: var(--public-text-primary);
}

/*
 * 竖版 3:4 是主出厂照卡片；只做了单头的领养作品回落到横版领养封面，
 * 用 16:9 承载，不把横图裁成竖版。
 */
.work-card__frame {
  display: block;
  aspect-ratio: var(--ratio-work-card);
  background: var(--image-placeholder);
  border-radius: var(--radius-image);
  overflow: hidden;
  transition: box-shadow var(--duration-normal) var(--easing-standard);
}

.work-card__frame--landscape {
  aspect-ratio: var(--ratio-work-hero);
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

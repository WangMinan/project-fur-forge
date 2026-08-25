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
      <span class="work-card__caption">
        <WorkIdentityLabel
          :character-name="work.work.characterName"
          :species="work.work.species"
        />
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.work-card {
  display: block;
  min-width: 0;
  color: var(--public-text-primary);
}

.work-card:hover {
  color: var(--public-text-primary);
}

.work-card__frame {
  position: relative;
  display: block;
  aspect-ratio: 4 / 5;
  background: var(--public-media-canvas);
  border-radius: var(--radius-image);
  overflow: hidden;
}

.work-card__frame :deep(.responsive-picture) {
  height: 100%;
}

.work-card__frame :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-card__frame[data-orientation='landscape'] :deep(.responsive-picture__image) {
  object-fit: contain;
}

.work-card__caption {
  position: absolute;
  inset: auto 0 0;
  z-index: 1;
  display: flex;
  align-items: end;
  min-height: 42%;
  padding: clamp(0.75rem, 2vw, 1.25rem);
  color: var(--public-text-inverse);
  background: linear-gradient(
    to bottom,
    transparent,
    rgb(10 12 17 / 0.16) 24%,
    rgb(10 12 17 / 0.84) 100%
  );
  pointer-events: none;
}

.work-card__caption :deep(.work-identity__details) {
  color: rgb(255 255 255 / 0.82);
}

.work-card:focus-visible {
  outline: 3px solid var(--public-focus-ring);
  outline-offset: 4px;
  border-radius: var(--radius-image);
}
</style>

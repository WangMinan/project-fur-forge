<script setup lang="ts">
import type { RouteCardFixture } from '~~/shared/fixtures/visual-home'

defineProps<{
  card: RouteCardFixture
}>()
</script>

<template>
  <NuxtLink :to="card.href" class="route-card">
    <ResponsiveAsset
      class="route-card__image"
      :src="card.media.src"
      :alt="card.media.alt"
      :width="card.media.width"
      :height="card.media.height"
      :focal-desktop="card.media.focal.desktop"
      :focal-mobile="card.media.focal.mobile"
      sizes="(min-width: 768px) 50vw, 100vw"
    />
    <span class="route-card__scrim" aria-hidden="true" />
    <span class="route-card__body">
      <span class="route-card__title">{{ card.title }}</span>
      <span class="route-card__fact">{{ card.fact }}</span>
      <span class="route-card__action">
        {{ card.action }}
        <span aria-hidden="true">→</span>
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.route-card {
  position: relative;
  display: block;
  color: var(--public-text-inverse);
  background: var(--image-placeholder);
  overflow: hidden;
}

.route-card:hover {
  color: var(--public-text-inverse);
}

.route-card__image {
  aspect-ratio: 3 / 2;
  transition: transform var(--duration-section) var(--easing-standard);
}

.route-card:hover .route-card__image {
  transform: scale(var(--image-hover-scale));
}

@media (prefers-reduced-motion: reduce) {
  .route-card:hover .route-card__image {
    transform: none;
  }
}

.route-card__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgb(17 20 25 / 0) 42%,
    var(--public-overlay-strong) 100%
  );
}

.route-card__body {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-5);
}

.route-card__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
}

.route-card__fact {
  font-size: var(--font-size-sm);
  opacity: 0.86;
}

.route-card__action {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  text-decoration: underline;
  text-underline-offset: 0.3em;
  text-decoration-color: rgb(255 255 255 / 0.55);
}
</style>

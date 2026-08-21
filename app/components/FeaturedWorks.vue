<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'
import { PUBLIC_FEATURED_LIMIT } from '~~/shared/constants/featured'

const props = defineProps<{
  available: boolean
  works: PublicWorkSummaryDto[]
}>()

const works = computed(() => (
  props.available ? props.works.slice(0, PUBLIC_FEATURED_LIMIT) : []
))

function workTo(work: PublicWorkSummaryDto) {
  return { path: work.href, query: { view: 'home-featured' } }
}
</script>

<template>
  <section
    v-if="works.length > 0"
    class="featured-works"
    aria-labelledby="featured-works-title"
    data-testid="featured-works"
    data-home-scroll-scene
  >
    <div class="featured-works__media-grid">
      <article
        v-for="(work, index) in works"
        :key="work.work.id"
        class="featured-work"
      >
        <NuxtLink
          :to="workTo(work)"
          class="featured-work__media"
          :data-work-slug="work.work.slug"
          :style="index === 0 ? { viewTransitionName: 'home-featured-media' } : undefined"
        >
          <ResponsivePicture
            :sources="work.card.sources"
            :alt="work.card.alt"
            sizes="(min-width: 1024px) 28rem, (min-width: 768px) 42vw, 100vw"
          />
        </NuxtLink>
      </article>
    </div>

    <div class="featured-works__content">
      <p class="featured-works__eyebrow">SELECTED WORKS</p>
      <h2 id="featured-works-title" class="featured-works__title">代表作品</h2>
      <p class="featured-works__description">
        这里展示两件竖版出厂照。更多角色与制作细节，请前往完整作品展示。
      </p>
      <PublicAction to="/works" class="featured-works__action">
        浏览作品展示
      </PublicAction>
    </div>
  </section>
</template>

<style scoped>
.featured-works {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 20rem);
  align-items: center;
  gap: clamp(2.5rem, 6vw, 6rem);
  width: 100%;
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-5) clamp(1rem, 2vw, 2rem);
}

.featured-works__content {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: var(--space-3);
  max-width: 20rem;
}

.featured-works__eyebrow {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.16em;
}

.featured-works__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.featured-works__media-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 25.5rem));
  justify-content: center;
  gap: clamp(1rem, 2vw, 2rem);
}

.featured-work {
  min-width: 0;
  max-width: 25.5rem;
}

.featured-work__media {
  display: block;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: var(--image-placeholder);
  border-radius: var(--radius-image);
}

.featured-work__media :deep(.responsive-picture),
.featured-work__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.featured-work__media :deep(.responsive-picture__image) {
  object-fit: cover;
  transition: transform var(--motion-duration-state) var(--motion-ease-standard);
}

.featured-works__description {
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}

@media (max-width: 1023px) {
  .featured-works {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-5);
  }

  .featured-works__content {
    order: -1;
    max-width: 32rem;
  }
}

@media (min-width: 1024px) {
  .featured-works {
    min-height: calc(100svh - var(--public-header-height));
  }
}

@media (hover: hover) and (pointer: fine) {
  .featured-work__media:hover :deep(.responsive-picture__image) {
    transform: scale(1.025) rotate(0.2deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .featured-work__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .featured-work__media:hover :deep(.responsive-picture__image) {
    transform: none;
  }
}
</style>

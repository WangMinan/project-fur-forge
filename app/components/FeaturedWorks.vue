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
const activeIndex = shallowRef(0)
const activeWork = computed(() => works.value[activeIndex.value] ?? works.value[0] ?? null)
const canNavigate = computed(() => works.value.length > 1)
const frameLabel = computed(() => String(activeIndex.value + 1).padStart(2, '0'))
const frameCount = computed(() => String(works.value.length).padStart(2, '0'))

function workTo(work: PublicWorkSummaryDto) {
  return { path: work.href, query: { view: 'home-featured' } }
}

function selectWork(step: -1 | 1) {
  if (!canNavigate.value) return
  activeIndex.value = (activeIndex.value + step + works.value.length) % works.value.length
}
</script>

<template>
  <section
    v-if="activeWork"
    class="featured-works"
    aria-labelledby="featured-works-title"
    data-testid="featured-works"
    data-home-scroll-scene
  >
    <header class="featured-works__heading">
      <h2 id="featured-works-title" class="featured-works__section-title">代表作品</h2>
    </header>

    <div class="featured-works__stage">
      <div class="featured-works__display" aria-hidden="true">
        <span>SELECTED</span>
        <span>WORKS</span>
      </div>

      <NuxtLink
        :to="workTo(activeWork)"
        class="featured-works__media"
        :data-work-slug="activeWork.work.slug"
        :aria-label="`查看代表作品：${activeWork.work.characterName}`"
      >
        <ResponsivePicture
          :sources="activeWork.card.sources"
          :alt="activeWork.card.alt"
          loading="eager"
          fetchpriority="high"
          sizes="(min-width: 1200px) 400px, (min-width: 768px) 352px, 72vw"
        />
      </NuxtLink>

      <div v-if="canNavigate" class="featured-works__controls" aria-label="代表作品切换">
        <button type="button" data-featured-action="previous" @click="selectWork(-1)">
          <span aria-hidden="true">←</span>
          <span>上一项</span>
        </button>
        <span class="featured-works__control-status" aria-label="当前代表作品序号">
          {{ frameLabel }} / {{ frameCount }}
        </span>
        <button type="button" data-featured-action="next" @click="selectWork(1)">
          <span>下一项</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div class="featured-works__content" aria-live="polite">
        <h3 class="featured-works__title">{{ activeWork.work.characterName }}</h3>
        <p class="featured-works__species">{{ activeWork.work.species }}</p>
        <PublicAction to="/works" class="featured-works__action">
          浏览作品展示
        </PublicAction>
      </div>
    </div>

    <div class="featured-works__wayfinding" aria-hidden="true">
      <span>下一幕</span>
      <span class="featured-works__wayfinding-rule" />
      <span>自设委托</span>
    </div>
  </section>
</template>

<style scoped>
.featured-works {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 1.25rem;
  min-width: 0;
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 1.25rem var(--public-page-padding) 1rem;
  overflow: clip;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  isolation: isolate;
}

.featured-works__heading {
  position: relative;
  z-index: 4;
  width: min(100%, 32rem);
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--public-text-primary);
}

.featured-works__controls,
.featured-works__wayfinding {
  font-family: var(--font-public-mono);
  font-size: 0.6875rem;
  line-height: 1.2;
  letter-spacing: 0;
}

.featured-works__section-title {
  margin-top: 0.35rem;
  font-family: var(--font-public-display);
  font-size: 2rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
}

.featured-works__stage {
  position: relative;
  display: grid;
  align-content: start;
  min-width: 0;
  min-height: 39rem;
}

.featured-works__display {
  position: absolute;
  inset: 0.25rem -0.3rem auto;
  z-index: 0;
  display: grid;
  color: var(--public-background-type);
  font-family: var(--font-public-body);
  font-size: 4rem;
  font-weight: 800;
  line-height: 0.74;
  letter-spacing: 0;
  pointer-events: none;
  user-select: none;
}

.featured-works__display span:last-child {
  justify-self: end;
}

.featured-works__media {
  position: relative;
  z-index: 2;
  justify-self: end;
  display: block;
  width: min(72%, 17.5rem);
  margin-top: 2.6rem;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: var(--radius-image);
  background: var(--image-placeholder);
}

.featured-works__media :deep(.responsive-picture),
.featured-works__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.featured-works__media :deep(.responsive-picture__image) {
  object-fit: cover;
}

.featured-works__content {
  position: relative;
  z-index: 3;
  display: grid;
  justify-items: start;
  width: min(94%, 23rem);
  margin-top: -1.4rem;
}

.featured-works__title {
  margin-top: 0.4rem;
  font-family: var(--font-public-display);
  font-size: 3rem;
  font-weight: 600;
  line-height: 0.94;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.featured-works__species {
  margin: 0.65rem 0 0 0.8rem;
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.featured-works__action {
  --public-action-primary-bg: var(--public-editorial-ink);
  --public-action-primary-border: var(--public-editorial-ink);
  --public-action-primary-hover-bg: #2a2d33;
  --public-action-primary-hover-border: #2a2d33;
  margin: 1rem 0 0 0.8rem;
}

.featured-works__controls {
  display: grid;
  grid-template-columns: auto minmax(4rem, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  width: min(100%, 19rem);
  margin: 1.15rem 0 0 0.8rem;
  color: var(--public-text-secondary);
}

.featured-works__controls button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.75rem;
  padding: 0 0.25rem;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.featured-works__controls button:last-child {
  justify-self: end;
}

.featured-works__controls button:focus-visible {
  color: var(--public-text-primary);
  outline: 1px solid currentcolor;
  outline-offset: 2px;
}

.featured-works__control-status {
  padding-top: 0.35rem;
  border-top: 1px solid var(--public-border-primary);
  text-align: center;
}

.featured-works__wayfinding-rule {
  height: 1px;
  background: var(--public-border-primary);
}

.featured-works__wayfinding {
  position: relative;
  z-index: 4;
  display: grid;
  grid-template-columns: auto minmax(2rem, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  color: var(--public-text-secondary);
}

@media (max-width: 767px) {
  .featured-works {
    gap: 0.75rem;
    min-height: 0;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .featured-works__heading {
    padding-bottom: 0.45rem;
  }

  .featured-works__section-title {
    margin-top: 0.2rem;
    font-size: 1.75rem;
  }

  .featured-works__stage {
    min-height: 0;
  }

  .featured-works__display {
    font-size: 3.5rem;
    line-height: 0.76;
  }

  .featured-works__display span:last-child {
    justify-self: end;
    margin-left: 0;
    font-size: 3.5rem;
  }

  .featured-works__media {
    width: min(54%, 14rem);
    margin-top: 6.125rem;
  }

  .featured-works__content {
    width: 100%;
    margin-top: 1rem;
  }

  .featured-works__title {
    margin-top: 0.3rem;
    font-size: 2.35rem;
    line-height: 0.95;
  }

  .featured-works__species {
    margin: 0.35rem 0 0 0.5rem;
  }

  .featured-works__action {
    margin: 0.65rem 0 0 0.5rem;
  }

  .featured-works__wayfinding {
    gap: 0.5rem;
    margin-top: 0;
    font-size: 0.625rem;
  }

  .featured-works__controls {
    width: 100%;
    margin: 0.75rem 0 0;
  }
}

@media (min-width: 768px) {
  .featured-works {
    gap: 1rem;
    height: calc(100svh - var(--public-anchor-offset));
    min-height: 0;
    padding-top: 1.5rem;
    padding-bottom: 1.25rem;
  }

  .featured-works__stage {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    align-items: center;
    height: 100%;
    min-height: 0;
  }

  .featured-works__display {
    inset: 0.6rem -0.5rem auto;
    font-size: 8rem;
  }

  .featured-works__media {
    grid-column: 8 / 12;
    grid-row: 1;
    justify-self: start;
    width: min(23rem, 43vw, calc((100svh - var(--public-anchor-offset) - 10rem) * 0.75));
    margin-top: 1.4rem;
  }

  .featured-works__content {
    grid-column: 2 / 7;
    grid-row: 1;
    align-self: end;
    width: min(100%, 29rem);
    margin: 0 0 5.25rem;
  }

  .featured-works__controls {
    grid-column: 2 / 7;
    grid-row: 1;
    align-self: end;
    margin: 0 0 0.25rem 1.15rem;
  }

  .featured-works__title {
    font-size: 3.75rem;
  }

  .featured-works__species,
  .featured-works__action {
    margin-left: 1.15rem;
  }
}

@media (min-width: 1200px) {
  .featured-works {
    height: calc(100svh - var(--public-header-height));
  }

  .featured-works__display {
    font-size: 11rem;
  }

  .featured-works__media {
    width: min(25rem, 29vw, calc((100svh - var(--public-header-height) - 10.5rem) * 0.75));
  }

  .featured-works__title {
    font-size: 4.5rem;
  }
}

@media (prefers-contrast: more) {
  .featured-works__display {
    color: var(--public-border-secondary);
  }
}
</style>

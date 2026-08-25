<script setup lang="ts">
import PublicAction from '~/components/PublicAction.vue'
import type { V00FeaturedContext } from '../types'
import { v00WorkDetailTarget } from '../types'

const props = defineProps<{ context: V00FeaturedContext }>()
const focusX = shallowRef(0)
const focusY = shallowRef(0)
const detailTarget = computed(() => v00WorkDetailTarget(props.context))
const imageStyle = computed(() => ({
  transform: `translate3d(${focusX.value}px, ${focusY.value}px, 0) scale(1.045)`,
}))

function updateFocus(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  const target = event.currentTarget as HTMLElement
  const bounds = target.getBoundingClientRect()
  focusX.value = ((event.clientX - bounds.left) / bounds.width - 0.5) * -10
  focusY.value = ((event.clientY - bounds.top) / bounds.height - 0.5) * -8
}

function resetFocus() {
  focusX.value = 0
  focusY.value = 0
}
</script>

<template>
  <section class="v00-c" aria-labelledby="v00-c-title" data-variant="featured-c">
    <div class="v00-c__composition">
      <header class="v00-c__heading">
        <p>{{ context.eyebrow }}</p>
        <p>C / LIVING MEDIA WINDOW</p>
      </header>

      <div class="v00-c__window">
        <div class="v00-c__content">
          <p class="v00-c__counter">01 / 01</p>
          <div class="v00-c__identity">
            <h1 id="v00-c-title" class="v00-c__title">{{ context.work.work.characterName }}</h1>
            <p class="v00-c__species">{{ context.work.work.species }}</p>
          </div>
          <p class="v00-c__description">{{ context.description }}</p>
          <PublicAction to="/works" class="v00-c__action">
            {{ context.ctaLabel }}
          </PublicAction>
          <p class="v00-c__hint">Move gently to refocus</p>
        </div>

        <NuxtLink
          class="v00-c__media"
          :to="detailTarget"
          @pointermove="updateFocus"
          @pointerleave="resetFocus"
          @blur="resetFocus"
        >
          <img
            :style="imageStyle"
            :src="context.imageSrc"
            :alt="context.work.card.alt"
            :width="context.imageWidth"
            :height="context.imageHeight"
            loading="eager"
            fetchpriority="high"
          >
        </NuxtLink>
      </div>

      <footer class="v00-c__rail">
        <span>STABLE FRAME</span>
        <span>INTERNAL FOCUS</span>
        <span>NO CARD LIFT</span>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.v00-c {
  min-height: 0;
  color: #20242b;
  background: #f5f4f0;
}

.v00-c__composition {
  display: grid;
  align-content: center;
  gap: 0.85rem;
  min-height: 0;
  max-width: 90rem;
  margin: 0 auto;
  padding: 1rem var(--public-page-padding) 0.85rem;
}

.v00-c__heading,
.v00-c__rail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: #656b73;
  font-family: var(--font-public-mono);
  font-size: 0.64rem;
  letter-spacing: 0.11em;
}

.v00-c__heading {
  padding-bottom: 0.55rem;
  border-bottom: 1px solid rgb(32 36 43 / 0.24);
}

.v00-c__window {
  display: grid;
  width: min(100%, 76rem);
  max-height: min(52svh, 30rem);
  min-height: 0;
  margin-inline: auto;
  overflow: hidden;
  background: #fff;
  border: 1px solid #c9cdd2;
  border-radius: 0.75rem;
}

.v00-c__content {
  display: grid;
  align-content: start;
  justify-items: start;
  padding: 1.1rem 1.15rem;
}

.v00-c__counter,
.v00-c__hint {
  color: #747b84;
  font-family: var(--font-public-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.v00-c__identity {
  margin-top: 0.75rem;
}

.v00-c__title {
  font-family: var(--font-public-display);
  font-size: clamp(2.5rem, 13vw, 4rem);
  font-weight: 500;
  line-height: 0.96;
  letter-spacing: -0.05em;
}

.v00-c__species {
  margin-top: 0.45rem;
  color: #5d646d;
  font-size: var(--font-size-sm);
}

.v00-c__description {
  max-width: 19rem;
  margin-top: 0.9rem;
  color: #4c535c;
  font-size: var(--font-size-base);
  line-height: 1.62;
}

.v00-c__action {
  --public-action-primary-text: #f5f3ed;
  --public-action-primary-bg: #20242b;
  --public-action-primary-border: #20242b;
  --public-action-primary-hover-text: #20242b;
  --public-action-primary-hover-bg: #dfe1e4;
  --public-action-primary-hover-border: #dfe1e4;
  margin-top: 0.9rem;
}

.v00-c__hint {
  display: none;
  margin-top: auto;
}

.v00-c__media {
  position: relative;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #e4e6e8;
  clip-path: inset(0 0 0 0 round 0);
  animation: v00-c-window-open 820ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.v00-c__media img {
  width: 100%;
  height: 100%;
  transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
  object-fit: cover;
  object-position: 50% 44%;
}

.v00-c__rail {
  padding-top: 0.55rem;
  border-top: 1px solid rgb(32 36 43 / 0.18);
}

.v00-c__rail span:nth-child(2) {
  display: none;
}

@keyframes v00-c-window-open {
  0% { clip-path: inset(0 0 100% 0 round 0); }
  100% { clip-path: inset(0 0 0 0 round 0); }
}

@media (max-width: 767px) {
  .v00-c__composition {
    gap: 0.6rem;
    padding-top: 0.75rem;
    padding-bottom: 0.5rem;
  }

  .v00-c__window {
    border-radius: 0.75rem;
    max-height: none;
  }

  .v00-c__content {
    padding: 0.8rem 0.85rem;
  }

  .v00-c__identity {
    margin-top: 0.45rem;
  }

  .v00-c__title {
    font-size: clamp(2.3rem, 10vw, 3rem);
  }

  .v00-c__description {
    margin-top: 0.55rem;
    line-height: 1.48;
  }

  .v00-c__action {
    margin-top: 0.65rem;
  }

  .v00-c__media {
    min-height: 0;
    height: 15rem;
  }
}

@media (min-width: 768px) {
  .v00-c {
    min-height: 0;
  }

  .v00-c__composition {
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding-block: 1.25rem 0.85rem;
  }

  .v00-c__window {
    grid-template-columns: minmax(17rem, 0.72fr) minmax(0, 1.28fr);
    height: min(52svh, 30rem);
  }

  .v00-c__content {
    padding: clamp(1.5rem, 3vw, 3rem);
  }

  .v00-c__identity {
    margin-top: auto;
  }

  .v00-c__title {
    font-size: clamp(3.8rem, 6vw, 6.2rem);
  }

  .v00-c__hint {
    display: block;
  }

  .v00-c__media {
    min-height: 0;
  }

  .v00-c__rail span:nth-child(2) {
    display: inline;
  }
}

@media (prefers-reduced-motion: reduce) {
  .v00-c__media {
    animation: none;
  }

  .v00-c__media img {
    transform: none !important;
    transition: none;
  }
}
</style>

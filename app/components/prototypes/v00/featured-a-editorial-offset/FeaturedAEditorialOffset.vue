<script setup lang="ts">
import PublicAction from '~/components/PublicAction.vue'
import { shallowRef } from 'vue'
import V00FeaturedControls from '../shared/V00FeaturedControls.vue'
import type { V00FeaturedContext, V00MotionCharacter } from '../types'
import { v00MotionProfiles, v00WorkDetailTarget } from '../types'

const props = withDefaults(defineProps<{
  context: V00FeaturedContext
  motion?: V00MotionCharacter
}>(), { motion: 'm1' })
const emit = defineEmits<{
  previous: []
  next: []
}>()
const detailTarget = computed(() => v00WorkDetailTarget(props.context))
const travelDirection = shallowRef<1 | -1>(1)
const frameLabel = computed(() => String(props.context.activeIndex + 1).padStart(2, '0'))
const motionStyle = computed(() => {
  const profile = v00MotionProfiles[props.motion]
  return {
    '--v00-motion-duration': `${profile.duration}ms`,
    '--v00-motion-distance': `${profile.distance * travelDirection.value}px`,
    '--v00-motion-cross-axis': `${profile.crossAxis * travelDirection.value}px`,
    '--v00-motion-overshoot': `${profile.overshoot * travelDirection.value}px`,
    '--v00-motion-start-scale': String(profile.scale),
    '--v00-motion-settle-scale': String(profile.scale < 1 ? 1.012 : 1),
    '--v00-motion-easing': profile.easing,
  } as Record<string, string>
})

function previous() {
  travelDirection.value = -1
  emit('previous')
}

function next() {
  travelDirection.value = 1
  emit('next')
}
</script>

<template>
  <section
    class="v00-a"
    :class="`v00-a--motion-${motion}`"
    :style="motionStyle"
    :data-motion-character="motion"
    aria-labelledby="v00-a-title"
    data-variant="featured-a"
  >
    <div class="v00-a__composition">
      <header class="v00-a__heading">
        <p class="v00-a__eyebrow">{{ context.eyebrow }}</p>
        <p class="v00-a__variant">A / EDITORIAL OFFSET</p>
      </header>

      <p class="v00-a__folio" aria-hidden="true">{{ frameLabel }}</p>

      <NuxtLink :key="`a-media-${context.activeIndex}`" class="v00-a__media" :to="detailTarget">
        <img
          :src="context.imageSrc"
          :alt="context.work.card.alt"
          :width="context.imageWidth"
          :height="context.imageHeight"
          loading="eager"
          fetchpriority="high"
        >
      </NuxtLink>

      <div :key="`a-content-${context.activeIndex}`" class="v00-a__content">
        <p class="v00-a__index">PORTRAIT / {{ frameLabel }}</p>
        <h1 id="v00-a-title" class="v00-a__title">{{ context.work.work.characterName }}</h1>
        <p class="v00-a__species">{{ context.work.work.species }}</p>
        <p class="v00-a__description">{{ context.description }}</p>
        <PublicAction to="/works" class="v00-a__action">
          {{ context.ctaLabel }}
        </PublicAction>
        <V00FeaturedControls
          class="v00-a__controls"
          :active-index="context.activeIndex"
          :count="context.items.length"
          @previous="previous"
          @next="next"
        />
      </div>

      <p class="v00-a__note">{{ frameLabel }} — Photography-led composition / quiet edge alignment</p>
    </div>
  </section>
</template>

<style scoped>
.v00-a {
  --v00-a-ink: #20242b;
  min-height: calc(100svh - var(--public-header-height) - 6.6rem);
  color: var(--v00-a-ink);
  background: #f7f6f3;
}

.v00-a__composition {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  gap: 1rem;
  min-height: inherit;
  max-width: 90rem;
  margin: 0 auto;
  padding: 1.35rem var(--public-page-padding) 1rem;
}

.v00-a__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.55rem;
  border-top: 1px solid rgb(32 36 43 / 0.38);
}

.v00-a__eyebrow,
.v00-a__variant,
.v00-a__index,
.v00-a__note {
  font-family: var(--font-public-mono);
  font-size: 0.67rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.v00-a__variant,
.v00-a__index,
.v00-a__note {
  color: #6c6c68;
}

.v00-a__folio {
  display: none;
}

.v00-a__media {
  justify-self: end;
  width: min(79vw, 19rem);
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: #e8e7e3;
  border-radius: 2px;
  clip-path: inset(0 0 0 0);
  animation: v00-a-media-arrival var(--v00-motion-duration) var(--v00-motion-easing) both;
}

.v00-a__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.v00-a__content {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: start;
  max-width: 21rem;
  padding-top: 0.3rem;
  animation: v00-a-content-arrival var(--v00-motion-duration) var(--v00-motion-easing) both;
  animation-delay: 90ms;
}

.v00-a__controls {
  margin-top: 1rem;
}

.v00-a--motion-m2 .v00-a__media {
  --v00-motion-cross-axis: 0px;
  --v00-motion-overshoot: 0px;
  --v00-motion-settle-scale: 1;
  --v00-motion-easing: cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: 0.75rem;
  box-shadow: 12px 12px 0 #d9dce0;
}

.v00-a--motion-m3 .v00-a__media {
  border-radius: 0;
  box-shadow: none;
}

.v00-a__title {
  margin-top: 0.3rem;
  font-family: var(--font-public-display);
  font-size: clamp(2.25rem, 12vw, 3.35rem);
  font-weight: 500;
  line-height: 0.98;
  letter-spacing: -0.045em;
}

.v00-a__species {
  margin-top: 0.5rem;
  color: #5f605d;
  font-size: var(--font-size-sm);
}

.v00-a__description {
  max-width: 19rem;
  margin-top: 0.85rem;
  color: #4e504f;
  font-size: var(--font-size-base);
  line-height: 1.68;
}

.v00-a__action {
  --public-action-primary-bg: var(--v00-a-ink);
  --public-action-primary-border: var(--v00-a-ink);
  margin-top: 1rem;
}

.v00-a__note {
  align-self: end;
  padding-top: 0.65rem;
  border-top: 1px solid rgb(32 36 43 / 0.2);
  line-height: 1.4;
}

@keyframes v00-a-media-arrival {
  0% {
    opacity: 0.001;
    clip-path: inset(0 0 14% 0);
    transform: translate3d(var(--v00-motion-distance), var(--v00-motion-cross-axis), 0) scale(var(--v00-motion-start-scale));
  }

  72% {
    opacity: 1;
    clip-path: inset(0 0 1% 0);
    transform: translate3d(var(--v00-motion-overshoot), calc(var(--v00-motion-cross-axis) * -0.18), 0) scale(var(--v00-motion-settle-scale));
  }

  100% {
    opacity: 1;
    clip-path: inset(0 0 0 0);
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes v00-a-content-arrival {
  from {
    opacity: 0.001;
    transform: translate3d(calc(var(--v00-motion-distance) * -0.38), calc(var(--v00-motion-cross-axis) * -0.38), 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@media (max-width: 767px) {
  .v00-a__composition {
    gap: 0.65rem;
    padding-top: 0.9rem;
    padding-bottom: 0.65rem;
  }

  .v00-a__media {
    width: min(58vw, 14rem);
  }

  .v00-a__controls {
    margin-top: 0.65rem;
  }

  .v00-a__title {
    font-size: clamp(2rem, 10vw, 2.7rem);
  }

  .v00-a__description {
    margin-top: 0.55rem;
    line-height: 1.5;
  }

  .v00-a__action {
    margin-top: 0.65rem;
  }

  .v00-a__note {
    padding-top: 0.45rem;
  }
}

@media (min-width: 768px) {
  .v00-a {
    min-height: calc(100svh - var(--public-header-height) - 3.75rem);
  }

  .v00-a__composition {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 0 1.25rem;
    padding-block: 1.5rem 1rem;
  }

  .v00-a__heading {
    grid-column: 1 / 5;
    grid-row: 1;
    align-self: start;
  }

  .v00-a__folio {
    display: block;
    grid-column: 10 / 13;
    grid-row: 2;
    align-self: end;
    justify-self: end;
    z-index: 0;
    margin-bottom: -0.07em;
    font-family: var(--font-public-display);
    font-size: clamp(7rem, 13vw, 12rem);
    font-weight: 400;
    line-height: 0.7;
    letter-spacing: -0.08em;
    opacity: 0.1;
  }

  .v00-a__media {
    grid-column: 2 / 7;
    grid-row: 1 / 3;
    align-self: center;
    justify-self: center;
    width: min(100%, 26.5rem);
    max-height: min(62svh, 35rem);
  }

  .v00-a__content {
    z-index: 2;
    grid-column: 8 / 12;
    grid-row: 2;
    align-self: end;
    padding-bottom: 1.5rem;
  }

  .v00-a__title {
    font-size: clamp(3.4rem, 5.5vw, 5.6rem);
  }

  .v00-a__note {
    position: relative;
    z-index: 1;
    grid-column: 8 / 13;
    grid-row: 3;
  }

  .v00-a__controls {
    margin-top: 1.15rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .v00-a__media,
  .v00-a__content {
    animation: none;
  }
}
</style>

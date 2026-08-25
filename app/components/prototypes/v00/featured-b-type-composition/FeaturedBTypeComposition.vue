<script setup lang="ts">
import PublicAction from '~/components/PublicAction.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import V00FeaturedControls from '../shared/V00FeaturedControls.vue'
import type { V00FeaturedContext, V00MotionCharacter } from '../types'
import { v00MotionProfiles, v00WorkDetailTarget } from '../types'

type MotionDirection = 'previous' | 'next'
type MotionState = 'arrival' | 'idle' | 'exiting' | 'entering'

interface MotionLayer {
  element: HTMLElement | null
  distance: number
  exitDistance: number
  exitDelay: number
  entryDelay: number
  duration: number
  baseOpacity: number
  exitOpacity: number
  settle?: number
}

const props = withDefaults(defineProps<{
  context: V00FeaturedContext
  motion?: V00MotionCharacter
}>(), { motion: 'm1' })
const emit = defineEmits<{
  previous: []
  next: []
}>()

const mediaLayer = shallowRef<HTMLElement | null>(null)
const roleLayer = shallowRef<HTMLElement | null>(null)
const titleLayer = shallowRef<HTMLElement | null>(null)
const supportLayer = shallowRef<HTMLElement | null>(null)
const actionLayer = shallowRef<HTMLElement | null>(null)
const travelDirection = shallowRef<1 | -1>(1)
const motionDirection = shallowRef<MotionDirection>('next')
const motionState = shallowRef<MotionState>(props.motion === 'm3' ? 'arrival' : 'idle')
const motionSequence = shallowRef(0)

let activeAnimations: Animation[] = []
let activeRun = 0
let arrivalTimer: ReturnType<typeof setTimeout> | undefined

const detailTarget = computed(() => v00WorkDetailTarget(props.context))
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

function layers(): MotionLayer[] {
  return [
    { element: mediaLayer.value, distance: 66, exitDistance: 54, exitDelay: 0, entryDelay: 0, duration: 440, baseOpacity: 1, exitOpacity: 0.001, settle: 2 },
    { element: titleLayer.value, distance: 40, exitDistance: 30, exitDelay: 22, entryDelay: 45, duration: 370, baseOpacity: 1, exitOpacity: 0.001 },
    { element: roleLayer.value, distance: 24, exitDistance: 18, exitDelay: 35, entryDelay: 80, duration: 300, baseOpacity: 1, exitOpacity: 0.001 },
    { element: supportLayer.value, distance: 20, exitDistance: 15, exitDelay: 48, entryDelay: 100, duration: 310, baseOpacity: 1, exitOpacity: 0.001 },
    { element: actionLayer.value, distance: 10, exitDistance: 8, exitDelay: 65, entryDelay: 150, duration: 300, baseOpacity: 1, exitOpacity: 0.001 },
  ]
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clearLayerStyles() {
  for (const layer of layers()) {
    if (!layer.element) continue
    layer.element.style.removeProperty('transform')
    layer.element.style.removeProperty('opacity')
  }
}

function stopActiveAnimations(commit = false) {
  for (const animation of activeAnimations) {
    if (commit && animation.playState === 'running') {
      try {
        animation.commitStyles()
      } catch {
        // The next animation still starts from the browser's computed frame.
      }
    }
    animation.cancel()
  }
  activeAnimations = []
}

function exitAnimations(sign: 1 | -1) {
  return layers().flatMap((layer) => {
    if (!layer.element) return []
    const style = getComputedStyle(layer.element)
    const transform = style.transform === 'none' ? 'translate3d(0, 0, 0)' : style.transform
    const isMedia = layer.element === mediaLayer.value
    return [layer.element.animate([
      { opacity: style.opacity, transform },
      {
        opacity: layer.exitOpacity,
        transform: `translate3d(${-sign * layer.exitDistance}px, 0, 0)${isMedia ? ' scale(0.997)' : ''}`,
      },
    ], {
      duration: Math.min(190, layer.duration * 0.52),
      delay: layer.exitDelay,
      easing: 'cubic-bezier(0.4, 0, 0.7, 0.2)',
      fill: 'forwards',
    })]
  })
}

function entryAnimations(sign: 1 | -1) {
  return layers().flatMap((layer) => {
    if (!layer.element) return []
    const isMedia = layer.element === mediaLayer.value
    const frames: Keyframe[] = isMedia
      ? [
          { offset: 0, opacity: 0.001, transform: `translate3d(${sign * layer.distance}px, 0, 0) scale(0.994)` },
          { offset: 0.86, opacity: layer.baseOpacity, transform: `translate3d(${-sign * (layer.settle ?? 0)}px, 0, 0) scale(1.001)` },
          { offset: 1, opacity: layer.baseOpacity, transform: 'translate3d(0, 0, 0) scale(1)' },
        ]
      : [
          { opacity: layer.exitOpacity, transform: `translate3d(${sign * layer.distance}px, 0, 0)` },
          { opacity: layer.baseOpacity, transform: 'translate3d(0, 0, 0)' },
        ]
    return [layer.element.animate(frames, {
      duration: layer.duration,
      delay: layer.entryDelay,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'both',
    })]
  })
}

async function waitFor(animations: Animation[]) {
  await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)))
}

function emitDirection(direction: MotionDirection) {
  if (direction === 'next') emit('next')
  else emit('previous')
}

async function navigate(direction: MotionDirection) {
  const sign = direction === 'next' ? 1 : -1
  travelDirection.value = sign
  motionDirection.value = direction

  if (props.motion !== 'm3' || prefersReducedMotion()) {
    stopActiveAnimations()
    clearLayerStyles()
    emitDirection(direction)
    motionState.value = 'idle'
    return
  }

  const run = ++activeRun
  motionSequence.value += 1
  motionState.value = 'exiting'
  await nextTick()
  if (run !== activeRun) return

  stopActiveAnimations(true)
  const exiting = exitAnimations(sign)
  activeAnimations = exiting
  await waitFor(exiting)
  if (run !== activeRun) return

  emitDirection(direction)
  await nextTick()
  if (run !== activeRun) return

  motionState.value = 'entering'
  const entering = entryAnimations(sign)
  clearLayerStyles()
  for (const animation of exiting) animation.cancel()
  activeAnimations = entering
  await waitFor(entering)
  if (run !== activeRun) return

  for (const animation of entering) animation.cancel()
  activeAnimations = []
  clearLayerStyles()
  motionState.value = 'idle'
}

function scheduleArrivalEnd() {
  if (arrivalTimer) clearTimeout(arrivalTimer)
  if (props.motion !== 'm3' || prefersReducedMotion()) {
    motionState.value = 'idle'
    return
  }
  arrivalTimer = setTimeout(() => {
    motionState.value = 'idle'
  }, 700)
}

watch(() => props.motion, (motion) => {
  activeRun += 1
  stopActiveAnimations()
  clearLayerStyles()
  motionState.value = motion === 'm3' ? 'arrival' : 'idle'
  scheduleArrivalEnd()
}, { flush: 'post' })

onMounted(scheduleArrivalEnd)
onBeforeUnmount(() => {
  activeRun += 1
  if (arrivalTimer) clearTimeout(arrivalTimer)
  stopActiveAnimations()
})
</script>

<template>
  <section
    class="v00-b"
    :class="`v00-b--motion-${motion}`"
    :style="motionStyle"
    :data-motion-character="motion"
    :data-motion-direction="motionDirection"
    :data-motion-sequence="motionSequence"
    :data-motion-state="motionState"
    aria-labelledby="v00-b-title"
    data-variant="featured-b"
  >
    <div class="v00-b__composition">
      <div class="v00-b__display" aria-hidden="true">
        <span>SELECTED</span>
        <span>WORKS</span>
      </div>

      <header class="v00-b__heading">
        <p>{{ context.eyebrow }}</p>
        <p>B / TYPE × MEDIA</p>
      </header>

      <div ref="mediaLayer" class="v00-b__media-layer" data-motion-layer="media">
        <NuxtLink class="v00-b__media" :to="detailTarget">
          <img
            :src="context.imageSrc"
            :alt="context.work.card.alt"
            :width="context.imageWidth"
            :height="context.imageHeight"
            loading="eager"
            fetchpriority="high"
          >
        </NuxtLink>
      </div>

      <p class="v00-b__number" aria-hidden="true">{{ frameLabel }}</p>

      <div class="v00-b__content">
        <p ref="roleLayer" class="v00-b__role" data-motion-layer="meta">FEATURED PORTRAIT / {{ frameLabel }}</p>
        <h1 id="v00-b-title" ref="titleLayer" class="v00-b__title" data-motion-layer="title">{{ context.work.work.characterName }}</h1>
        <div ref="supportLayer" class="v00-b__support" data-motion-layer="support">
          <p class="v00-b__species">{{ context.work.work.species }}</p>
          <p class="v00-b__description">{{ context.description }}</p>
        </div>
        <div ref="actionLayer" class="v00-b__action-layer" data-motion-layer="cta">
          <PublicAction to="/works" class="v00-b__action">
            {{ context.ctaLabel }}
          </PublicAction>
        </div>
        <V00FeaturedControls
          class="v00-b__controls"
          :active-index="context.activeIndex"
          :count="context.items.length"
          :preview-single="motion === 'm3'"
          @previous="navigate('previous')"
          @next="navigate('next')"
        />
      </div>

      <div v-if="motion === 'm3'" class="v00-b__rail-line" aria-hidden="true" />
      <p v-else class="v00-b__rail">TYPE IS SPACE · MEDIA IS THE ANCHOR · 2026</p>
    </div>
  </section>
</template>

<style scoped>
.v00-b {
  min-height: calc(100svh - var(--public-header-height) - 6.6rem);
  overflow: hidden;
  color: #111317;
  background: #fff;
}

.v00-b__composition {
  position: relative;
  display: grid;
  align-content: center;
  min-height: inherit;
  max-width: 90rem;
  margin: 0 auto;
  padding: 1.1rem var(--public-page-padding) 0.9rem;
}

.v00-b__display {
  position: absolute;
  inset: 1.25rem -0.35rem auto;
  z-index: 0;
  display: grid;
  color: #eef0f3;
  font-family: var(--font-public-body);
  font-size: clamp(3.5rem, 18vw, 5.2rem);
  font-weight: 800;
  line-height: 0.73;
  letter-spacing: 0;
  pointer-events: none;
  text-transform: uppercase;
}

.v00-b__display span:last-child {
  justify-self: end;
}

.v00-b__heading {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid #111317;
  font-family: var(--font-public-mono);
  font-size: 0.65rem;
  letter-spacing: 0;
}

.v00-b__media-layer {
  position: relative;
  z-index: 1;
  justify-self: center;
  width: min(70vw, 17.5rem);
  margin-top: 2.6rem;
  aspect-ratio: 3 / 4;
  background: #eceef1;
  isolation: isolate;
}

.v00-b__media {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
}

.v00-b__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: v00-b-media-in var(--v00-motion-duration) var(--v00-motion-easing) both;
}

.v00-b__number {
  position: absolute;
  z-index: 2;
  top: 10rem;
  left: var(--public-page-padding);
  color: #111317;
  font-family: var(--font-public-body);
  font-size: clamp(4.6rem, 22vw, 7rem);
  font-weight: 800;
  line-height: 0.8;
  letter-spacing: 0;
  writing-mode: vertical-rl;
}

.v00-b__content {
  position: relative;
  z-index: 3;
  display: grid;
  justify-items: start;
  width: min(100%, 21.5rem);
  margin-top: -2.4rem;
  padding: 1rem 1rem 0 0;
  background: transparent;
  animation: v00-b-content-in var(--v00-motion-duration) var(--v00-motion-easing) both;
  animation-delay: 90ms;
}

.v00-b__role,
.v00-b__rail {
  color: #666c75;
  font-family: var(--font-public-mono);
  font-size: 0.65rem;
  letter-spacing: 0;
}

.v00-b__title {
  margin-top: 0.35rem;
  font-family: var(--font-public-display);
  font-size: clamp(2.5rem, 13vw, 4rem);
  font-weight: 600;
  line-height: 0.94;
  letter-spacing: 0;
}

.v00-b__support {
  display: grid;
}

.v00-b__species {
  margin-top: 0.5rem;
  color: #555b63;
  font-size: var(--font-size-sm);
}

.v00-b__description {
  max-width: 19rem;
  margin-top: 0.75rem;
  color: #41464d;
  font-size: var(--font-size-base);
  line-height: 1.6;
}

.v00-b__action {
  --public-action-primary-bg: #111317;
  --public-action-primary-border: #111317;
  margin-top: 0.9rem;
}

.v00-b__controls {
  margin-top: 1rem;
}

.v00-b__rail,
.v00-b__rail-line {
  align-self: end;
  margin-top: 0.8rem;
  padding-top: 0.55rem;
  border-top: 1px solid #c8ccd2;
}

.v00-b--motion-m2 .v00-b__media-layer {
  --v00-motion-cross-axis: 0px;
  --v00-motion-overshoot: 0px;
  --v00-motion-settle-scale: 1;
  --v00-motion-easing: cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: 0.75rem;
  box-shadow: 12px 12px 0 #d9dce0;
}

.v00-b--motion-m3 .v00-b__media-layer {
  border-radius: 0;
  box-shadow: none;
}

.v00-b--motion-m3 .v00-b__media img,
.v00-b--motion-m3 .v00-b__content {
  animation: none;
}

.v00-b--motion-m3 .v00-b__role {
  margin-left: -0.75rem;
}

.v00-b--motion-m3 .v00-b__support,
.v00-b--motion-m3 .v00-b__action-layer {
  margin-left: 1.1rem;
}

.v00-b--motion-m3 .v00-b__controls {
  margin-left: 0.45rem;
}

.v00-b--motion-m3 :deep(.v00-featured-controls) {
  display: grid;
  grid-template-columns: auto minmax(3.5rem, 1fr) auto;
  gap: 0.45rem;
  width: min(100%, 18rem);
  letter-spacing: 0;
}

.v00-b--motion-m3 :deep(.v00-featured-controls button) {
  gap: 0.4rem;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0 0.25rem;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.v00-b--motion-m3 :deep(.v00-featured-controls button:hover),
.v00-b--motion-m3 :deep(.v00-featured-controls button:focus-visible) {
  color: #111317;
  background: transparent;
}

.v00-b--motion-m3 :deep(.v00-featured-controls button:focus-visible) {
  outline: 1px solid currentcolor;
  outline-offset: 2px;
}

.v00-b--motion-m3 :deep(.v00-featured-controls__arrow) {
  display: inline-block;
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.v00-b--motion-m3 :deep(.v00-featured-controls button:first-child:hover .v00-featured-controls__arrow),
.v00-b--motion-m3 :deep(.v00-featured-controls button:first-child:focus-visible .v00-featured-controls__arrow) {
  transform: translateX(-0.2rem);
}

.v00-b--motion-m3 :deep(.v00-featured-controls button:last-child:hover .v00-featured-controls__arrow),
.v00-b--motion-m3 :deep(.v00-featured-controls button:last-child:focus-visible .v00-featured-controls__arrow) {
  transform: translateX(0.2rem);
}

.v00-b--motion-m3 :deep(.v00-featured-controls__status) {
  align-self: center;
  min-width: 0;
  padding-top: 0.35rem;
  border-top: 1px solid #c8ccd2;
}

.v00-b--motion-m3[data-motion-state="arrival"] [data-motion-layer] {
  animation: v00-b-m3-arrival var(--arrival-duration, 320ms) cubic-bezier(0.16, 1, 0.3, 1) var(--arrival-delay, 0ms) both;
}

.v00-b--motion-m3[data-motion-state="arrival"] [data-motion-layer="media"] {
  --arrival-distance: 66px;
  --arrival-duration: 440ms;
}

.v00-b--motion-m3[data-motion-state="arrival"] [data-motion-layer="title"] {
  --arrival-distance: 40px;
  --arrival-duration: 370ms;
  --arrival-delay: 45ms;
}

.v00-b--motion-m3[data-motion-state="arrival"] [data-motion-layer="meta"] {
  --arrival-distance: 24px;
  --arrival-duration: 300ms;
  --arrival-delay: 80ms;
}

.v00-b--motion-m3[data-motion-state="arrival"] [data-motion-layer="support"] {
  --arrival-distance: 20px;
  --arrival-duration: 310ms;
  --arrival-delay: 100ms;
}

.v00-b--motion-m3[data-motion-state="arrival"] [data-motion-layer="cta"] {
  --arrival-distance: 10px;
  --arrival-duration: 300ms;
  --arrival-delay: 150ms;
}

@keyframes v00-b-media-in {
  from {
    opacity: 0.001;
    transform: translate3d(0, 0, 0) scale(var(--v00-motion-start-scale));
  }

  72% {
    opacity: 1;
    transform: translate3d(var(--v00-motion-overshoot), calc(var(--v00-motion-cross-axis) * -0.18), 0) scale(var(--v00-motion-settle-scale));
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes v00-b-content-in {
  from {
    opacity: 0.001;
    transform: translate3d(calc(var(--v00-motion-distance) * -0.38), calc(var(--v00-motion-cross-axis) * -0.38), 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes v00-b-m3-arrival {
  from {
    opacity: var(--arrival-opacity, 0.001);
    transform: translate3d(var(--arrival-distance, 0), 0, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@media (max-width: 767px) {
  .v00-b__composition {
    gap: 0.6rem;
    padding-top: 0.85rem;
    padding-bottom: 0.55rem;
  }

  .v00-b__display {
    inset: 0.9rem -0.35rem auto;
    font-size: clamp(3rem, 15vw, 4.3rem);
  }

  .v00-b__media-layer {
    width: min(58vw, 14rem);
    margin-top: 1.05rem;
  }

  .v00-b__content {
    margin-top: -0.65rem;
    padding-top: 0.65rem;
  }

  .v00-b__controls {
    margin-top: 0.65rem;
  }

  .v00-b__title {
    font-size: clamp(2.2rem, 10vw, 3rem);
  }

  .v00-b__description {
    margin-top: 0.55rem;
    line-height: 1.5;
  }

  .v00-b__action {
    margin-top: 0.65rem;
  }

  .v00-b__rail,
  .v00-b__rail-line {
    margin-top: 0.5rem;
    padding-top: 0.4rem;
  }

  .v00-b--motion-m3 .v00-b__role {
    margin-left: -0.25rem;
  }

  .v00-b--motion-m3 .v00-b__support,
  .v00-b--motion-m3 .v00-b__action-layer {
    margin-left: 0.6rem;
  }

  .v00-b--motion-m3 .v00-b__controls {
    margin-left: 0;
  }

  .v00-b--motion-m3 .v00-b__number {
    opacity: 0.14;
  }
}

@media (min-width: 768px) {
  .v00-b {
    min-height: calc(100svh - var(--public-header-height) - 3.75rem);
  }

  .v00-b__composition {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 0 1.25rem;
    padding-block: 1.35rem 0.85rem;
  }

  .v00-b__display {
    inset: 7% 0 auto;
    font-size: clamp(7rem, 12.5vw, 12rem);
    line-height: 0.72;
  }

  .v00-b__heading {
    grid-column: 1 / 6;
    grid-row: 1;
  }

  .v00-b__media-layer {
    grid-column: 6 / 10;
    grid-row: 1 / 3;
    align-self: center;
    width: min(100%, 25rem);
    max-height: min(61svh, 35rem);
    margin-top: 0;
  }

  .v00-b--motion-m3 .v00-b__media-layer {
    grid-column: 7 / 12;
  }

  .v00-b__number {
    top: auto;
    right: 0.4rem;
    bottom: 1rem;
    left: auto;
    font-size: clamp(8rem, 15vw, 14rem);
    writing-mode: initial;
    opacity: 0.11;
  }

  .v00-b__content {
    grid-column: 2 / 6;
    grid-row: 2;
    align-self: end;
    width: auto;
    margin: 0 0 2.1rem;
    padding: 1.2rem 0;
  }

  .v00-b__title {
    font-size: clamp(4rem, 6.7vw, 6.6rem);
  }

  .v00-b__rail,
  .v00-b__rail-line {
    grid-column: 10 / 13;
    grid-row: 3;
    align-self: end;
  }

  .v00-b__controls {
    margin-top: 1.15rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .v00-b__media img,
  .v00-b__content,
  .v00-b--motion-m3[data-motion-state="arrival"] [data-motion-layer] {
    animation: none;
  }

  .v00-b--motion-m3 :deep(.v00-featured-controls__arrow) {
    transition: none;
  }
}
</style>

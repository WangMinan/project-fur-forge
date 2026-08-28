<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'
import { PUBLIC_FEATURED_LIMIT } from '~~/shared/constants/featured'
import { animateDirectionalLayers } from '~/utils/hero-carousel'

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
const activeFrameLabel = computed(() => String(activeIndex.value + 1).padStart(2, '0'))
const totalFrameLabel = computed(() => String(works.value.length).padStart(2, '0'))
const titleRef = useTemplateRef<HTMLElement>('title')
const speciesRef = useTemplateRef<HTMLElement>('species')
const transitionDirection = shallowRef<'next' | 'prev'>('next')
const motionSequence = shallowRef(0)
const userPaused = shallowRef(false)
const controlsRevealed = shallowRef(false)
const mediaTransitionName = computed(() => `featured-media-${transitionDirection.value}`)

const { reduceMotion, restart: restartAutoplayTimer } = useCarouselPlayback({
  advance: () => selectWork(1, false),
  enabled: () => canNavigate.value && !userPaused.value,
})

let controlsTimer: ReturnType<typeof setTimeout> | null = null
let textAnimations: Animation[] = []

function stopControlsTimer() {
  if (controlsTimer !== null) {
    clearTimeout(controlsTimer)
    controlsTimer = null
  }
}

function revealControls(timeout = 2_400) {
  controlsRevealed.value = true
  stopControlsTimer()
  if (!userPaused.value) {
    controlsTimer = setTimeout(() => {
      controlsRevealed.value = false
      controlsTimer = null
    }, timeout)
  }
}

function animateText(direction: -1 | 1, sequence: number) {
  for (const animation of textAnimations) animation.cancel()
  textAnimations = []
  if (reduceMotion.value || sequence !== motionSequence.value) return
  const easing = getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-ease-standard')
    .trim()
  const layers = [
    { element: titleRef.value, distance: 24, duration: 380, delay: 30 },
    { element: speciesRef.value, distance: 16, duration: 340, delay: 75 },
  ]
  textAnimations = animateDirectionalLayers(layers, direction, easing)
}

function selectWork(step: -1 | 1, restartAutoplay = true) {
  if (!canNavigate.value) return
  transitionDirection.value = step === 1 ? 'next' : 'prev'
  motionSequence.value += 1
  const sequence = motionSequence.value
  activeIndex.value = (activeIndex.value + step + works.value.length) % works.value.length
  void nextTick(() => animateText(step, sequence))
  if (restartAutoplay) restartAutoplayTimer()
}

function selectWorkAt(index: number) {
  if (!canNavigate.value || index === activeIndex.value) return
  const step = index > activeIndex.value ? 1 : -1
  transitionDirection.value = step === 1 ? 'next' : 'prev'
  motionSequence.value += 1
  const sequence = motionSequence.value
  activeIndex.value = index
  void nextTick(() => animateText(step, sequence))
  restartAutoplayTimer()
}

function togglePause() {
  userPaused.value = !userPaused.value
  revealControls()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    selectWork(-1)
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    selectWork(1)
  }
}

function revealForFinePointer(event: MouseEvent) {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = (event.clientX - bounds.left) / bounds.width
  const y = (event.clientY - bounds.top) / bounds.height
  if (!controlsRevealed.value && (x <= 0.16 || x >= 0.84 || y >= 0.72)) {
    revealControls()
  }
}

let pointerStartX: number | null = null

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    revealControls(4_000)
  }
  if ((event.target as HTMLElement | null)?.closest('button, a')) {
    pointerStartX = null
    return
  }
  pointerStartX = event.clientX
}

function onPointerUp(event: PointerEvent) {
  if (pointerStartX === null) {
    return
  }
  const direction = resolveSwipeDirection(event.clientX - pointerStartX)
  pointerStartX = null
  if (direction === 'next') {
    selectWork(1)
  }
  else if (direction === 'prev') {
    selectWork(-1)
  }
}

function onPointerCancel() {
  pointerStartX = null
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType === 'mouse') {
    revealForFinePointer(event)
  }
}

function onPointerLeave() {
  if (!userPaused.value) {
    stopControlsTimer()
    controlsRevealed.value = false
  }
}

function onHeroClick(event: MouseEvent) {
  if ((event.target as HTMLElement | null)?.closest('button, a')) {
    return
  }
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) {
    revealControls(4_000)
  }
}

watch(() => works.value.length, (count) => {
  activeIndex.value = clampSlideIndex(activeIndex.value, count)
})

onBeforeUnmount(() => {
  stopControlsTimer()
  for (const animation of textAnimations) animation.cancel()
})
</script>

<template>
  <section
    v-if="activeWork"
    class="featured-works"
    aria-labelledby="featured-works-title"
    data-testid="featured-works"
    data-home-scroll-scene
    :data-paused="userPaused"
    :data-controls-revealed="controlsRevealed"
    :data-reduced-motion="reduceMotion"
    role="region"
    aria-roledescription="carousel"
    @keydown="onKeydown"
    @click="onHeroClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @mousemove="revealForFinePointer"
    @pointerleave="onPointerLeave"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
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
        :to="activeWork.href"
        class="featured-works__media"
        :data-work-slug="activeWork.work.slug"
        :aria-label="`查看代表作品：${activeWork.work.characterName}`"
      >
        <Transition :name="mediaTransitionName">
          <span :key="activeWork.work.slug" class="featured-works__media-surface">
            <ResponsivePicture
              :sources="activeWork.card.sources"
              :alt="activeWork.card.alt"
              loading="eager"
              fetchpriority="high"
              sizes="(min-width: 1200px) 400px, (min-width: 768px) 352px, 72vw"
            />
          </span>
        </Transition>
      </NuxtLink>

      <div class="featured-works__info">
        <div
          v-if="canNavigate"
          class="featured-works__controls"
          aria-label="代表作品切换"
          data-featured-layout="controls"
          role="group"
        >
          <p class="featured-works__counter" aria-hidden="true">
            {{ activeFrameLabel }} / {{ totalFrameLabel }}
          </p>
          <button
            type="button"
            class="featured-works__control-arrow"
            data-featured-action="previous"
            aria-label="上一项代表作品"
            @click="selectWork(-1)"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M11.5 3.5 6 9l5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div class="featured-works__dots" role="group" aria-label="代表作品分页">
            <button
              v-for="(work, index) in works"
              :key="work.work.id"
              type="button"
              class="featured-works__dot"
              :class="{ 'featured-works__dot--active': index === activeIndex }"
              :aria-label="`第 ${index + 1} 件代表作品，共 ${works.length} 件`"
              :aria-current="index === activeIndex ? 'true' : undefined"
              @click="selectWorkAt(index)"
            />
          </div>
          <button
            type="button"
            class="featured-works__control-arrow"
            data-featured-action="next"
            aria-label="下一项代表作品"
            @click="selectWork(1)"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M6.5 3.5 12 9l-5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            v-if="!reduceMotion"
            type="button"
            class="featured-works__pause"
            data-featured-action="pause"
            :aria-pressed="userPaused"
            :aria-label="userPaused ? '继续自动轮播' : '暂停自动轮播'"
            @click="togglePause"
          >
            <svg v-if="userPaused" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M4 2.5v9l7-4.5-7-4.5z" fill="currentColor" />
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3.5 2.5v9M10.5 2.5v9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="featured-works__content-stack" aria-live="polite">
          <div class="featured-works__text-stack">
            <div
              class="featured-works__content"
              :data-featured-content="activeWork.work.slug"
            >
              <h3 ref="title" class="featured-works__title" data-featured-layout="title">{{ activeWork.work.characterName }}</h3>
              <p ref="species" class="featured-works__species" data-featured-layout="species">{{ activeWork.work.species }}</p>
            </div>
          </div>
          <div class="featured-works__action-layer" data-featured-layout="action">
            <PublicAction to="/works" class="featured-works__action">
              浏览作品展示
            </PublicAction>
          </div>
        </div>
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
  min-height: calc(100svh - var(--public-header-height));
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 1.25rem var(--public-page-padding) 1rem;
  overflow: clip;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  isolation: isolate;
}

@supports (height: 100dvh) {
  .featured-works {
    min-height: calc(100dvh - var(--public-header-height));
  }
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
  font-family: var(--font-role-metadata);
  font-size: 0.6875rem;
  line-height: 1.2;
  letter-spacing: 0;
}

.featured-works__section-title {
  margin-top: 0.35rem;
  font-family: var(--font-role-display);
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
  font-family: var(--font-role-display-sans);
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
  display: grid;
  width: min(72%, 17.5rem);
  margin-top: 2.6rem;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-image);
}

.featured-works__media-surface {
  grid-area: 1 / 1;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: var(--radius-image);
}

.featured-works__media-surface :deep(.responsive-picture),
.featured-works__media-surface :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.featured-works__media-surface :deep(.responsive-picture) {
  overflow: hidden;
  border-radius: var(--radius-image);
}

.featured-works__media-surface :deep(.responsive-picture__image) {
  border-radius: var(--radius-image);
  object-fit: cover;
}

.featured-media-next-enter-active,
.featured-media-next-leave-active,
.featured-media-prev-enter-active,
.featured-media-prev-leave-active {
  transition:
    opacity 420ms var(--motion-ease-standard),
    transform var(--motion-duration-media) var(--motion-ease-standard);
}

.featured-media-next-enter-from,
.featured-media-prev-leave-to {
  opacity: 0;
  transform: translate3d(42px, 0, 0) scale(0.99);
}

.featured-media-next-leave-to,
.featured-media-prev-enter-from {
  opacity: 0;
  transform: translate3d(-42px, 0, 0) scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
  .featured-media-next-enter-active,
  .featured-media-next-leave-active,
  .featured-media-prev-enter-active,
  .featured-media-prev-leave-active {
    transition: none;
  }
}

.featured-works__info {
  position: relative;
  z-index: 3;
  display: grid;
  min-width: 0;
}

.featured-works__content-stack {
  display: block;
  min-width: 0;
  animation: none;
  transition: none;
}

.featured-works__text-stack {
  display: block;
  min-width: 0;
}

.featured-works__content {
  position: relative;
  display: grid;
  justify-items: start;
  width: min(94%, 23rem);
  margin-top: -1.4rem;
  transition: none;
}

.featured-works__title {
  margin-top: 0.4rem;
  font-family: var(--font-role-display);
  font-size: 3rem;
  font-weight: 600;
  line-height: 0.94;
  letter-spacing: 0;
  animation: none;
  transition: none;
}

.featured-works__species {
  margin: 0.65rem 0 0 0.8rem;
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  animation: none;
  transition: none;
}

.featured-works__action {
  margin: 1rem 0 0 0.8rem;
}

.featured-works__action-layer {
  display: grid;
  justify-items: start;
  animation: none;
  transition: none;
}

.featured-works__controls {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  width: fit-content;
  margin: 1.15rem 0 0 0.8rem;
  color: var(--public-text-secondary);
}

.featured-works__counter {
  min-width: 3.75rem;
  margin-right: var(--space-2);
  color: var(--public-text-secondary);
  font-family: var(--font-role-metadata);
  font-size: 0.6875rem;
  letter-spacing: var(--type-metadata-letter-spacing);
  white-space: nowrap;
}

.featured-works__controls button {
  display: grid;
  width: max(2.75rem, 44px);
  height: max(2.75rem, 44px);
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
  place-items: center;
}

.featured-works__control-arrow,
.featured-works__pause {
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px) scale(0.96);
  transition:
    color var(--motion-duration-feedback) var(--motion-ease-standard),
    opacity var(--motion-duration-state) var(--motion-ease-standard),
    transform var(--motion-duration-state) var(--motion-ease-standard);
}

.featured-works[data-controls-revealed='true'] .featured-works__control-arrow,
.featured-works[data-controls-revealed='true'] .featured-works__pause,
.featured-works[data-paused='true'] .featured-works__control-arrow,
.featured-works[data-paused='true'] .featured-works__pause,
.featured-works:focus-within .featured-works__control-arrow,
.featured-works:focus-within .featured-works__pause {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

.featured-works__dots {
  display: flex;
  align-items: center;
  gap: 0.1875rem;
}

.featured-works__dot::before {
  display: block;
  width: 1.75rem;
  height: 1px;
  background: currentcolor;
  content: '';
  opacity: 0.4;
  transform: scaleX(0.55);
  transition:
    opacity var(--motion-duration-state) var(--motion-ease-standard),
    transform var(--motion-duration-state) var(--motion-ease-standard);
}

.featured-works__dot--active::before {
  opacity: 1;
  transform: scaleX(1);
}

.featured-works__dot:active::before {
  transform: scaleX(0.8);
}

.featured-works[data-reduced-motion='true'] .featured-works__pause {
  display: none;
}

.featured-works__controls button:focus-visible {
  color: var(--public-text-primary);
  outline: 3px solid var(--public-focus-ring);
  outline-offset: 3px;
}

.featured-works__controls button:active:not(:disabled) {
  color: var(--public-accent-active);
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
    padding-top: clamp(1.5rem, 4dvh, 2.5rem);
  }

  .featured-works__display {
    top: clamp(1.5rem, 4dvh, 2.5rem);
    font-size: 3.5rem;
    line-height: 0.76;
  }

  .featured-works__display span:last-child {
    justify-self: end;
    margin-left: 0;
    font-size: 3.5rem;
  }

  .featured-works__media {
    width: min(64%, 16rem, calc((100dvh - 25rem) * 0.8));
    margin-top: 5.75rem;
  }

  .featured-works__media::before {
    position: absolute;
    top: 42%;
    left: clamp(-2.5rem, -10vw, -1.5rem);
    width: 0.9rem;
    height: 1.05rem;
    background: var(--public-accent-primary);
    clip-path: polygon(0 0, 100% 50%, 0 100%);
    content: '';
  }

  .featured-works__content {
    width: 100%;
    margin-top: clamp(1rem, 2.5dvh, 1.5rem);
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
    margin: 1rem 0 0;
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
    transform: translateY(-1.75rem);
  }

  .featured-works__info {
    grid-column: 2 / 7;
    grid-row: 1;
    align-self: center;
    gap: clamp(1.75rem, 3vh, 2.5rem);
    width: min(100%, 31rem);
    margin-top: clamp(2.5rem, 6vh, 4.5rem);
  }

  .featured-works__content-stack {
    order: 1;
  }

  .featured-works__content {
    width: min(100%, 29rem);
    margin: 0;
  }

  .featured-works__controls {
    order: 2;
    margin: 0 0 0 1.15rem;
  }

  .featured-works__title {
    display: block;
    min-width: 0;
    max-width: 100%;
    font-size: 3.25rem;
    white-space: nowrap;
    overflow-wrap: normal;
    overflow: hidden;
    text-overflow: ellipsis;
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
    grid-column: 7 / 12;
    width: min(34rem, 36vw, calc((100svh - var(--public-header-height) - 8.75rem) * 0.75));
  }

  .featured-works__title {
    font-size: 3.75rem;
    white-space: nowrap;
  }
}

@media (prefers-contrast: more) {
  .featured-works__display {
    color: var(--public-border-secondary);
  }
}

</style>

<script setup lang="ts">
import type { PublicAdoptionListItemDto } from '~~/shared/types/contracts'
import { formatCnyMinorUnits } from '~/utils/format'
import { useMotionEntrance } from '~/composables/useMotionEntrance'
import {
  animateDirectionalLayers,
  nextSlideIndex,
  prevSlideIndex,
} from '~/utils/hero-carousel'

/**
 * T34-F2 当前领养：入口与状态已合并到 HomeBusinessEntries，本区只保留真实领养。
 * 聚合投影标记该区块不可用时整区隐藏，不显示服务端错误详情。
 */
const props = defineProps<{
  adoptions: PublicAdoptionListItemDto[]
  available: boolean
}>()

const visibleAdoptions = computed(() => props.adoptions
  .filter(item => item.work.adoptionStatus === 'available')
  .slice(0, 3),
)
const activeIndex = shallowRef(0)
const hasMultipleAdoptions = computed(() => visibleAdoptions.value.length > 1)
const currentAdoption = computed(() => visibleAdoptions.value[activeIndex.value] ?? null)
const price = computed(() => currentAdoption.value?.work.price
  ? formatCnyMinorUnits(currentAdoption.value.work.price.minorUnits)
  : null,
)
const rootRef = useTemplateRef<HTMLElement>('root')
const mediaRef = useTemplateRef<HTMLElement>('media')
const captionRef = useTemplateRef<HTMLElement>('caption')
const titleRef = useTemplateRef<HTMLElement>('title')
const factsRef = useTemplateRef<HTMLElement>('facts')
const actionsRef = useTemplateRef<HTMLElement>('actions')
const transitionDirection = shallowRef<'next' | 'prev'>('next')
const transitionIntent = shallowRef<'autoplay' | 'pointer'>('autoplay')
const motionSequence = shallowRef(0)
const mediaTransitionName = computed(() => `home-adoption-media-${transitionDirection.value}`)
const detailTo = computed(() => currentAdoption.value
  ? {
      path: currentAdoption.value.href,
      query: { from: 'adoptions' },
    }
  : '/adoptions',
)

const { reduceMotion, restart: restartAutoplay } = useCarouselPlayback({
  advance: () => selectNextAdoption('autoplay'),
  enabled: () => hasMultipleAdoptions.value,
})

let recordAnimations: Animation[] = []

watch(
  () => visibleAdoptions.value.map(item => item.work.slug).join('|'),
  () => {
    activeIndex.value = 0
    restartAutoplay()
  },
)

function formatFolio(index: number) {
  return String(index + 1).padStart(2, '0')
}

function animateRecord(direction: 'next' | 'prev', sequence: number) {
  for (const animation of recordAnimations) animation.cancel()
  recordAnimations = []
  if (reduceMotion.value || sequence !== motionSequence.value) return
  const easing = getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-ease-standard')
    .trim()
  const sign = direction === 'next' ? 1 : -1
  const layers = [
    { element: titleRef.value, distance: 24, duration: 380, delay: 30 },
    { element: factsRef.value, distance: 16, duration: 340, delay: 75 },
    { element: actionsRef.value, distance: 8, duration: 280, delay: 145 },
  ]
  recordAnimations = animateDirectionalLayers(layers, sign, easing)
}

function setAdoption(
  index: number,
  direction: 'next' | 'prev',
  intent: 'autoplay' | 'pointer' = 'pointer',
) {
  if (
    index < 0
    || index >= visibleAdoptions.value.length
    || index === activeIndex.value
  ) {
    return
  }
  transitionDirection.value = direction
  transitionIntent.value = intent
  motionSequence.value += 1
  const sequence = motionSequence.value
  activeIndex.value = index
  void nextTick(() => animateRecord(direction, sequence))
  if (intent !== 'autoplay') restartAutoplay()
}

function selectAdoption(index: number) {
  setAdoption(index, index > activeIndex.value ? 'next' : 'prev')
}

function selectPreviousAdoption(intent: 'autoplay' | 'pointer' = 'pointer') {
  const count = visibleAdoptions.value.length
  if (count > 1) {
    setAdoption(prevSlideIndex(activeIndex.value, count), 'prev', intent)
  }
}

function selectNextAdoption(intent: 'autoplay' | 'pointer' = 'pointer') {
  const count = visibleAdoptions.value.length
  if (count > 1) {
    setAdoption(nextSlideIndex(activeIndex.value, count), 'next', intent)
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    selectPreviousAdoption()
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    selectNextAdoption()
  }
}

let pointerStartX: number | null = null

function onPointerDown(event: PointerEvent) {
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
    selectNextAdoption()
  }
  else if (direction === 'prev') {
    selectPreviousAdoption()
  }
}

function onPointerCancel() {
  pointerStartX = null
}

useMotionEntrance(rootRef, ({ reduced, tokens }) => {
  const media = mediaRef.value
  const caption = captionRef.value
  if (!media || !caption) {
    return []
  }
  if (reduced) return []
  return [
    media.animate(
      [
        {
          clipPath: 'inset(0 0 8% 0 round 12px)',
          opacity: 0.72,
          transform: 'scale(0.99)',
        },
        {
          clipPath: 'inset(0 0 0 0 round 12px)',
          opacity: 1,
          transform: 'scale(1)',
        },
      ],
      { duration: tokens.media, easing: tokens.easing, fill: 'both' },
    ),
    caption.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: tokens.content, delay: 100, easing: tokens.easing, fill: 'both' },
    ),
  ]
})

onBeforeUnmount(() => {
  for (const animation of recordAnimations) animation.cancel()
})
</script>

<template>
  <section
    v-if="available && currentAdoption"
    ref="root"
    class="home-adoptions"
    aria-labelledby="home-adoptions-title"
    data-home-scroll-scene
    data-testid="home-current-adoptions"
    :data-motion-direction="transitionDirection"
    :data-motion-intent="transitionIntent"
    :data-motion-sequence="motionSequence"
    :data-reduced-motion="reduceMotion"
    role="region"
    aria-roledescription="carousel"
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <header class="home-adoptions__heading">
      <h2 id="home-adoptions-title" class="home-adoptions__title">设定领养</h2>
    </header>

    <article
      class="home-adoption-poster"
      :class="{ 'home-adoption-poster--multiple': hasMultipleAdoptions }"
      :data-work-slug="currentAdoption.work.slug"
    >
      <div class="home-adoption-poster__display" aria-hidden="true">
        <span>ADOPTIONS</span>
      </div>

      <NuxtLink
        class="home-adoption-poster__media"
        :to="detailTo"
        :aria-label="`查看${currentAdoption.work.characterName}领养详情`"
        data-testid="home-adoption-media-link"
      >
        <Transition :name="mediaTransitionName">
          <span
            :key="currentAdoption.work.slug"
            ref="media"
            class="home-adoption-poster__media-surface"
          >
            <ResponsivePicture
              :sources="currentAdoption.cover.sources"
              :alt="currentAdoption.cover.alt"
              sizes="(min-width: 1025px) 68vw, 100vw"
              loading="eager"
            />
          </span>
        </Transition>
      </NuxtLink>

      <nav
        v-if="hasMultipleAdoptions"
        class="home-adoption-poster__selector"
        aria-label="首页领养角色选择"
        data-testid="home-adoption-selector"
        :style="{ gridTemplateColumns: `repeat(${visibleAdoptions.length}, minmax(0, 1fr))` }"
      >
        <button
          v-for="(adoption, index) in visibleAdoptions"
          :key="adoption.work.id"
          class="home-adoption-poster__selector-item"
          :class="{ 'home-adoption-poster__selector-item--active': index === activeIndex }"
          type="button"
          :aria-current="index === activeIndex ? 'true' : undefined"
          :data-work-slug="adoption.work.slug"
          @click="selectAdoption(index)"
        >
          <span>{{ formatFolio(index) }}</span>
          <strong>{{ adoption.work.characterName }}</strong>
        </button>
      </nav>

      <div ref="caption" class="home-adoption-poster__caption" aria-live="polite">
        <p class="home-adoption-poster__folio">
          <span>角色选择</span>
          <strong v-if="hasMultipleAdoptions">
            {{ formatFolio(activeIndex) }} / {{ formatFolio(visibleAdoptions.length - 1) }}
          </strong>
        </p>

        <div
          ref="title"
          class="home-adoption-poster__identity"
        >
          <h3>{{ currentAdoption.work.characterName }}</h3>
        </div>

        <dl ref="facts" class="home-adoption-poster__facts">
          <div>
            <dt class="home-adoption-poster__species-label">物种</dt>
            <dd class="home-adoption-poster__species">{{ currentAdoption.work.species }}</dd>
          </div>
          <div v-if="price">
            <dt>领养价格</dt>
            <dd>{{ price }}</dd>
          </div>
        </dl>

        <div ref="actions" class="home-adoption-poster__actions">
          <PublicAction :to="detailTo">
            查看领养详情
          </PublicAction>
          <PublicAction to="/adoptions" variant="text">
            浏览全部角色 →
          </PublicAction>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.home-adoptions {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.75rem;
  min-height: calc(100svh - var(--public-header-height));
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0.75rem var(--public-page-padding) 1rem;
  overflow: clip;
  isolation: isolate;
}

.home-adoptions__heading {
  position: relative;
  z-index: 4;
  width: min(100%, 32rem);
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--public-text-primary);
}

.home-adoption-poster__folio,
.home-adoption-poster__facts dt {
  color: var(--public-text-secondary);
  font-family: var(--font-role-metadata);
  font-size: 0.6875rem;
  line-height: 1.2;
}

.home-adoptions__title {
  margin-top: 0.35rem;
  font-family: var(--font-role-display);
  font-size: 2rem;
  font-weight: 600;
  line-height: 1;
}

.home-adoption-poster {
  position: relative;
  display: grid;
  align-content: center;
  min-width: 0;
  min-height: 0;
}

.home-adoption-poster__display {
  position: absolute;
  inset: 0.15rem -0.3rem auto;
  z-index: 0;
  display: grid;
  color: var(--public-background-type);
  font-family: var(--font-role-display-sans);
  font-size: clamp(4.25rem, 15vw, 13rem);
  font-weight: 700;
  line-height: 0.68;
  letter-spacing: var(--type-display-letter-spacing);
  pointer-events: none;
  user-select: none;
}

.home-adoption-poster__media {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 0;
  overflow: hidden;
  padding: clamp(0.5rem, 1.5vw, 1.5rem);
  background: var(--public-media-canvas);
  border-radius: var(--radius-image);
  color: inherit;
  place-items: center;
}

.home-adoption-poster__media:focus-visible {
  outline: 2px solid var(--public-border-focus);
  outline-offset: 4px;
}

.home-adoption-poster__media-surface {
  grid-area: 1 / 1;
  display: grid;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  place-items: center;
}

.home-adoption-media-next-enter-active,
.home-adoption-media-next-leave-active,
.home-adoption-media-prev-enter-active,
.home-adoption-media-prev-leave-active {
  transition:
    opacity 420ms var(--motion-ease-standard),
    transform var(--motion-duration-media) var(--motion-ease-standard);
}

.home-adoption-media-next-enter-from,
.home-adoption-media-prev-leave-to {
  opacity: 0;
  transform: translate3d(42px, 0, 0) scale(0.99);
}

.home-adoption-media-next-leave-to,
.home-adoption-media-prev-enter-from {
  opacity: 0;
  transform: translate3d(-42px, 0, 0) scale(0.99);
}

.home-adoption-poster__media :deep(.responsive-picture),
.home-adoption-poster__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.home-adoption-poster__media :deep(.responsive-picture__image) {
  object-fit: contain;
  transition: transform var(--motion-duration-state) var(--motion-ease-standard);
}

@media (hover: hover) and (pointer: fine) {
  .home-adoption-poster__media:hover :deep(.responsive-picture__image) {
    transform: scale(1.025) rotate(0.35deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-adoption-poster__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .home-adoption-poster__media:hover :deep(.responsive-picture__image) {
    transform: none;
  }
}

.home-adoption-poster__caption {
  position: relative;
  z-index: 2;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: var(--space-4);
  min-width: 0;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
}

.home-adoption-poster__selector {
  position: relative;
  z-index: 3;
  display: grid;
  min-width: 0;
  border-top: 1px solid var(--public-border-primary);
  border-bottom: 1px solid var(--public-border-primary);
}

.home-adoption-poster__selector-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.55rem var(--space-3);
  color: var(--public-text-secondary);
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color var(--motion-duration-state) var(--motion-ease-standard),
    border-color var(--motion-duration-state) var(--motion-ease-standard);
}

.home-adoption-poster__selector-item + .home-adoption-poster__selector-item {
  border-left: 1px solid var(--public-border-primary);
}

.home-adoption-poster__selector-item span {
  font-family: var(--font-role-metadata);
  font-size: 0.6875rem;
}

.home-adoption-poster__selector-item strong {
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-role-display);
  font-size: var(--font-size-sm);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-adoption-poster__selector-item--active {
  color: var(--public-text-primary);
  border-bottom-color: var(--public-text-primary);
}

.home-adoption-poster__selector-item:focus-visible {
  outline: 2px solid var(--public-focus-ring);
  outline-offset: -2px;
}

.home-adoption-poster__selector-item:active {
  color: var(--public-accent-active);
}

.home-adoption-poster__folio {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  width: 100%;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--public-border-primary);
}

.home-adoption-poster__folio strong {
  color: var(--public-text-primary);
  font-family: var(--font-role-display-rounded);
  font-size: clamp(1.125rem, 1.5vw, 1.5rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: var(--type-display-letter-spacing);
}

.home-adoption-poster__identity {
  display: grid;
  gap: var(--space-2);
}

.home-adoption-poster__identity h3 {
  margin: 0.4rem 0 0;
  font-family: var(--font-role-display);
  font-size: var(--type-display-page-size);
  font-weight: var(--type-display-weight);
  line-height: 0.94;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.home-adoption-poster__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  margin: 0;
  border-top: 1px solid var(--public-border-primary);
}

.home-adoption-poster__facts div {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-3) 0 0;
}

.home-adoption-poster__facts div + div {
  padding-left: var(--space-3);
  border-left: 1px solid var(--public-border-primary);
}

.home-adoption-poster__facts dd {
  margin: 0;
  font-family: var(--font-role-display);
  font-size: var(--font-size-md);
}

.home-adoption-poster__facts .home-adoption-poster__species {
  color: var(--public-text-secondary);
  font-family: var(--font-role-body);
  font-size: var(--type-body-small-size);
  font-weight: var(--type-body-weight);
}

.home-adoption-poster__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

@media (max-width: 767px) {
  .home-adoptions {
    grid-template-rows: auto auto;
    min-height: auto;
    padding-bottom: clamp(1.25rem, 5vw, 2rem);
  }

  .home-adoption-poster {
    grid-template-rows: auto auto auto;
    align-self: start;
    align-content: start;
    gap: 0.625rem;
    padding-top: clamp(0.75rem, 2svh, 1.25rem);
  }

  .home-adoption-poster__display {
    top: clamp(0.75rem, 2svh, 1.25rem);
  }

  .home-adoption-poster__media {
    height: min(32svh, 16rem);
    margin-top: clamp(3.25rem, 14vw, 4.5rem);
    padding: 0.5rem;
  }

  .home-adoption-poster--multiple .home-adoption-poster__media {
    height: min(31svh, 16.5rem);
  }

  .home-adoption-poster__selector-item {
    grid-template-columns: 1fr;
    align-content: center;
    gap: 0.1rem;
    min-height: 3rem;
    padding: 0.35rem 0.45rem;
  }

  .home-adoption-poster__selector-item strong {
    font-size: 0.75rem;
  }

  .home-adoption-poster__caption {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .home-adoption-poster__identity,
  .home-adoption-poster__facts,
  .home-adoption-poster__actions,
  .home-adoption-poster__identity {
    gap: 0.35rem;
  }

  .home-adoption-poster__identity h3 {
    max-width: 100%;
    margin-top: 0.3rem;
    line-height: 0.95;
    overflow-wrap: normal;
    white-space: nowrap;
  }

  .home-adoption-poster__facts div {
    padding-top: 0;
  }

  .home-adoption-poster__facts {
    margin-top: 0.35rem;
  }

  .home-adoption-poster__actions {
    gap: var(--space-2);
    flex-wrap: nowrap;
    margin-top: 0.65rem;
  }

  .home-adoption-poster__actions :deep(.public-action) {
    min-height: 2.75rem;
    padding-inline: var(--space-3);
    font-size: 0.8125rem;
  }
}

@media (max-width: 480px) {
  .home-adoption-poster__facts,
  .home-adoption-poster__actions {
    grid-column: 1 / -1;
  }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .home-adoption-poster__caption {
    gap: 0;
    margin-top: var(--space-5);
  }

  .home-adoption-poster__facts {
    margin-top: 0.65rem;
  }

  .home-adoption-poster__facts div {
    padding-top: 0;
  }

  .home-adoption-poster__actions {
    margin-top: var(--space-4);
  }
}

@media (max-width: 1024px) {
  .home-adoption-poster__folio {
    display: none;
  }

  .home-adoption-poster__facts {
    border-top: 0;
  }

  .home-adoption-poster__species-label {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-adoption-media-next-enter-active,
  .home-adoption-media-next-leave-active,
  .home-adoption-media-prev-enter-active,
  .home-adoption-media-prev-leave-active,
  .home-adoption-poster__selector-item {
    transition: none;
  }
}

@media (min-width: 1025px) {
  .home-adoption-poster {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: clamp(1.5rem, 2.5vw, 3rem);
  }

  .home-adoption-poster__media {
    grid-column: 4 / 12;
    grid-row: 1;
    height: min(64svh, 38rem);
    margin-top: clamp(2rem, 4vw, 4rem);
  }

  .home-adoption-poster__caption {
    grid-column: 1 / 5;
    grid-row: 1;
    padding: var(--space-4) var(--space-5) var(--space-4) 0;
  }

  .home-adoption-poster__selector {
    grid-column: 4 / 12;
    grid-row: 2;
    margin-top: var(--space-2);
  }
}
</style>

<script setup lang="ts">
import type {
  HeroOrientation,
  PublicHomeDto,
} from '~~/shared/types/contracts'
import {
  PROJECT_ENGLISH_NAME,
  PROJECT_NAME,
} from '~~/shared/constants/project'

/**
 * R3-C 独立方向轮播：
 * - SSR 只直出横竖各自第一项组成的 <picture>，无 JS 时仍可用。
 * - 水合后仅操作当前 orientation 的索引，方向变化时夹紧对应索引。
 * - 自动轮播固定开启、10 秒一张；显式暂停/页面隐藏暂停，reduced-motion 停止。
 * - Hero 占据大面积首屏，鼠标停留或操作控件不能成为隐式永久暂停条件。
 */
const props = defineProps<{
  home: PublicHomeDto
}>()

const activeOrientation = shallowRef<HeroOrientation>('landscape')
const landscapeIndex = ref(0)
const portraitIndex = ref(0)
const items = computed(() => props.home[activeOrientation.value])
const landscapeItem = computed(() => props.home.landscape[landscapeIndex.value])
const portraitItem = computed(() => props.home.portrait[portraitIndex.value])
const activeIndex = computed({
  get: () => activeOrientation.value === 'landscape'
    ? landscapeIndex.value
    : portraitIndex.value,
  set: (value: number) => {
    if (activeOrientation.value === 'landscape') {
      landscapeIndex.value = value
    }
    else {
      portraitIndex.value = value
    }
  },
})
const activeItem = computed(() => (
  items.value[activeIndex.value] ?? landscapeItem.value ?? portraitItem.value
))
const pictureSources = computed(() => (
  landscapeItem.value?.sources ?? portraitItem.value?.sources
))
const transitionDirection = shallowRef<'next' | 'prev'>('next')
const transitionIntent = shallowRef<'autoplay' | 'keyboard' | 'pointer'>('autoplay')
const transitionName = computed(() => `home-hero-slide-${transitionDirection.value}`)

watch(() => props.home.landscape.length, (count) => {
  landscapeIndex.value = clampSlideIndex(landscapeIndex.value, count)
})
watch(() => props.home.portrait.length, (count) => {
  portraitIndex.value = clampSlideIndex(portraitIndex.value, count)
})

const reduceMotion = ref(false)
const userPaused = ref(false)
const pageHidden = ref(false)
const motionReady = shallowRef(false)
const controlsRevealed = shallowRef(false)

const autoplayInterval = computed(
  () => resolveAutoplayIntervalMs(reduceMotion.value),
)

const autoplayRunning = computed(() =>
  autoplayInterval.value !== null
  && items.value.length > 1
  && !userPaused.value
  && !pageHidden.value)

let timer: ReturnType<typeof setInterval> | null = null
let controlsTimer: ReturnType<typeof setTimeout> | null = null

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

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

function restartTimer() {
  stopTimer()
  const interval = autoplayInterval.value
  if (autoplayRunning.value && interval !== null) {
    timer = setInterval(() => goNext('autoplay'), interval)
  }
}

function goTo(index: number, intent: 'autoplay' | 'keyboard' | 'pointer' = 'pointer') {
  const target = clampSlideIndex(index, items.value.length)
  if (target === activeIndex.value) {
    return
  }
  transitionIntent.value = intent
  transitionDirection.value = target > activeIndex.value ? 'next' : 'prev'
  activeIndex.value = target
}

function goNext(intent: 'autoplay' | 'keyboard' | 'pointer' = 'pointer') {
  transitionIntent.value = intent
  transitionDirection.value = 'next'
  activeIndex.value = nextSlideIndex(activeIndex.value, items.value.length)
}

function goPrev(intent: 'autoplay' | 'keyboard' | 'pointer' = 'pointer') {
  transitionIntent.value = intent
  transitionDirection.value = 'prev'
  activeIndex.value = prevSlideIndex(activeIndex.value, items.value.length)
}

function togglePause() {
  userPaused.value = !userPaused.value
  if (userPaused.value) {
    revealControls()
  }
  else {
    revealControls(2_400)
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goPrev('keyboard')
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    goNext('keyboard')
  }
}

let pointerStartX: number | null = null

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    revealControls(4_000)
  }
  // 手势起点在按钮/链接上时不介入，避免误吞控件交互
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
    goNext('pointer')
  }
  else if (direction === 'prev') {
    goPrev('pointer')
  }
}

function onPointerCancel() {
  pointerStartX = null
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse') {
    return
  }
  revealForFinePointer(event)
}

function revealForFinePointer(event: MouseEvent) {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = (event.clientX - bounds.left) / bounds.width
  const y = (event.clientY - bounds.top) / bounds.height
  if (
    !controlsRevealed.value
    && (x <= 0.16 || x >= 0.84 || y >= 0.72)
  ) {
    revealControls()
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

let motionQuery: MediaQueryList | null = null
let orientationQuery: MediaQueryList | null = null
let motionFrame: number | null = null

function onMotionChange(event: MediaQueryListEvent) {
  reduceMotion.value = event.matches
}

function onVisibilityChange() {
  pageHidden.value = document.hidden
}

function setOrientation(portrait: boolean) {
  activeOrientation.value = portrait ? 'portrait' : 'landscape'
  activeIndex.value = clampSlideIndex(activeIndex.value, items.value.length)
}

function onOrientationChange(event: MediaQueryListEvent) {
  setOrientation(event.matches)
}

watch([autoplayRunning, autoplayInterval], restartTimer)

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduceMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
  orientationQuery = window.matchMedia('(orientation: portrait)')
  setOrientation(orientationQuery.matches)
  orientationQuery.addEventListener('change', onOrientationChange)
  document.addEventListener('visibilitychange', onVisibilityChange)
  motionFrame = window.requestAnimationFrame(() => {
    motionReady.value = true
    motionFrame = null
  })
  restartTimer()
})

onBeforeUnmount(() => {
  stopTimer()
  stopControlsTimer()
  if (motionFrame !== null) {
    window.cancelAnimationFrame(motionFrame)
  }
  motionQuery?.removeEventListener('change', onMotionChange)
  orientationQuery?.removeEventListener('change', onOrientationChange)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <section
    class="home-hero"
    :class="{
      'home-hero--empty': !pictureSources,
    }"
    :data-transition-intent="transitionIntent"
    :data-controls-revealed="controlsRevealed"
    :data-paused="userPaused"
    :data-reduced-motion="reduceMotion"
    role="region"
    aria-roledescription="carousel"
    aria-label="代表作品轮播"
    data-home-scroll-scene
    data-testid="public-hero"
    @keydown="onKeydown"
    @click="onHeroClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @mousemove="revealForFinePointer"
    @pointerleave="onPointerLeave"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <template v-if="pictureSources && activeItem">
      <div class="home-hero__viewport">
        <Transition :name="transitionName" :css="motionReady">
          <div
            :key="`${activeOrientation}-${activeIndex}`"
            class="home-hero__slide"
            role="group"
            aria-roledescription="slide"
            :aria-label="`第 ${activeIndex + 1} 张，共 ${items.length} 张`"
          >
            <ResponsivePicture
              class="home-hero__media"
              :sources="pictureSources"
              :portrait-sources="portraitItem?.sources"
              :alt="activeItem.alt"
              sizes="100vw"
              :loading="activeIndex === 0 ? 'eager' : 'lazy'"
              :fetchpriority="activeIndex === 0 ? 'high' : 'auto'"
            />
          </div>
        </Transition>
      </div>
      <div class="home-hero__scrim" aria-hidden="true" />
    </template>

    <div class="home-hero__content">
      <p class="home-hero__eyebrow">
        {{ PROJECT_ENGLISH_NAME }}
      </p>
      <h1 class="home-hero__title">
        {{ PROJECT_NAME }}
      </h1>
      <p class="home-hero__tagline">
        {{ home.tagline }}
      </p>
    </div>

    <div v-if="items.length > 1" class="home-hero__controls">
      <button
        type="button"
        class="home-hero__arrow"
        aria-label="上一张"
        @click="goPrev('pointer')"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M11.5 3.5L6 9l5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="home-hero__dots" role="group" aria-label="轮播分页">
        <button
          v-for="(item, index) in items"
          :key="index"
          type="button"
          class="home-hero__dot"
          :class="{ 'home-hero__dot--active': index === activeIndex }"
          :aria-label="`第 ${index + 1} 张，共 ${items.length} 张`"
          :aria-current="index === activeIndex ? 'true' : undefined"
          @click="goTo(index, 'pointer')"
        />
      </div>
      <button
        type="button"
        class="home-hero__arrow"
        aria-label="下一张"
        @click="goNext('pointer')"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M6.5 3.5L12 9l-5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <!-- 自动轮播固定开启，因此暂停按钮常在（无障碍要求可暂停动效）。 -->
      <button
        v-if="items.length > 1"
        type="button"
        class="home-hero__pause"
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

    <p v-if="items.length > 0" class="home-hero__live" role="status" aria-live="polite">
      第 {{ activeIndex + 1 }} 张，共 {{ items.length }} 张
    </p>
  </section>
</template>

<style scoped>
/* 首屏始终占满动态视口，避免移动地址栏变化时露出白底。 */
.home-hero {
  position: relative;
  display: grid;
  min-height: 100svh;
  height: 100svh;
  color: var(--public-text-inverse);
  overflow: hidden;
}

@supports (height: 100dvh) {
  .home-hero {
    min-height: 100dvh;
    height: 100dvh;
  }
}

.home-hero--empty {
  background: var(--public-bg-inverse);
}

.home-hero__viewport {
  position: absolute;
  inset: 0;
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  background: var(--image-placeholder);
  touch-action: pan-y;
}

.home-hero__slide,
.home-hero__slide :deep(.responsive-picture),
.home-hero__slide :deep(.responsive-picture__image) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.home-hero__slide :deep(.responsive-picture__image) {
  object-fit: cover;
}

/* 自动轮播使用完整媒体时序；下一张仍在用户/计时器触发后才挂载和下载。 */
.home-hero-slide-next-enter-active,
.home-hero-slide-next-leave-active,
.home-hero-slide-prev-enter-active,
.home-hero-slide-prev-leave-active {
  transition:
    opacity var(--motion-duration-media) var(--motion-ease-standard),
    transform var(--motion-duration-media) var(--motion-ease-standard);
  will-change: opacity, transform;
}

.home-hero[data-transition-intent='pointer'] .home-hero-slide-next-enter-active,
.home-hero[data-transition-intent='pointer'] .home-hero-slide-next-leave-active,
.home-hero[data-transition-intent='pointer'] .home-hero-slide-prev-enter-active,
.home-hero[data-transition-intent='pointer'] .home-hero-slide-prev-leave-active {
  transition-duration: var(--motion-duration-content);
}

.home-hero[data-transition-intent='keyboard'] .home-hero-slide-next-enter-active,
.home-hero[data-transition-intent='keyboard'] .home-hero-slide-next-leave-active,
.home-hero[data-transition-intent='keyboard'] .home-hero-slide-prev-enter-active,
.home-hero[data-transition-intent='keyboard'] .home-hero-slide-prev-leave-active {
  transition: opacity var(--motion-duration-state) var(--motion-ease-standard);
}

.home-hero[data-transition-intent='keyboard'] .home-hero-slide-next-enter-from,
.home-hero[data-transition-intent='keyboard'] .home-hero-slide-next-leave-to,
.home-hero[data-transition-intent='keyboard'] .home-hero-slide-prev-enter-from,
.home-hero[data-transition-intent='keyboard'] .home-hero-slide-prev-leave-to {
  transform: none;
}

.home-hero-slide-next-enter-from,
.home-hero-slide-prev-leave-to {
  opacity: 0;
  transform: translate3d(3%, 0, 0) scale(1.01);
}

.home-hero-slide-next-leave-to,
.home-hero-slide-prev-enter-from {
  opacity: 0;
  transform: translate3d(-3%, 0, 0) scale(1.01);
}

.home-hero__slide :deep(.responsive-picture__image) {
  animation: home-hero-media-in var(--motion-duration-media) var(--motion-ease-standard) both;
}

.home-hero__scrim {
  position: absolute;
  inset: 0;
  /* 确定性对比度保护：顶部导航区与左下文字安全区各自一条受控渐变。
     首页 Hero 是站点展示位，优先使用无水印 site-display-v2 完整变体，不叠加 Logo。 */
  background:
    linear-gradient(
      to bottom,
      rgb(17 20 25 / 0.64) 0%,
      rgb(17 20 25 / 0.62) 6%,
      rgb(17 20 25 / 0.3) 12%,
      rgb(17 20 25 / 0) 19%
    ),
    linear-gradient(
      to bottom,
      rgb(17 20 25 / 0) 40%,
      rgb(17 20 25 / 0.62) 52%,
      rgb(17 20 25 / 0.68) 100%
    );
}

.home-hero__content {
  position: relative;
  grid-area: 1 / 1;
  align-self: end;
  width: 100%;
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding:
    var(--space-8)
    var(--public-page-padding)
    max(calc(env(safe-area-inset-bottom) + var(--space-8)), 8rem);
}

.home-hero__eyebrow {
  font-family: var(--font-brand-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.home-hero__title {
  margin-top: var(--space-3);
  font-family: var(--font-brand-display);
  font-size: var(--font-size-hero);
  font-weight: 600;
  line-height: var(--line-height-tight);
  /* 拼贴字体的字面已经填满字身框，不再叠 -0.025em 负字距收紧。 */
  letter-spacing: var(--letter-spacing-normal);
}

.home-hero__tagline {
  max-width: 32rem;
  margin-top: var(--space-4);
  font-family: var(--font-brand-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-normal);
}

.home-hero__controls {
  position: absolute;
  right: var(--public-page-padding);
  bottom: max(var(--space-5), calc(env(safe-area-inset-bottom) + var(--space-3)));
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.home-hero__eyebrow,
.home-hero__tagline {
  animation: home-hero-brand-in var(--motion-duration-content) var(--motion-ease-standard) both;
}

.home-hero__eyebrow {
  animation-delay: 0ms;
}

.home-hero__tagline {
  animation-delay: 90ms;
}

.home-hero__controls {
  animation: home-hero-controls-in var(--motion-duration-state) var(--motion-ease-playful) 270ms both;
}

@keyframes home-hero-media-in {
  from {
    transform: scale(0.99);
  }

  to {
    transform: scale(1);
  }
}

@keyframes home-hero-brand-in {
  from {
    opacity: 0;
    clip-path: inset(0 0 100% 0);
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    clip-path: inset(0 0 0 0);
    transform: translateY(0);
  }
}

@keyframes home-hero-controls-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.home-hero__arrow,
.home-hero__pause {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  color: var(--public-text-inverse);
  background: rgb(17 20 25 / 0.45);
  border: 1px solid rgb(255 255 255 / 0.35);
  border-radius: var(--radius-full);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px) scale(0.96);
  transition:
    opacity var(--motion-duration-state) var(--motion-ease-standard),
    transform var(--motion-duration-state) var(--motion-ease-playful),
    background-color var(--motion-duration-feedback) var(--motion-ease-standard);
  place-items: center;
}

.home-hero[data-controls-revealed='true'] .home-hero__arrow,
.home-hero[data-controls-revealed='true'] .home-hero__pause,
.home-hero[data-paused='true'] .home-hero__arrow,
.home-hero[data-paused='true'] .home-hero__pause,
.home-hero:focus-within .home-hero__arrow,
.home-hero:focus-within .home-hero__pause {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

.home-hero__arrow:active,
.home-hero__pause:active {
  transform: scale(0.96);
}

.home-hero__dots {
  display: flex;
  gap: var(--space-2);
}

.home-hero__dot {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  place-items: center;
}

.home-hero__dot::before {
  width: 0.625rem;
  height: 0.625rem;
  content: '';
  background: rgb(255 255 255 / 0.45);
  border-radius: var(--radius-full);
  transition:
    background-color var(--motion-duration-state) var(--motion-ease-standard),
    transform var(--motion-duration-state) var(--motion-ease-playful);
}

.home-hero__dot--active::before {
  background: var(--public-text-inverse);
  transform: scale(1.18);
}

@media (hover: hover) and (pointer: fine) {
  .home-hero__arrow:hover,
  .home-hero__pause:hover {
    background: rgb(17 20 25 / 0.65);
  }
}

.home-hero__live {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 767px) {
  .home-hero__controls {
    right: var(--public-page-padding);
    bottom: var(--space-4);
  }

  .home-hero__arrow,
  .home-hero__pause {
    width: 2.5rem;
    height: 2.5rem;
  }
}

@media (min-width: 1024px) {
  .home-hero__content {
    align-items: end;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    /* 第二行与标题同宽：eyebrow 与 tagline 共用标题所在的 auto 列，
       分别贴该列左右边缘，而不是各自贴页宽两端。 */
    grid-template-areas:
      ". title ."
      ". meta .";
    gap: var(--space-5) var(--space-6);
    padding-bottom: max(calc(env(safe-area-inset-bottom) + var(--space-5)), 5rem);
  }

  .home-hero__eyebrow {
    grid-area: meta;
    justify-self: start;
  }

  .home-hero__title {
    grid-area: title;
    justify-self: center;
    margin-top: 0;
    text-align: center;
  }

  .home-hero__tagline {
    grid-area: meta;
    justify-self: end;
    margin-top: 0;
    text-align: right;
    white-space: nowrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-hero-slide-next-enter-active,
  .home-hero-slide-next-leave-active,
  .home-hero-slide-prev-enter-active,
  .home-hero-slide-prev-leave-active {
    transition: opacity var(--motion-duration-state) var(--motion-ease-standard);
  }

  .home-hero-slide-next-enter-from,
  .home-hero-slide-next-leave-to,
  .home-hero-slide-prev-enter-from,
  .home-hero-slide-prev-leave-to {
    transform: none;
  }

  .home-hero__eyebrow,
  .home-hero__title,
  .home-hero__tagline,
  .home-hero__controls,
  .home-hero__slide :deep(.responsive-picture__image) {
    animation: none;
  }

  .home-hero__arrow,
  .home-hero__pause,
  .home-hero__dot::before {
    transition: opacity var(--motion-duration-state) var(--motion-ease-standard);
  }

  .home-hero__arrow,
  .home-hero__pause,
  .home-hero__dot--active::before {
    transform: none;
  }

  .home-hero[data-reduced-motion='true'] .home-hero__pause {
    display: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .home-hero__arrow,
  .home-hero__pause {
    background: #111419;
    border-color: #ffffff;
  }
}

@media (prefers-contrast: more) {
  .home-hero__arrow,
  .home-hero__pause {
    background: rgb(17 20 25 / 0.9);
    border-color: #ffffff;
  }

  .home-hero__dot::before {
    background: rgb(255 255 255 / 0.72);
    box-shadow: 0 0 0 1px #111419;
  }

  .home-hero__dot--active::before {
    background: #ffffff;
  }
}
</style>

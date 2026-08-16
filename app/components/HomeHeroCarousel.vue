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

const autoplayInterval = computed(
  () => resolveAutoplayIntervalMs(reduceMotion.value),
)

const autoplayRunning = computed(() =>
  autoplayInterval.value !== null
  && items.value.length > 1
  && !userPaused.value
  && !pageHidden.value)

let timer: ReturnType<typeof setInterval> | null = null

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

function restartTimer() {
  stopTimer()
  const interval = autoplayInterval.value
  if (autoplayRunning.value && interval !== null) {
    timer = setInterval(goNext, interval)
  }
}

function goTo(index: number) {
  const target = clampSlideIndex(index, items.value.length)
  if (target === activeIndex.value) {
    return
  }
  transitionDirection.value = target > activeIndex.value ? 'next' : 'prev'
  activeIndex.value = target
}

function goNext() {
  transitionDirection.value = 'next'
  activeIndex.value = nextSlideIndex(activeIndex.value, items.value.length)
}

function goPrev() {
  transitionDirection.value = 'prev'
  activeIndex.value = prevSlideIndex(activeIndex.value, items.value.length)
}

function togglePause() {
  userPaused.value = !userPaused.value
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goPrev()
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    goNext()
  }
}

let pointerStartX: number | null = null

function onPointerDown(event: PointerEvent) {
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
    goNext()
  }
  else if (direction === 'prev') {
    goPrev()
  }
}

function onPointerCancel() {
  pointerStartX = null
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
      'home-hero--motion-ready': motionReady,
    }"
    role="region"
    aria-roledescription="carousel"
    aria-label="代表作品轮播"
    data-testid="public-hero"
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
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
        @click="goPrev"
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
          @click="goTo(index)"
        />
      </div>
      <button
        type="button"
        class="home-hero__arrow"
        aria-label="下一张"
        @click="goNext"
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

/* 离场项只在切换的 680ms 内保留；下一张仍在用户/计时器触发后才挂载和下载。 */
.home-hero-slide-next-enter-active,
.home-hero-slide-next-leave-active,
.home-hero-slide-prev-enter-active,
.home-hero-slide-prev-leave-active {
  transition:
    opacity 680ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 680ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
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
  font-size: var(--font-size-sm);
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.home-hero__title {
  margin-top: var(--space-3);
  font-family: var(--font-public-display);
  font-size: var(--font-size-hero);
  font-weight: 600;
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-tight);
}

.home-hero__tagline {
  max-width: 32rem;
  margin-top: var(--space-4);
  font-size: var(--font-size-md);
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

.home-hero--motion-ready .home-hero__eyebrow,
.home-hero--motion-ready .home-hero__title,
.home-hero--motion-ready .home-hero__tagline,
.home-hero--motion-ready .home-hero__controls {
  animation: home-hero-content-in 680ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.home-hero--motion-ready .home-hero__eyebrow {
  animation-delay: 100ms;
}

.home-hero--motion-ready .home-hero__title {
  animation-delay: 180ms;
}

.home-hero--motion-ready .home-hero__tagline {
  animation-delay: 270ms;
}

.home-hero--motion-ready .home-hero__controls {
  animation-delay: 360ms;
}

@keyframes home-hero-content-in {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
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
  place-items: center;
}

.home-hero__arrow:hover,
.home-hero__pause:hover {
  background: rgb(17 20 25 / 0.65);
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
}

.home-hero__dot--active::before {
  background: var(--public-text-inverse);
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
    grid-template-areas:
      ". title ."
      "eyebrow . tagline";
    gap: var(--space-5) var(--space-6);
    padding-bottom: max(calc(env(safe-area-inset-bottom) + var(--space-8)), 8rem);
  }

  .home-hero__eyebrow {
    grid-area: eyebrow;
    justify-self: start;
  }

  .home-hero__title {
    grid-area: title;
    justify-self: center;
    margin-top: 0;
    text-align: center;
  }

  .home-hero__tagline {
    grid-area: tagline;
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
    transition: none;
  }

  .home-hero--motion-ready .home-hero__eyebrow,
  .home-hero--motion-ready .home-hero__title,
  .home-hero--motion-ready .home-hero__tagline,
  .home-hero--motion-ready .home-hero__controls {
    animation: none;
  }
}
</style>

<script setup lang="ts">
import type { PublicHomeDto } from '~~/shared/types/contracts'
import {
  PROJECT_ENGLISH_NAME,
  PROJECT_NAME,
} from '~~/shared/constants/project'

/**
 * 首页双源轮播（T20）：
 * - 仅渲染当前项 <picture>：SSR 直出第一项，隐藏项不下载图片；无 JS 时第一项完整可用。
 * - 横屏 16:9 / 竖屏 9:16 独立 asset，由 ResponsivePicture 按 orientation 切换。
 * - 自动轮播固定开启、10 秒一张；悬停/聚焦/页面隐藏暂停，reduced-motion 停止。
 */
const props = defineProps<{
  home: PublicHomeDto
}>()

const slides = computed(() => props.home.slides)
const activeIndex = ref(0)
const activeSlide = computed(() => slides.value[activeIndex.value])

watch(() => slides.value.length, (count) => {
  activeIndex.value = clampSlideIndex(activeIndex.value, count)
})

const reduceMotion = ref(false)
const hovered = ref(false)
const focusWithin = ref(false)
const userPaused = ref(false)
const pageHidden = ref(false)

const autoplayInterval = computed(
  () => resolveAutoplayIntervalMs(reduceMotion.value),
)

const autoplayRunning = computed(() =>
  autoplayInterval.value !== null
  && slides.value.length > 1
  && !userPaused.value
  && !hovered.value
  && !focusWithin.value
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
  activeIndex.value = clampSlideIndex(index, slides.value.length)
}

function goNext() {
  activeIndex.value = nextSlideIndex(activeIndex.value, slides.value.length)
}

function goPrev() {
  activeIndex.value = prevSlideIndex(activeIndex.value, slides.value.length)
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

function onMotionChange(event: MediaQueryListEvent) {
  reduceMotion.value = event.matches
}

function onVisibilityChange() {
  pageHidden.value = document.hidden
}

watch([autoplayRunning, autoplayInterval], restartTimer)

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduceMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
  document.addEventListener('visibilitychange', onVisibilityChange)
  restartTimer()
})

onBeforeUnmount(() => {
  stopTimer()
  motionQuery?.removeEventListener('change', onMotionChange)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <section
    class="home-hero"
    :class="{ 'home-hero--empty': slides.length === 0 }"
    role="region"
    aria-roledescription="carousel"
    aria-label="代表作品轮播"
    data-testid="public-hero"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focusWithin = true"
    @focusout="focusWithin = false"
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <template v-if="activeSlide">
      <div class="home-hero__viewport">
        <div
          :key="activeIndex"
          class="home-hero__slide"
          role="group"
          aria-roledescription="slide"
          :aria-label="`第 ${activeIndex + 1} 张，共 ${slides.length} 张`"
        >
          <ResponsivePicture
            class="home-hero__media"
            :sources="activeSlide.landscape"
            :portrait-sources="activeSlide.portrait"
            :alt="activeSlide.alt"
            sizes="100vw"
            :loading="activeIndex === 0 ? 'eager' : 'lazy'"
            :fetchpriority="activeIndex === 0 ? 'high' : 'auto'"
          />
        </div>
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
      <NuxtLink
        v-if="activeSlide?.linkedWorkHref"
        :to="activeSlide.linkedWorkHref"
        class="home-hero__action"
      >
        查看这套作品
      </NuxtLink>
      <NuxtLink
        v-else
        to="/works"
        class="home-hero__action"
      >
        浏览作品展示
      </NuxtLink>
    </div>

    <div v-if="slides.length > 1" class="home-hero__controls">
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
          v-for="(slide, index) in slides"
          :key="index"
          type="button"
          class="home-hero__dot"
          :class="{ 'home-hero__dot--active': index === activeIndex }"
          :aria-label="`第 ${index + 1} 张，共 ${slides.length} 张`"
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
        v-if="slides.length > 1"
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

    <p v-if="slides.length > 0" class="home-hero__live" role="status" aria-live="polite">
      第 {{ activeIndex + 1 }} 张，共 {{ slides.length }} 张
    </p>
  </section>
</template>

<style scoped>
/* grid 堆叠：固定比例媒体盒与文字内容同占一格，区高取两者较大者。
   正常情况下 16:9/9:16 比例盒决定高度（低 CLS）；文字超出时区高兜底。 */
.home-hero {
  position: relative;
  display: grid;
  min-height: 16rem;
  color: var(--public-text-inverse);
  overflow: hidden;
}

.home-hero--empty {
  background: var(--public-bg-inverse);
}

.home-hero__viewport {
  position: relative;
  grid-area: 1 / 1;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 100svh;
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

.home-hero__scrim {
  position: absolute;
  inset: 0;
  /* 确定性对比度保护：顶部导航区与左下文字安全区各自一条受控渐变。
     首页 Hero 是站点展示位，使用无水印 site-display-v1 变体，不叠加 Logo。 */
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
  padding: var(--space-8) var(--public-page-padding) var(--space-9);
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

.home-hero__action {
  display: inline-flex;
  align-items: center;
  min-height: 3rem;
  margin-top: var(--space-6);
  padding: var(--space-3) var(--space-6);
  color: var(--public-text-inverse);
  font-size: var(--font-size-base);
  background: var(--public-accent-primary);
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast) var(--easing-standard);
}

.home-hero__action:hover {
  color: var(--public-text-inverse);
  background: var(--public-accent-hover);
}

.home-hero__controls {
  position: absolute;
  right: var(--public-page-padding);
  bottom: var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-3);
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

/* 竖屏：9:16 竖版素材，限高避免平板竖屏过高；比例与限高均为视口单位，无 CLS。 */
@media (orientation: portrait) {
  .home-hero__viewport {
    aspect-ratio: 9 / 16;
    max-height: 88svh;
  }
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

@media (prefers-reduced-motion: reduce) {
  .home-hero__action {
    transition: none;
  }
}
</style>

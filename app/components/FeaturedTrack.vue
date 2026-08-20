<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'

defineProps<{
  works: PublicWorkSummaryDto[]
}>()

const TRACK_SIZES = '(min-width: 1024px) 24rem, (min-width: 768px) 40vw, 68vw'

const trackRef = ref<HTMLElement | null>(null)
const canPrev = ref(false)
const canNext = ref(true)

// prefers-reduced-motion: reduce 时按钮与键盘路径改用即时滚动；其余保持 smooth。
// JS scrollBy 的 behavior 参数会覆盖 CSS scroll-behavior，必须在调用侧处理。
const reduceMotion = ref(false)
let motionQuery: MediaQueryList | null = null

function onMotionChange(event: MediaQueryListEvent) {
  reduceMotion.value = event.matches
}

function scrollBehavior(): ScrollBehavior {
  return reduceMotion.value ? 'auto' : 'smooth'
}

function updateEdges() {
  const track = trackRef.value
  if (!track) {
    return
  }
  const maxScroll = track.scrollWidth - track.clientWidth
  canPrev.value = track.scrollLeft > 4
  canNext.value = track.scrollLeft < maxScroll - 4
}

function step() {
  const track = trackRef.value
  return track ? track.clientWidth * 0.72 : 320
}

function scrollPrev() {
  trackRef.value?.scrollBy({ left: -step(), behavior: scrollBehavior() })
}

function scrollNext() {
  trackRef.value?.scrollBy({ left: step(), behavior: scrollBehavior() })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    scrollPrev()
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    scrollNext()
  }
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduceMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
  updateEdges()
  window.addEventListener('resize', updateEdges)
})

onBeforeUnmount(() => {
  motionQuery?.removeEventListener('change', onMotionChange)
  window.removeEventListener('resize', updateEdges)
})
</script>

<template>
  <div class="featured-track" data-testid="featured-track">
    <div class="featured-track__controls">
      <button
        type="button"
        class="featured-track__button"
        aria-label="上一批作品"
        :disabled="!canPrev"
        @click="scrollPrev"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M11.5 3.5L6 9l5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        class="featured-track__button"
        aria-label="下一批作品"
        :disabled="!canNext"
        @click="scrollNext"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M6.5 3.5L12 9l-5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <div
      ref="trackRef"
      class="featured-track__rail"
      role="group"
      aria-label="精选作品横向轨道"
      tabindex="0"
      @scroll.passive="updateEdges"
      @keydown="onKeydown"
    >
      <WorkCard
        v-for="work in works"
        :key="work.work.id"
        :work="work"
        :sizes="TRACK_SIZES"
        class="featured-track__item"
      />
    </div>
  </div>
</template>

<style scoped>
.featured-track {
  min-width: 0;
  max-width: 100%;
}

.featured-track__controls {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-bottom: var(--space-4);
}

.featured-track__button {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-full);
  cursor: pointer;
  place-items: center;
  transition: border-color var(--duration-fast) var(--easing-standard);
}

.featured-track__button:hover:not(:disabled) {
  border-color: var(--public-text-primary);
}

.featured-track__button:disabled {
  color: var(--public-text-tertiary);
  cursor: default;
  opacity: 0.6;
}

.featured-track__rail {
  display: flex;
  min-width: 0;
  max-width: 100%;
  gap: var(--space-4);
  padding-bottom: var(--space-2);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-left: var(--space-1);
  scrollbar-width: none;
}

.featured-track__rail::-webkit-scrollbar {
  display: none;
}

/*
 * 等高：轨道内所有卡片高度固定为 --featured-row-height，宽度按各自
 * --card-ratio 伸展，因此横版领养封面卡更宽、竖版出厂照卡更窄但高度一致。
 * 横向轨道不需要铺满行宽，只需高度统一。
 */
.featured-track__item {
  flex: 0 0 calc(var(--card-ratio) * var(--featured-row-height));
  max-width: 100%;
  scroll-snap-align: start;
}

@media (max-width: 767px) {
  .featured-track__rail {
    --featured-row-height: 15rem;
  }
}

@media (min-width: 1024px) {
  .featured-track__rail {
    --featured-row-height: 22rem;
  }
}
</style>

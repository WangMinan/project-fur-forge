<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  activeIndex: number
  count: number
  previewSingle?: boolean
}>(), { previewSingle: false })

const emit = defineEmits<{
  previous: []
  next: []
}>()

const canNavigate = computed(() => props.count > 1 || props.previewSingle)

function navigate(direction: 'previous' | 'next') {
  if (!canNavigate.value) return
  if (direction === 'next') emit('next')
  else emit('previous')
}

function onKeydown(event: KeyboardEvent) {
  if (!canNavigate.value) return
  const target = event.target as HTMLElement | null
  if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    emit('previous')
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    emit('next')
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="v00-featured-controls" aria-label="代表作品切换">
    <button
      type="button"
      :aria-label="props.count > 1 ? '上一项代表作品' : '预览上一项方向动效'"
      data-v00-action="featured-previous"
      :disabled="!canNavigate"
      @click="navigate('previous')"
    >
      <span class="v00-featured-controls__arrow" aria-hidden="true">←</span>
      <span class="v00-featured-controls__label">上一项</span>
    </button>
    <span class="v00-featured-controls__status" aria-live="polite">
      {{ String(props.activeIndex + 1).padStart(2, '0') }} / {{ String(props.count).padStart(2, '0') }}
    </span>
    <button
      type="button"
      :aria-label="props.count > 1 ? '下一项代表作品' : '预览下一项方向动效'"
      data-v00-action="featured-next"
      :disabled="!canNavigate"
      @click="navigate('next')"
    >
      <span class="v00-featured-controls__label">下一项</span>
      <span class="v00-featured-controls__arrow" aria-hidden="true">→</span>
    </button>
  </div>
</template>

<style scoped>
.v00-featured-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  font-family: var(--font-public-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
}

.v00-featured-controls button {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  min-width: 6rem;
  min-height: 2.75rem;
  justify-content: center;
  padding: 0 0.7rem;
  color: inherit;
  background: transparent;
  border: 1px solid currentcolor;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.v00-featured-controls button:hover,
.v00-featured-controls button:focus-visible {
  color: #111317;
  background: rgb(17 19 23 / 0.06);
}

.v00-featured-controls button:disabled {
  cursor: default;
  opacity: 0.42;
}

.v00-featured-controls__status {
  min-width: 3.3rem;
  color: #6c6c68;
  text-align: center;
}

@media (max-width: 767px) {
  .v00-featured-controls button {
    min-width: 5.6rem;
  }
}
</style>

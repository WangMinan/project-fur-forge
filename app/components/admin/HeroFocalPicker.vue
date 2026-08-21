<script setup lang="ts">
import type { HeroOrientation } from '~~/shared/types/contracts'

const props = defineProps<{
  alt: string
  disabled: boolean
  focalX: number
  focalY: number
  orientation: HeroOrientation
  previewUrl: string | null
}>()

const emit = defineEmits<{
  update: [value: { focalX: number, focalY: number }]
}>()

const dragging = shallowRef(false)
const focalPercent = computed(() => ({
  x: Math.round(props.focalX * 1000) / 10,
  y: Math.round(props.focalY * 1000) / 10,
}))

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

function updateFromPointer(event: PointerEvent) {
  if (props.disabled) {
    return
  }
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  emit('update', {
    focalX: clamp((event.clientX - bounds.left) / bounds.width),
    focalY: clamp((event.clientY - bounds.top) / bounds.height),
  })
}

function onPointerDown(event: PointerEvent) {
  if (props.disabled) {
    return
  }
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  updateFromPointer(event)
}

function onPointerMove(event: PointerEvent) {
  if (dragging.value) {
    updateFromPointer(event)
  }
}

function onPointerEnd(event: PointerEvent) {
  dragging.value = false
  const element = event.currentTarget as HTMLElement
  if (element.hasPointerCapture(event.pointerId)) {
    element.releasePointerCapture(event.pointerId)
  }
}

function onRangeInput(axis: 'x' | 'y', event: Event) {
  const value = Number((event.target as HTMLInputElement).value) / 100
  emit('update', axis === 'x'
    ? { focalX: value, focalY: props.focalY }
    : { focalX: props.focalX, focalY: value })
}
</script>

<template>
  <section class="hero-focal-picker" data-testid="hero-focal-picker">
    <div class="hero-focal-picker__preview" :data-orientation="orientation">
      <img
        v-if="previewUrl"
        :src="previewUrl"
        :alt="`${alt || '大图'}目标裁切预览`"
        :style="{ objectPosition: `${focalPercent.x}% ${focalPercent.y}%` }"
      >
      <p v-else>上传图片后将在这里预览目标裁切。</p>
      <span
        v-if="previewUrl"
        class="hero-focal-picker__marker"
        :style="{
          insetInlineStart: `${focalPercent.x}%`,
          insetBlockStart: `${focalPercent.y}%`,
        }"
        aria-hidden="true"
      />
      <button
        v-if="previewUrl"
        type="button"
        class="hero-focal-picker__drag-surface"
        :disabled="disabled"
        aria-label="拖动设置大图焦点"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerEnd"
        @pointercancel="onPointerEnd"
      />
      <span class="hero-focal-picker__frame-label">
        {{ orientation === 'landscape' ? '桌面 16:9 目标裁切' : '手机 9:16 目标裁切' }}
      </span>
    </div>

    <div class="hero-focal-picker__controls">
      <div>
        <h4>图片焦点</h4>
        <p>拖动画面中的焦点，或使用水平、垂直控制条微调主体位置。</p>
      </div>

      <label>
        <span>水平焦点 {{ focalPercent.x }}%</span>
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          :value="focalPercent.x"
          :disabled="disabled"
          @input="onRangeInput('x', $event)"
        >
      </label>
      <label>
        <span>垂直焦点 {{ focalPercent.y }}%</span>
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          :value="focalPercent.y"
          :disabled="disabled"
          @input="onRangeInput('y', $event)"
        >
      </label>

      <p class="hero-focal-picker__hint">
        只影响启用后生成的目标画框；横版与竖版素材仍分别维护。
      </p>
    </div>
  </section>
</template>

<style scoped>
.hero-focal-picker {
  display: grid;
  gap: var(--admin-space-3);
}

.hero-focal-picker__preview {
  position: relative;
  display: grid;
  width: min(100%, 52rem);
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--admin-bg-subtle);
  border: 0.5rem solid var(--admin-text-primary);
  border-radius: var(--admin-radius-sm);
  place-items: center;
}

.hero-focal-picker__preview[data-orientation='portrait'] {
  width: min(100%, 20rem);
  aspect-ratio: 9 / 16;
  border-width: 0.65rem;
  border-radius: 1.5rem;
}

.hero-focal-picker__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-focal-picker__preview p,
.hero-focal-picker__controls p,
.hero-focal-picker__controls h4 {
  margin: 0;
}

.hero-focal-picker__preview p {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.hero-focal-picker__marker {
  position: absolute;
  z-index: 2;
  width: 1rem;
  height: 1rem;
  margin: -0.5rem 0 0 -0.5rem;
  background: rgb(255 255 255 / 0.78);
  border: 2px solid var(--admin-accent-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgb(25 31 42 / 0.35);
  pointer-events: none;
}

.hero-focal-picker__drag-surface {
  position: absolute;
  z-index: 1;
  inset: 0;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: crosshair;
  touch-action: none;
}

.hero-focal-picker__drag-surface:disabled {
  cursor: not-allowed;
}

.hero-focal-picker__frame-label {
  position: absolute;
  z-index: 3;
  right: var(--admin-space-2);
  bottom: var(--admin-space-2);
  padding: var(--admin-space-1) var(--admin-space-2);
  color: var(--admin-text-inverse);
  background: rgb(25 31 42 / 0.72);
  border-radius: var(--admin-radius-sm);
  font-size: var(--admin-font-xs);
  pointer-events: none;
}

.hero-focal-picker__controls {
  display: grid;
  align-content: start;
  gap: var(--admin-space-4);
  max-width: 24rem;
}

.hero-focal-picker__controls > div:first-child {
  display: grid;
  gap: var(--admin-space-1);
}

.hero-focal-picker__controls h4,
.hero-focal-picker__controls label span {
  font-size: var(--admin-font-sm);
  font-weight: 700;
}

.hero-focal-picker__controls p {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.hero-focal-picker__controls label {
  display: grid;
  gap: var(--admin-space-2);
}

.hero-focal-picker__controls input[type='range'] {
  width: 100%;
  accent-color: var(--admin-accent-primary);
}

@media (min-width: 960px) {
  .hero-focal-picker {
    grid-template-columns: minmax(0, 52rem) minmax(18rem, 24rem);
    align-items: start;
  }
}
</style>

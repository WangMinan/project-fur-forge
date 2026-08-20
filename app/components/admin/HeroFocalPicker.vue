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

const PRESETS = [
  { key: 'top-left', label: '左上', x: 0, y: 0 },
  { key: 'top', label: '上', x: 0.5, y: 0 },
  { key: 'top-right', label: '右上', x: 1, y: 0 },
  { key: 'left', label: '左', x: 0, y: 0.5 },
  { key: 'center', label: '中心', x: 0.5, y: 0.5 },
  { key: 'right', label: '右', x: 1, y: 0.5 },
  { key: 'bottom-left', label: '左下', x: 0, y: 1 },
  { key: 'bottom', label: '下', x: 0.5, y: 1 },
  { key: 'bottom-right', label: '右下', x: 1, y: 1 },
] as const

const closest = computed(() => PRESETS.toSorted((left, right) => (
  ((left.x - props.focalX) ** 2 + (left.y - props.focalY) ** 2)
  - ((right.x - props.focalX) ** 2 + (right.y - props.focalY) ** 2)
))[0]!)
const exactPreset = computed(() => PRESETS.find(preset => (
  preset.x === props.focalX && preset.y === props.focalY
)) ?? null)
const focalPercent = computed(() => ({
  x: Math.round(props.focalX * 100),
  y: Math.round(props.focalY * 100),
}))

function select(x: number, y: number) {
  if (!props.disabled) {
    emit('update', { focalX: x, focalY: y })
  }
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
      <span class="hero-focal-picker__frame-label">
        {{ orientation === 'landscape' ? '桌面 16:9 目标裁切' : '手机 9:16 目标裁切' }}
      </span>
    </div>

    <div class="hero-focal-picker__controls">
      <div>
        <h4>九宫格焦点</h4>
        <p>
          当前 {{ focalPercent.x }}% / {{ focalPercent.y }}% ·
          {{ exactPreset ? `已选${exactPreset.label}` : `最近${closest.label}，原坐标保持精度` }}
        </p>
      </div>
      <div class="hero-focal-picker__grid" role="group" aria-label="选择图片焦点">
        <button
          v-for="preset in PRESETS"
          :key="preset.key"
          type="button"
          :disabled="disabled"
          :aria-pressed="exactPreset?.key === preset.key"
          :data-nearest="!exactPreset && closest.key === preset.key"
          @click="select(preset.x, preset.y)"
        >
          {{ preset.label }}
        </button>
      </div>
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
  width: 1rem;
  height: 1rem;
  margin: -0.5rem 0 0 -0.5rem;
  background: rgb(255 255 255 / 0.78);
  border: 2px solid var(--admin-accent-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgb(25 31 42 / 0.35);
  pointer-events: none;
}

.hero-focal-picker__frame-label {
  position: absolute;
  right: var(--admin-space-2);
  bottom: var(--admin-space-2);
  padding: var(--admin-space-1) var(--admin-space-2);
  color: var(--admin-text-inverse);
  background: rgb(25 31 42 / 0.72);
  border-radius: var(--admin-radius-sm);
  font-size: var(--admin-font-xs);
}

.hero-focal-picker__controls {
  display: grid;
  align-content: start;
  gap: var(--admin-space-3);
  max-width: 22rem;
}

.hero-focal-picker__controls > div:first-child {
  display: grid;
  gap: var(--admin-space-1);
}

.hero-focal-picker__controls h4 {
  font-size: var(--admin-font-sm);
}

.hero-focal-picker__controls p {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.hero-focal-picker__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--admin-space-1);
}

.hero-focal-picker__grid button {
  min-height: var(--admin-touch-target);
  padding: var(--admin-space-1);
  color: var(--admin-text-secondary);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  cursor: pointer;
  font: inherit;
  font-size: var(--admin-font-xs);
}

.hero-focal-picker__grid button[aria-pressed='true'] {
  color: var(--admin-text-inverse);
  background: var(--admin-accent-primary);
  border-color: var(--admin-accent-primary);
  font-weight: 700;
}

.hero-focal-picker__grid button[data-nearest='true'] {
  color: var(--admin-accent-primary);
  border-color: var(--admin-accent-primary);
  border-style: dashed;
}

.hero-focal-picker__grid button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (min-width: 960px) {
  .hero-focal-picker {
    grid-template-columns: minmax(0, 52rem) minmax(16rem, 22rem);
    align-items: start;
  }
}
</style>

<script setup lang="ts">
import {
  ASSET_STATUS_LABELS,
} from '~/utils/media-labels'

export interface StudioPhotoEntry {
  alt: string
  assetId: string
  focalX: number
  focalY: number
  height: number
  position: number
  previewUrl: string | null
  primary: boolean
  publicVariantCount: number
  status: 'PENDING' | 'READY' | 'FAILED'
  version: number
  width: number
}

const props = defineProps<{
  entry: StudioPhotoEntry
  index: number
  locked: boolean
  total: number
}>()

const emit = defineEmits<{
  move: [direction: -1 | 1]
  remove: []
  retryProcessing: []
  setPrimary: []
  update: [fields: Partial<Pick<StudioPhotoEntry,
    'alt' | 'focalX' | 'focalY'>>]
}>()

const previewAspect = ref<'original' | 'card'>('original')

const STATE_TONES = {
  READY: 'success',
  PENDING: 'info',
  FAILED: 'error',
} as const

const focalPercent = computed(() => ({
  x: Math.round(props.entry.focalX * 100),
  y: Math.round(props.entry.focalY * 100),
}))

const publicPreviewUsage = computed(() =>
  previewAspect.value === 'card' ? 'work-card' as const : 'detail' as const,
)

function onPreviewPointer(event: PointerEvent) {
  if (props.locked || previewAspect.value !== 'original') {
    return
  }
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  emit('update', {
    focalX: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    focalY: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
  })
}

function onFocalInput(axis: 'x' | 'y', event: Event) {
  const value = Number((event.target as HTMLInputElement).value) / 100
  emit('update', axis === 'x' ? { focalX: value } : { focalY: value })
}
</script>

<template>
  <article class="photo-card" :data-status="entry.status">
    <div class="photo-card__preview-column">
      <div
        v-if="entry.previewUrl"
        class="photo-card__preview"
        :class="`photo-card__preview--${previewAspect}`"
        :style="previewAspect === 'original'
          ? { aspectRatio: `${entry.width} / ${entry.height}` }
          : undefined"
        data-testid="photo-preview"
      >
        <img
          :src="entry.previewUrl"
          :alt="entry.alt || '出厂照本地预览'"
          class="photo-card__image"
          referrerpolicy="no-referrer"
          :style="previewAspect === 'card'
            ? { objectPosition: `${focalPercent.x}% ${focalPercent.y}%` }
            : undefined"
        >
        <span
          class="photo-card__focal"
          :style="{ insetInlineStart: `${focalPercent.x}%`, insetBlockStart: `${focalPercent.y}%` }"
          aria-hidden="true"
        />
        <button
          v-if="previewAspect === 'original' && !locked"
          type="button"
          class="photo-card__focal-hit"
          :aria-label="`点击设置第 ${index + 1} 张焦点`"
          @pointerdown="onPreviewPointer"
        />
        <span v-if="entry.primary" class="photo-card__primary-badge">主图</span>
      </div>
      <div v-else class="photo-card__preview photo-card__preview--empty">
        <span v-if="entry.primary" class="photo-card__primary-badge">主图</span>
        <p class="photo-card__empty-text">
          原图已保存在私有库（{{ entry.width }}×{{ entry.height }}）<br>
          正在加载私有原图预览…
        </p>
      </div>
      <div v-if="entry.previewUrl" class="photo-card__aspect" role="group" :aria-label="`第 ${index + 1} 张预览比例`">
        <button
          type="button"
          class="photo-card__aspect-button"
          :aria-pressed="previewAspect === 'original'"
          @click="previewAspect = 'original'"
        >原比例</button>
        <button
          type="button"
          class="photo-card__aspect-button"
          :aria-pressed="previewAspect === 'card'"
          @click="previewAspect = 'card'"
        >3:4 卡片</button>
      </div>
      <p class="photo-card__preview-note">
        完整原图 · 无水印 · 仅管理员可查看。
      </p>
      <AdminWatermarkedMediaPreview
        :asset-id="entry.assetId"
        :usage="publicPreviewUsage"
      />
    </div>

    <div class="photo-card__body">
      <p class="photo-card__order">
        第 {{ index + 1 }} 张
        <AdminStatusBadge
          :tone="STATE_TONES[entry.status]"
          :label="ASSET_STATUS_LABELS[entry.status]"
        />
        <span v-if="entry.publicVariantCount > 0" class="photo-card__public">
          公开衍生图 {{ entry.publicVariantCount }} 张
        </span>
        <span v-else class="photo-card__not-public">公开衍生图未生成</span>
      </p>
      <p class="photo-card__recipe-note">
        作品详情展示原比例图片；只有主图会生成 3:4 作品卡图片，焦点仅影响作品卡图片。
      </p>

      <p v-if="entry.status === 'FAILED'" class="photo-card__failure" role="alert">
        私有处理源生成失败，可重试处理；原图仍在私有库中。
      </p>

      <div class="photo-card__field">
        <label class="photo-card__label" :for="`alt-${entry.assetId}`">
          图片说明<span aria-hidden="true"> *</span>
        </label>
        <input
          :id="`alt-${entry.assetId}`"
          class="photo-card__input"
          type="text"
          maxlength="500"
          :value="entry.alt"
          :disabled="locked"
          placeholder="例如：正面全身，自然光"
          @input="emit('update', { alt: ($event.target as HTMLInputElement).value })"
        >
      </div>

      <div class="photo-card__focal-sliders">
        <label class="photo-card__label" :for="`focal-x-${entry.assetId}`">
          焦点水平 {{ focalPercent.x }}%
        </label>
        <input
          :id="`focal-x-${entry.assetId}`"
          type="range"
          min="0"
          max="100"
          :value="focalPercent.x"
          :disabled="locked"
          @input="onFocalInput('x', $event)"
        >
        <label class="photo-card__label" :for="`focal-y-${entry.assetId}`">
          焦点垂直 {{ focalPercent.y }}%
        </label>
        <input
          :id="`focal-y-${entry.assetId}`"
          type="range"
          min="0"
          max="100"
          :value="focalPercent.y"
          :disabled="locked"
          @input="onFocalInput('y', $event)"
        >
      </div>
    </div>

    <div class="photo-card__actions">
      <button
        v-if="!entry.primary && entry.status === 'READY'"
        type="button"
        class="photo-card__action"
        :disabled="locked"
        @click="emit('setPrimary')"
      >设为主图</button>
      <button
        type="button"
        class="photo-card__action"
        :disabled="locked || index === 0"
        :aria-label="`上移第 ${index + 1} 张`"
        @click="emit('move', -1)"
      >上移</button>
      <button
        type="button"
        class="photo-card__action"
        :disabled="locked || index === total - 1"
        :aria-label="`下移第 ${index + 1} 张`"
        @click="emit('move', 1)"
      >下移</button>
      <button
        v-if="entry.status === 'FAILED'"
        type="button"
        class="photo-card__action"
        :disabled="locked"
        @click="emit('retryProcessing')"
      >重试处理</button>
      <button
        type="button"
        class="photo-card__action photo-card__action--danger"
        :disabled="locked"
        @click="emit('remove')"
      >移除</button>
    </div>
  </article>
</template>

<style scoped>
.photo-card {
  display: grid;
  gap: var(--admin-space-3);
  padding: var(--admin-space-3);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.photo-card[data-status='FAILED'] {
  border-color: var(--admin-status-error);
}

.photo-card__preview-column {
  display: grid;
  gap: var(--admin-space-2);
  align-content: start;
}

.photo-card__preview {
  position: relative;
  width: 100%;
  max-width: 16rem;
  border-radius: var(--admin-radius-sm);
  overflow: hidden;
  background: var(--admin-bg-subtle);
}

.photo-card__preview--card {
  aspect-ratio: 3 / 4;
}

.photo-card__image {
  width: 100%;
  height: 100%;
  display: block;
}

.photo-card__preview--original .photo-card__image {
  object-fit: contain;
}

.photo-card__preview--card .photo-card__image {
  object-fit: cover;
}

.photo-card__focal {
  position: absolute;
  width: 0.875rem;
  height: 0.875rem;
  margin: -0.4375rem 0 0 -0.4375rem;
  border: 2px solid var(--admin-accent-primary);
  border-radius: 50%;
  background: rgb(255 255 255 / 0.7);
  pointer-events: none;
}

.photo-card__focal-hit {
  position: absolute;
  inset: 0;
  border: none;
  background: transparent;
  cursor: crosshair;
  padding: 0;
}

.photo-card__primary-badge {
  position: absolute;
  inset-inline-start: 0;
  inset-block-start: 0;
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font-size: var(--admin-font-xs);
  font-weight: 600;
  padding: 0.05rem 0.4rem;
  border-end-end-radius: var(--admin-radius-sm);
  z-index: 1;
}

.photo-card__preview--empty {
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--admin-space-3);
  text-align: center;
}

.photo-card__empty-text {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  line-height: var(--admin-line-normal);
}

.photo-card__aspect {
  display: flex;
  gap: var(--admin-space-1);
}

.photo-card__aspect-button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
  font-family: inherit;
  cursor: pointer;
}

.photo-card__aspect-button[aria-pressed='true'] {
  border-color: var(--admin-accent-primary);
  color: var(--admin-accent-primary);
  font-weight: 600;
}

.photo-card__preview-note {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  max-width: 16rem;
}

.photo-card__body {
  display: grid;
  gap: var(--admin-space-3);
  align-content: start;
  min-width: 0;
}

.photo-card__order {
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.photo-card__public {
  color: var(--admin-status-success);
}

.photo-card__not-public {
  color: var(--admin-text-tertiary);
}

.photo-card__failure {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-error);
  line-height: var(--admin-line-normal);
}

.photo-card__recipe-note {
  margin: 0;
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.photo-card__label {
  display: block;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  margin-bottom: var(--admin-space-1);
}

.photo-card__input {
  width: 100%;
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  font: inherit;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
}

.photo-card__focal-sliders {
  display: grid;
  gap: var(--admin-space-1);
}

.photo-card__hint {
  margin: var(--admin-space-1) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.photo-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--admin-space-1);
  align-content: flex-start;
}

.photo-card__action {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font-size: var(--admin-font-xs);
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.photo-card__action:hover:not(:disabled) {
  background: var(--admin-bg-subtle);
}

.photo-card__action:disabled {
  opacity: 0.55;
  cursor: default;
}

.photo-card__action--danger {
  color: var(--admin-danger);
  border-color: var(--admin-danger);
}

@media (min-width: 768px) {
  .photo-card {
    grid-template-columns: 16rem 1fr auto;
  }
}
</style>

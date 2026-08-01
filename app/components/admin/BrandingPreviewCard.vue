<script setup lang="ts">
import type {
  WatermarkOperationDto,
  WatermarkPreviewKind,
  WatermarkProfileDto,
} from '~~/shared/types/contracts'
import {
  WATERMARK_OPERATION_STATUS_LABELS,
  WATERMARK_PREVIEW_ASPECT_LABELS,
  WATERMARK_PREVIEW_KIND_LABELS,
  watermarkFailureHint,
} from '~/utils/watermark-labels'

// 真实 OSS 预览：四比例结果只来自预览操作返回的同源 URL，
// 不使用 CSS 叠层冒充；短时 URL 只存内存，不写入持久存储。
const props = defineProps<{
  draft: WatermarkProfileDto | null
  mutating: boolean
  operation: WatermarkOperationDto | null
}>()

const emit = defineEmits<{
  generate: []
  retry: []
}>()

const PREVIEW_ORDER: WatermarkPreviewKind[] = [
  'work-card',
  'detail',
  'home-hero-landscape',
  'home-hero-portrait',
]

const previewOperation = computed(() => {
  const current = props.operation
  if (
    current
    && current.operationType === 'WATERMARK_PREVIEW'
    && props.draft
    && current.profileId === props.draft.id
  ) {
    return current
  }
  return null
})

const staleNote = computed(() => {
  const current = props.operation
  if (
    props.draft
    && current
    && current.operationType === 'WATERMARK_PREVIEW'
    && current.profileId !== props.draft.id
  ) {
    return '草稿配置已变更，需重新生成预览。'
  }
  return null
})

const failedKinds = ref<Set<WatermarkPreviewKind>>(new Set())
watch(previewOperation, () => {
  failedKinds.value = new Set()
})

function onImageError(kind: WatermarkPreviewKind) {
  failedKinds.value = new Set([...failedKinds.value, kind])
}

const previews = computed(() => {
  const current = previewOperation.value
  if (!current || current.status !== 'DONE') {
    return []
  }
  return PREVIEW_ORDER.flatMap((kind) => {
    const entry = current.previews.find(item => item.kind === kind)
    return entry ? [{ ...entry, expired: failedKinds.value.has(kind) }] : []
  })
})

const zoomed = ref<{ kind: WatermarkPreviewKind, url: string } | null>(null)
const zoomDialog = ref<HTMLElement | null>(null)
let zoomReturnFocus: HTMLElement | null = null

function openZoom(kind: WatermarkPreviewKind, url: string) {
  zoomReturnFocus = document.activeElement as HTMLElement | null
  zoomed.value = { kind, url }
}

watch(zoomed, async (value) => {
  if (value) {
    await nextTick()
    zoomDialog.value?.querySelector<HTMLElement>('[data-zoom-close]')?.focus()
  }
  else {
    zoomReturnFocus?.focus()
    zoomReturnFocus = null
  }
})

function closeZoom() {
  zoomed.value = null
}

function onZoomKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeZoom()
  }
}
</script>

<template>
  <section class="editor-card branding-preview" aria-labelledby="branding-preview-title">
    <div class="editor-card__head">
      <h2 id="branding-preview-title" class="editor-card__title">真实预览</h2>
      <p class="editor-card__hint">由 OSS 按草稿配置真实生成</p>
    </div>

    <p v-if="!draft" class="branding-preview__hint">
      先选择候选并保存草稿配置，再生成真实预览。
    </p>

    <template v-else>
      <p v-if="staleNote" class="branding-preview__hint" role="status">{{ staleNote }}</p>

      <div
        v-if="previewOperation && previewOperation.status !== 'DONE' && previewOperation.status !== 'FAILED'"
        class="branding-preview__status"
        role="status"
      >
        正在生成预览：{{ WATERMARK_OPERATION_STATUS_LABELS[previewOperation.status] }}（
        {{ previewOperation.generatedVariantCount }}/{{ previewOperation.targetVariantCount }}）…
      </div>

      <div
        v-else-if="previewOperation && previewOperation.status === 'FAILED'"
        class="branding-preview__failure"
        role="alert"
      >
        <p class="branding-preview__failure-text">
          {{ watermarkFailureHint(previewOperation.failureCode) }}
        </p>
        <button
          type="button"
          class="editor__button editor__button--secondary"
          :disabled="mutating"
          @click="emit('retry')"
        >重试预览</button>
      </div>

      <div v-if="previews.length > 0" class="branding-preview__grid">
        <figure
          v-for="preview in previews"
          :key="preview.kind"
          class="branding-preview__figure"
        >
          <button
            type="button"
            class="branding-preview__zoom"
            :aria-label="`放大查看${WATERMARK_PREVIEW_KIND_LABELS[preview.kind]}预览`"
            :disabled="preview.expired"
            @click="openZoom(preview.kind, preview.url)"
          >
            <span
              class="branding-preview__frame"
              :style="{ aspectRatio: `${preview.width} / ${preview.height}` }"
            >
              <img
                v-if="!preview.expired"
                :src="preview.url"
                :alt="`${WATERMARK_PREVIEW_KIND_LABELS[preview.kind]}真实水印预览`"
                class="branding-preview__image"
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="onImageError(preview.kind)"
              >
              <span v-else class="branding-preview__expired">预览已过期</span>
            </span>
          </button>
          <figcaption class="branding-preview__caption">
            {{ WATERMARK_PREVIEW_KIND_LABELS[preview.kind] }} ·
            {{ WATERMARK_PREVIEW_ASPECT_LABELS[preview.kind] }}
          </figcaption>
        </figure>
      </div>
      <p
        v-if="previewOperation && previewOperation.status === 'DONE' && failedKinds.size > 0"
        class="branding-preview__hint"
        role="status"
      >
        部分预览已过期，请重新生成。
      </p>

      <div class="branding-preview__actions">
        <button
          type="button"
          class="editor__button editor__button--secondary"
          :disabled="mutating"
          @click="emit('generate')"
        >
          {{ previewOperation ? '重新生成预览' : '生成真实预览' }}
        </button>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="zoomed"
        class="branding-zoom__overlay"
        @keydown="onZoomKeydown"
        @click.self="closeZoom"
      >
        <div
          ref="zoomDialog"
          class="branding-zoom admin-surface"
          role="dialog"
          aria-modal="true"
          :aria-label="zoomed ? `${WATERMARK_PREVIEW_KIND_LABELS[zoomed.kind]}预览放大查看` : undefined"
        >
          <img
            :src="zoomed.url"
            :alt="`${WATERMARK_PREVIEW_KIND_LABELS[zoomed.kind]}真实水印预览（放大）`"
            class="branding-zoom__image"
            referrerpolicy="no-referrer"
          >
          <p class="branding-zoom__caption">
            {{ WATERMARK_PREVIEW_KIND_LABELS[zoomed.kind] }} ·
            {{ WATERMARK_PREVIEW_ASPECT_LABELS[zoomed.kind] }}
          </p>
          <button
            type="button"
            class="editor__button editor__button--secondary"
            data-zoom-close
            @click="closeZoom"
          >关闭</button>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.branding-preview {
  display: grid;
  gap: var(--admin-space-3);
  align-content: start;
}

.branding-preview__hint {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.branding-preview__status {
  font-size: var(--admin-font-sm);
  color: var(--admin-status-info);
}

.branding-preview__failure {
  display: grid;
  gap: var(--admin-space-2);
  justify-items: start;
  padding: var(--admin-space-3);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
}

.branding-preview__failure-text {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-status-error);
}

.branding-preview__grid {
  display: grid;
  gap: var(--admin-space-3);
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .branding-preview__grid {
    grid-template-columns: 1fr 1fr;
  }
}

.branding-preview__figure {
  margin: 0;
  display: grid;
  gap: var(--admin-space-1);
}

.branding-preview__zoom {
  padding: 0;
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-subtle);
  cursor: zoom-in;
  overflow: hidden;
}

.branding-preview__zoom:disabled {
  cursor: default;
}

.branding-preview__frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.branding-preview__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.branding-preview__expired {
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  padding: var(--admin-space-4);
}

.branding-preview__caption {
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  text-align: center;
}

.branding-preview__actions {
  display: flex;
  gap: var(--admin-space-2);
}

.branding-zoom__overlay {
  position: fixed;
  inset: 0;
  background: var(--admin-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--admin-space-4);
  z-index: 60;
}

.branding-zoom {
  background: var(--admin-bg-primary);
  border-radius: var(--admin-radius-lg);
  box-shadow: var(--admin-shadow-modal);
  max-width: min(56rem, 100%);
  max-height: 90vh;
  overflow: auto;
  padding: var(--admin-space-5);
  display: grid;
  gap: var(--admin-space-3);
  justify-items: center;
}

.branding-zoom__image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.branding-zoom__caption {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}
</style>

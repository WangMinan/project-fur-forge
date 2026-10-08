<script setup lang="ts">
import type { ImageCompositions } from '~~/shared/schemas/image-composition'
import type {
  ManagedDesignSheetDto,
  ManagedWorkDto,
} from '~~/shared/types/contracts'
import { ASSET_STATUS_LABELS } from '~/utils/media-labels'
import { ADMIN_MEDIA_LARGE_PREVIEW_WIDTH } from '~~/shared/constants/admin-media-preview'
import {
  adminMediaOriginalUrl,
  adminMediaPreviewUrl,
} from '~/utils/admin-media-preview'

interface DesignSheetEntry {
  compositions?: ImageCompositions | undefined
  compositionsEdited?: boolean
  alt: string
  assetId: string
  height: number
  previewUrl: string
  publicVariantCount: number
  status: 'FAILED' | 'PENDING' | 'READY'
  version: number
  width: number
}

const props = defineProps<{
  locked: boolean
  work: ManagedWorkDto
}>()

const emit = defineEmits<{
  conflict: []
  saved: [work: ManagedWorkDto]
  stateChange: [state: { busy: boolean, dirty: boolean }]
}>()

function toEntry(sheet: ManagedDesignSheetDto): DesignSheetEntry {
  return {
    alt: sheet.alt ?? '',
    assetId: sheet.assetId,
    compositions: JSON.parse(JSON.stringify(sheet.compositions ?? {})),
    compositionsEdited: false,
    height: sheet.height,
    previewUrl: adminMediaPreviewUrl(sheet.assetId, ADMIN_MEDIA_LARGE_PREVIEW_WIDTH),
    publicVariantCount: sheet.publicVariantCount,
    status: sheet.status,
    version: sheet.version,
    width: sheet.width,
  }
}

function payloadOf(value: DesignSheetEntry | null) {
  return value
    ? { assetId: value.assetId, alt: value.alt.trim(), ...(value.compositionsEdited ? { compositions: value.compositions } : {}) }
    : null
}

const { entry, isDirty, saving, processing, saveError, uploads, resetFromWork,
  retryProcessing, save: saveDesignSheet } = useSingleWorkImage<DesignSheetEntry>({
  work: () => props.work, locked: () => props.locked, role: 'design_sheet', label: '设定图',
  fromWork: work => work.purpose === 'adoption' && work.designSheet ? toEntry(work.designSheet) : null,
  fromAsset: asset => ({
    alt: '', assetId: asset.assetId, height: asset.height,
    previewUrl: adminMediaPreviewUrl(asset.assetId, ADMIN_MEDIA_LARGE_PREVIEW_WIDTH),
    publicVariantCount: 0, status: asset.status, version: asset.version, width: asset.width,
  }),
  payload: payloadOf,
  saved: work => emit('saved', work), conflict: () => emit('conflict'),
  stateChange: state => emit('stateChange', state),
})

const needsResolutionAdaptation = computed(() => Boolean(entry.value && entry.value.width < 2_400))

defineExpose({ save: saveDesignSheet })
</script>

<template>
  <section id="design-sheet" class="editor-card" aria-labelledby="design-sheet-title">
    <div class="editor-card__head">
      <h2 id="design-sheet-title" class="editor-card__title">领养设定图</h2>
      <p class="editor-card__hint">{{ entry ? '1/1' : '0/1' }} · 仅领养作品</p>
    </div>

    <p v-if="locked" class="design-sheet__locked" role="status">
      作品已发布，设定图为只读；如需替换请先下架。
    </p>

    <article v-if="entry" class="design-sheet__entry" :data-status="entry.status">
      <div class="design-sheet__preview">
        <p class="design-sheet__preview-title">私有编辑预览</p>
        <div
          class="design-sheet__canvas"
          :style="{ aspectRatio: `${entry.width} / ${entry.height}` }"
          data-testid="design-sheet-original-preview"
        >
          <img
            :src="entry.previewUrl"
            :alt="entry.alt || '领养设定图编辑预览'"
            referrerpolicy="same-origin"
          >
        </div>
        <p class="design-sheet__note">
          {{ entry.width }}×{{ entry.height }} · {{ ADMIN_MEDIA_LARGE_PREVIEW_WIDTH }} px 编辑预览 · 仅管理员可查看
          · <a
            :href="adminMediaOriginalUrl(entry.assetId)"
            target="_blank"
            rel="noopener"
          >查看原图</a>
        </p>
        <p
          v-if="needsResolutionAdaptation"
          class="design-sheet__resolution-warning"
          role="status"
        >
          这张原图分辨率较低，仍可保存和发布。发布时会用 FFmpeg Lanczos 生成私有适配源，然后才会执行上传。
        </p>
      </div>

      <div class="design-sheet__body">
        <AdminImageCompositionControls
:asset-id="entry.assetId" :src="entry.previewUrl" role="design_sheet"
        :width="entry.width" :height="entry.height" :title="entry.alt" :caption="`${work.characterName} · ${work.species}`" :compositions="entry.compositions"
        :disabled="locked || processing || entry.status !== 'READY'" @update="entry.compositions = $event; entry.compositionsEdited = true" />
        <p class="design-sheet__status">
          <AdminStatusBadge
            :tone="entry.status === 'READY' ? 'success' : entry.status === 'FAILED' ? 'error' : 'info'"
            :label="ASSET_STATUS_LABELS[entry.status]"
          />
          <span v-if="entry.publicVariantCount > 0" class="design-sheet__public">
            公开图片 {{ entry.publicVariantCount }} 张
          </span>
          <span v-else>尚未生成公开图片</span>
        </p>
        <label class="design-sheet__label" :for="`design-alt-${entry.assetId}`">
          图片说明<span aria-hidden="true"> *</span>
        </label>
        <input
          :id="`design-alt-${entry.assetId}`"
          class="design-sheet__input"
          type="text"
          maxlength="500"
          :value="entry.alt"
          :disabled="locked || processing"
          placeholder="例如：角色正侧背三视图与色板"
          @input="entry.alt = ($event.target as HTMLInputElement).value"
        >
        <p v-if="entry.status === 'FAILED'" class="design-sheet__error" role="alert">
          私有处理源生成失败；原图仍保留，可重试处理。
        </p>
        <AdminTaskProgress
          v-if="processing"
          mode="indeterminate"
          label="设定图：FFmpeg 私有预处理中"
          stage="正在生成私有处理源"
          show-elapsed
        />
        <div class="design-sheet__entry-actions">
          <AdminAction
            v-if="entry.status === 'FAILED'"
            :disabled="locked || processing"
            :loading="processing"
            loading-label="处理中…"
            @click="retryProcessing"
          >重试处理</AdminAction>
          <AdminAction
            :disabled="locked || processing"
            @click="entry = null"
          >移除设定图</AdminAction>
        </div>
      </div>
    </article>

    <p v-else-if="uploads.items.value.length === 0" class="design-sheet__empty">
      还没有设定图。此项可选，可按需上传并保存一张完整设定图。
    </p>

    <AdminWorkImageUploader :disabled="locked" :empty="!entry" label="设定图" :uploads="uploads" :work-id="work.id" :work-version="work.version" />

    <div v-if="isDirty" class="design-sheet__actions">
      <AdminAction
        variant="primary"
        :disabled="saving || locked"
        :loading="saving"
        loading-label="保存中…"
        @click="saveDesignSheet"
      >保存设定图</AdminAction>
      <AdminAction
        :disabled="saving"
        @click="resetFromWork(work)"
      >放弃更改</AdminAction>
      <span class="design-sheet__dirty">设定图有未保存更改</span>
    </div>
    <p class="design-sheet__note">“移除”只解除作品关系，私有原图保留；保存后生效。</p>
    <p v-if="saveError" class="design-sheet__error" role="alert">{{ saveError }}</p>
  </section>
</template>

<style scoped>
.design-sheet__note {
  margin: 0 0 var(--admin-space-3);
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.design-sheet__locked {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-info-soft);
  color: var(--admin-status-info);
  font-size: var(--admin-font-sm);
}

.design-sheet__resolution-warning {
  margin: 0 0 var(--admin-space-3);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-warning-soft);
  color: var(--admin-status-warning);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.design-sheet__entry {
  display: grid;
  gap: var(--admin-space-4);
  margin-bottom: var(--admin-space-4);
  padding: var(--admin-space-3);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.design-sheet__entry[data-status='FAILED'] {
  border-color: var(--admin-status-error);
}

.design-sheet__preview,
.design-sheet__body {
  display: grid;
  gap: var(--admin-space-2);
  align-content: start;
  min-width: 0;
}

.design-sheet__preview-title,
.design-sheet__status {
  margin: 0;
  font-size: var(--admin-font-xs);
}

.design-sheet__preview-title,
.design-sheet__label {
  font-weight: 600;
}

.design-sheet__canvas {
  width: 100%;
  overflow: hidden;
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-subtle);
}

.design-sheet__canvas img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.design-sheet__status {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
  color: var(--admin-text-tertiary);
}

.design-sheet__public {
  color: var(--admin-status-success);
}

.design-sheet__label {
  font-size: var(--admin-font-xs);
}

.design-sheet__input {
  width: 100%;
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
}

.design-sheet__entry-actions,
.design-sheet__actions {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
}

.design-sheet__empty {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-5);
  border: 1px dashed var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  text-align: center;
}

.design-sheet__actions {
  margin-top: var(--admin-space-3);
}

.design-sheet__dirty {
  color: var(--admin-status-warning);
  font-size: var(--admin-font-xs);
  font-weight: 600;
}

.design-sheet__error {
  margin: var(--admin-space-3) 0 0;
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
}

@media (min-width: 768px) {
  .design-sheet__entry {
    grid-template-columns: minmax(20rem, 1.4fr) minmax(14rem, 1fr);
  }
}
</style>

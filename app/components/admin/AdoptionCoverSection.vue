<script setup lang="ts">
import type { ImageCompositions } from '~~/shared/schemas/image-composition'
import type { ManagedAdoptionCoverDto, ManagedWorkDto } from '~~/shared/types/contracts'
import { ADMIN_MEDIA_LARGE_PREVIEW_WIDTH } from '~~/shared/constants/admin-media-preview'
import { adminMediaOriginalUrl, adminMediaPreviewUrl } from '~/utils/admin-media-preview'
import { ASSET_STATUS_LABELS } from '~/utils/media-labels'

interface CoverEntry {
  compositions?: ImageCompositions | undefined
  compositionsEdited?: boolean
  alt: string
  assetId: string
  crop: ManagedAdoptionCoverDto['crop']
  focalX: number
  focalY: number
  height: number
  previewUrl: string
  publicVariantCount: number
  status: 'FAILED' | 'PENDING' | 'READY'
  version: number
  width: number
}

const props = defineProps<{ locked: boolean, work: ManagedWorkDto }>()
const emit = defineEmits<{
  conflict: []
  saved: [work: ManagedWorkDto]
  stateChange: [state: { busy: boolean, dirty: boolean }]
}>()

function toEntry(cover: ManagedAdoptionCoverDto): CoverEntry {
  return {
    alt: cover.alt,
    assetId: cover.assetId,
    compositions: JSON.parse(JSON.stringify(cover.compositions ?? {})),
    compositionsEdited: false,
    crop: cover.crop,
    focalX: cover.focalX,
    focalY: cover.focalY,
    height: cover.height,
    previewUrl: adminMediaPreviewUrl(cover.assetId, ADMIN_MEDIA_LARGE_PREVIEW_WIDTH),
    publicVariantCount: cover.publicVariantCount,
    status: cover.status,
    version: cover.version,
    width: cover.width,
  }
}

function payloadOf(value: CoverEntry | null) {
  return value
    ? {
        assetId: value.assetId,
        alt: value.alt.trim(),
        focalX: value.focalX,
        focalY: value.focalY,
        crop: value.crop,
        ...(value.compositionsEdited ? { compositions: value.compositions } : {}),
      }
    : null
}

const { entry, isDirty, saving, processing, saveError, uploads, resetFromWork,
  retryProcessing, save: saveCover } = useSingleWorkImage<CoverEntry>({
  work: () => props.work, locked: () => props.locked, role: 'adoption_cover', label: '横版封面',
  fromWork: work => work.purpose === 'adoption' && work.adoptionCover ? toEntry(work.adoptionCover) : null,
  fromAsset: asset => ({
    alt: '', assetId: asset.assetId, height: asset.height,
    previewUrl: adminMediaPreviewUrl(asset.assetId, ADMIN_MEDIA_LARGE_PREVIEW_WIDTH),
    publicVariantCount: 0, status: asset.status, version: asset.version, width: asset.width,
    crop: { x: 0, y: 0, width: 1, height: 1 }, focalX: asset.focalX, focalY: asset.focalY,
  }),
  payload: payloadOf,
  saved: work => emit('saved', work), conflict: () => emit('conflict'),
  stateChange: state => emit('stateChange', state),
})

const focalPercent = computed(() => ({ x: Math.round((entry.value?.focalX ?? 0.5) * 100), y: Math.round((entry.value?.focalY ?? 0.5) * 100) }))

function onFocalInput(axis: 'x' | 'y', event: Event) {
  if (!entry.value) {
    return
  }
  entry.value[axis === 'x' ? 'focalX' : 'focalY']
    = Number((event.target as HTMLInputElement).value) / 100
}

defineExpose({ save: saveCover })
</script>

<template>
  <section id="adoption-cover" class="editor-card" aria-labelledby="adoption-cover-title">
    <div class="editor-card__head">
      <h2 id="adoption-cover-title" class="editor-card__title">领养横版封面</h2>
      <p class="editor-card__hint">{{ entry ? '1/1' : '0/1' }} · 与设定图至少上传其一</p>
    </div>
    <p class="cover__note">请上传真实横版单头成果图；系统不会从设定图或出厂照自动裁切替代。</p>
    <p v-if="locked" class="cover__locked" role="status">作品已发布，横版封面为只读；如需替换请先下架。</p>

    <article v-if="entry" class="cover__entry" :data-status="entry.status">
      <div class="cover__preview" :style="work.imageCompositionVersion ? { aspectRatio: `${entry.width} / ${entry.height}` } : undefined">
        <img
          :src="entry.previewUrl"
          :alt="entry.alt || '领养横版封面编辑预览'"
          :style="{ objectPosition: `${focalPercent.x}% ${focalPercent.y}%` }"
          referrerpolicy="same-origin"
        >
      </div>
      <p class="cover__note">
        {{ entry.width }}×{{ entry.height }} · 私有编辑预览 ·
        <a :href="adminMediaOriginalUrl(entry.assetId)" target="_blank" rel="noopener">查看原图</a>
      </p>
<AdminImageCompositionControls
:asset-id="entry.assetId" :src="entry.previewUrl" role="adoption_cover"
        :width="entry.width" :height="entry.height" :title="entry.alt" :caption="`${work.characterName} · ${work.species}`" :compositions="entry.compositions"
        :disabled="locked || processing || entry.status !== 'READY'" @update="entry.compositions = $event; entry.compositionsEdited = true" />
      <p class="cover__status">
        <AdminStatusBadge
          :tone="entry.status === 'READY' ? 'success' : entry.status === 'FAILED' ? 'error' : 'info'"
          :label="ASSET_STATUS_LABELS[entry.status]"
        />
        <span>{{ entry.publicVariantCount > 0 ? `公开图片 ${entry.publicVariantCount} 张` : '尚未生成公开图片' }}</span>
      </p>
      <label class="cover__label" :for="`cover-alt-${entry.assetId}`">图片说明 <span aria-hidden="true">*</span></label>
      <input
        :id="`cover-alt-${entry.assetId}`"
        v-model="entry.alt"
        class="cover__input"
        maxlength="500"
        :disabled="locked || processing"
        placeholder="例如：角色正面横版领养封面"
      >
      <template v-if="work.imageCompositionVersion === 0">
      <label class="cover__label" :for="`cover-x-${entry.assetId}`">水平焦点 {{ focalPercent.x }}%</label>
      <input :id="`cover-x-${entry.assetId}`" type="range" min="0" max="100" :value="focalPercent.x" :disabled="locked || processing" @input="onFocalInput('x', $event)">
      <label class="cover__label" :for="`cover-y-${entry.assetId}`">垂直焦点 {{ focalPercent.y }}%</label>
      <input :id="`cover-y-${entry.assetId}`" type="range" min="0" max="100" :value="focalPercent.y" :disabled="locked || processing" @input="onFocalInput('y', $event)">
      </template>
      <div class="cover__actions">
        <AdminAction v-if="entry.status === 'FAILED'" :disabled="locked || processing" :loading="processing" loading-label="处理中…" @click="retryProcessing">重试处理</AdminAction>
        <AdminAction :disabled="locked || processing" @click="entry = null">移除横版封面</AdminAction>
      </div>
    </article>

    <p v-else-if="uploads.items.value.length === 0" class="cover__empty">还没有领养横版封面。</p>
    <AdminWorkImageUploader :disabled="locked" :empty="!entry" label="横版封面" :uploads="uploads" :work-id="work.id" :work-version="work.version" />

    <div v-if="isDirty" class="cover__actions">
      <AdminAction variant="primary" :disabled="saving || locked" :loading="saving" loading-label="保存中…" @click="saveCover">保存横版封面</AdminAction>
      <AdminAction :disabled="saving" @click="resetFromWork(work)">放弃更改</AdminAction>
      <span class="cover__dirty">横版封面有未保存更改</span>
    </div>
    <p v-if="saveError" class="cover__error" role="alert">{{ saveError }}</p>
  </section>
</template>

<style scoped>
.cover__entry { display: grid; gap: var(--admin-space-3); margin-bottom: var(--admin-space-4); padding: var(--admin-space-3); border: 1px solid var(--admin-border-secondary); border-radius: var(--admin-radius-md); }
.cover__entry[data-status='FAILED'] { border-color: var(--admin-status-error); }
.cover__preview { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--admin-radius-sm); background: var(--admin-bg-subtle); }
.cover__preview img { width: 100%; height: 100%; object-fit: cover; }
.cover__note, .cover__status { margin: 0 0 var(--admin-space-3); color: var(--admin-text-tertiary); font-size: var(--admin-font-xs); line-height: var(--admin-line-normal); }
.cover__status, .cover__actions { display: flex; align-items: center; gap: var(--admin-space-2); flex-wrap: wrap; }
.cover__label { font-size: var(--admin-font-xs); font-weight: 600; }
.cover__input { width: 100%; min-height: var(--admin-control-height-sm); padding: 0 var(--admin-space-2); border: 1px solid var(--admin-border-primary); border-radius: var(--admin-radius-sm); font: inherit; }
.cover__locked { margin-bottom: var(--admin-space-3); padding: var(--admin-space-3) var(--admin-space-4); border-radius: var(--admin-radius-md); color: var(--admin-status-info); background: var(--admin-status-info-soft); font-size: var(--admin-font-sm); }
.cover__empty { padding: var(--admin-space-5); border: 1px dashed var(--admin-border-primary); border-radius: var(--admin-radius-md); color: var(--admin-text-secondary); text-align: center; }
/* 与「领养设定图」一致：直属本卡片的操作行和上方图像框留出间距，不贴边。
   `.cover__entry` 内部那一行不受影响——那里的间距由 entry 自己的 grid gap 给。 */
.editor-card > .cover__actions { margin-top: var(--admin-space-3); }
.cover__dirty { color: var(--admin-status-warning); font-size: var(--admin-font-xs); font-weight: 600; }
.cover__error { color: var(--admin-status-error); font-size: var(--admin-font-sm); }
</style>

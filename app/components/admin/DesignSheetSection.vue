<script setup lang="ts">
import { managedWorkResponseSchema } from '~~/shared/schemas/work'
import { retryAssetProcessingResponseSchema } from '~~/shared/schemas/upload'
import type {
  ManagedDesignSheetDto,
  ManagedWorkDto,
} from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'
import { ASSET_STATUS_LABELS } from '~/utils/media-labels'
import { ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH } from '~~/shared/constants/admin-media-preview'
import {
  adminMediaOriginalUrl,
  adminMediaPreviewUrl,
} from '~/utils/admin-media-preview'

interface DesignSheetEntry {
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

const adminApi = useAdminApi()
const entry = ref<DesignSheetEntry | null>(null)
const baseline = shallowRef('null')
const saving = shallowRef(false)
const processing = shallowRef(false)
const saveError = shallowRef<string | null>(null)
const selectedFile = shallowRef<File | null>(null)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

function toEntry(sheet: ManagedDesignSheetDto): DesignSheetEntry {
  return {
    alt: sheet.alt ?? '',
    assetId: sheet.assetId,
    height: sheet.height,
    previewUrl: adminMediaPreviewUrl(sheet.assetId, ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH),
    publicVariantCount: sheet.publicVariantCount,
    status: sheet.status,
    version: sheet.version,
    width: sheet.width,
  }
}

function payloadOf(value: DesignSheetEntry | null) {
  return value
    ? { assetId: value.assetId, alt: value.alt.trim() }
    : null
}

function resetFromWork(work: ManagedWorkDto) {
  const sheet = work.purpose === 'adoption' ? work.designSheet : null
  entry.value = sheet ? toEntry(sheet) : null
  baseline.value = JSON.stringify(payloadOf(entry.value))
}

resetFromWork(props.work)

const isDirty = computed(() =>
  JSON.stringify(payloadOf(entry.value)) !== baseline.value,
)

const uploads = useStudioPhotoUpload({
  mediaRole: 'design_sheet',
  onAssetReady(item, asset) {
    if (entry.value?.assetId === asset.assetId) {
      uploads.dismiss(item)
      return
    }
    entry.value = {
      alt: '',
      assetId: asset.assetId,
      height: asset.height,
      previewUrl: adminMediaPreviewUrl(asset.assetId, ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH),
      publicVariantCount: 0,
      status: asset.status,
      version: asset.version,
      width: asset.width,
    }
    uploads.dismiss(item)
  },
  onWorkConflict() {
    emit('conflict')
  },
})

const busyUploads = computed(() => uploads.items.value.filter(item =>
  ['digesting', 'uploading', 'validating'].includes(item.state),
).length)

const needsResolutionAdaptation = computed(() => {
  if (!entry.value) {
    return false
  }
  return entry.value.width < 2_400
})

watch(() => props.work, (work) => {
  if (!isDirty.value) {
    resetFromWork(work)
  }
})

watchEffect(() => {
  emit('stateChange', {
    busy: saving.value || processing.value || busyUploads.value > 0,
    dirty: isDirty.value,
  })
})

onMounted(() => {
  void uploads.restore({
    workId: props.work.id,
    workVersion: props.work.version,
  })
})

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
}

async function uploadSelectedFile() {
  const file = selectedFile.value
  if (!file || props.locked || entry.value || busyUploads.value > 0) {
    return
  }
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  await uploads.startUpload(file, {
    workId: props.work.id,
    workVersion: props.work.version,
  })
}

async function retryEntryProcessing() {
  if (!entry.value || processing.value) {
    return
  }
  processing.value = true
  saveError.value = null
  try {
    const result = await adminApi(
      `/api/admin/v1/media/assets/${entry.value.assetId}/retry-processing`,
      {
        method: 'POST',
        body: { expectedVersion: entry.value.version, payload: {} },
        schema: retryAssetProcessingResponseSchema,
      },
    )
    entry.value.status = result.data.status
    entry.value.version = result.data.version
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    saveError.value = '重试处理失败，请稍后重试。'
  }
  finally {
    processing.value = false
  }
}

async function saveDesignSheet(): Promise<boolean> {
  if (saving.value || props.locked) {
    return false
  }
  saveError.value = null
  if (entry.value && entry.value.alt.trim() === '') {
    saveError.value = '设定图需要填写图片说明后才能保存。'
    return false
  }
  saving.value = true
  try {
    const result = await adminApi(
      `/api/admin/v1/works/${props.work.id}/design-sheet`,
      {
        method: 'PUT',
        body: {
          expectedVersion: props.work.version,
          payload: { designSheet: payloadOf(entry.value) },
        },
        schema: managedWorkResponseSchema,
      },
    )
    resetFromWork(result.data)
    emit('saved', result.data)
    return true
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return false
    }
    if (error instanceof AdminApiError && error.status === 409) {
      emit('conflict')
      saveError.value = '作品数据已在其他地方变化，本次设定图未保存。'
      return false
    }
    saveError.value = error instanceof AdminApiError && error.status === 400
      ? '设定图内容未通过校验，请检查图片说明。'
      : '保存设定图失败，请稍后重试。'
    return false
  }
  finally {
    saving.value = false
  }
}

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
          {{ entry.width }}×{{ entry.height }} · 640 px 编辑预览 · 仅管理员可查看
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
            @click="retryEntryProcessing"
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

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      aria-label="选择领养设定图文件"
      @change="onFileChange"
    >
    <div v-if="!entry" class="design-sheet__uploader">
      <AdminAction
        :disabled="locked || busyUploads > 0"
        @click="pickFile"
      >选择设定图</AdminAction>
      <span class="design-sheet__filename">{{ selectedFile?.name ?? '未选择图片' }}</span>
      <AdminAction
        variant="primary"
        :disabled="!selectedFile || locked || busyUploads > 0"
        :loading="busyUploads > 0"
        loading-label="处理中…"
        @click="uploadSelectedFile"
      >上传设定图</AdminAction>
    </div>

    <ul v-if="uploads.items.value.length > 0" class="design-sheet__uploads" role="list">
      <li v-for="item in uploads.items.value" :key="item.id">
        <AdminUploadSessionCard
          :item="item"
          @cancel="uploads.cancelUpload(item)"
          @dismiss="uploads.dismiss(item)"
          @retry-processing="uploads.retryProcessing(item)"
          @retry-upload="uploads.retryUpload(item, {
            workId: work.id,
            workVersion: work.version,
          })"
        />
      </li>
    </ul>

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
.design-sheet__uploader,
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

.design-sheet__filename {
  min-width: 8rem;
  max-width: 24rem;
  overflow: hidden;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.design-sheet__uploads {
  display: grid;
  gap: var(--admin-space-3);
  margin: var(--admin-space-3) 0 0;
  padding: 0;
  list-style: none;
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

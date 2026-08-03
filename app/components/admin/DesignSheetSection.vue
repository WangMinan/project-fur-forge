<script setup lang="ts">
import { managedWorkResponseSchema } from '~~/shared/schemas/work'
import { retryAssetProcessingResponseSchema } from '~~/shared/schemas/upload'
import type {
  ManagedDesignSheetDto,
  ManagedWorkDto,
} from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'
import { ASSET_STATUS_LABELS } from '~/utils/media-labels'

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
const saveError = shallowRef<string | null>(null)
const selectedFile = shallowRef<File | null>(null)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

function toEntry(sheet: ManagedDesignSheetDto): DesignSheetEntry {
  return {
    alt: sheet.alt ?? '',
    assetId: sheet.assetId,
    height: sheet.height,
    previewUrl: `/api/admin/v1/media/assets/${sheet.assetId}/preview`,
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
      previewUrl: `/api/admin/v1/media/assets/${asset.assetId}/preview`,
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

watch(() => props.work, (work) => {
  if (!isDirty.value) {
    resetFromWork(work)
  }
})

watchEffect(() => {
  emit('stateChange', {
    busy: saving.value || busyUploads.value > 0,
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
  if (!entry.value) {
    return
  }
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
}

async function saveDesignSheet() {
  if (saving.value || props.locked) {
    return
  }
  saveError.value = null
  if (entry.value && entry.value.alt.trim() === '') {
    saveError.value = '设定图需要填写图片说明（alt）后才能保存。'
    return
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
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      emit('conflict')
      saveError.value = '作品数据已在其他地方变化，本次设定图未保存。'
      return
    }
    saveError.value = error instanceof AdminApiError && error.status === 400
      ? '设定图内容未通过校验，请检查图片说明。'
      : '保存设定图失败，请稍后重试。'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <section id="design-sheet" class="editor-card" aria-labelledby="design-sheet-title">
    <div class="editor-card__head">
      <h2 id="design-sheet-title" class="editor-card__title">领养设定图</h2>
      <p class="editor-card__hint">{{ entry ? '1/1' : '0/1' }} · 仅领养作品</p>
    </div>

    <p class="design-sheet__purpose">
      用于 <code>/adoptions</code> 与统一作品详情。公开 design-sheet recipe 保持横版完整画布并 contain，不做 3:4 破坏性裁切。
    </p>
    <p class="design-sheet__watermark">
      活动水印：brand-centered-v2 · 固定居中；本页不提供四角位置控件。
    </p>
    <p v-if="locked" class="design-sheet__locked" role="status">
      作品已发布，设定图为只读；如需替换请先下架。
    </p>

    <article v-if="entry" class="design-sheet__entry" :data-status="entry.status">
      <div class="design-sheet__preview">
        <p class="design-sheet__preview-title">私有原图预览</p>
        <div
          class="design-sheet__canvas"
          :style="{ aspectRatio: `${entry.width} / ${entry.height}` }"
          data-testid="design-sheet-original-preview"
        >
          <img
            :src="entry.previewUrl"
            :alt="entry.alt || '领养设定图原图预览'"
            referrerpolicy="same-origin"
          >
        </div>
        <p class="design-sheet__note">
          {{ entry.width }}×{{ entry.height }} · 仅通过 assetId 同源认证读取 · 无水印
        </p>
        <AdminWatermarkedMediaPreview
          :asset-id="entry.assetId"
          usage="design-sheet"
        />
      </div>

      <div class="design-sheet__body">
        <p class="design-sheet__status">
          <AdminStatusBadge
            :tone="entry.status === 'READY' ? 'success' : entry.status === 'FAILED' ? 'error' : 'info'"
            :label="ASSET_STATUS_LABELS[entry.status]"
          />
          <span v-if="entry.publicVariantCount > 0" class="design-sheet__public">
            公开 variant {{ entry.publicVariantCount }} 张
          </span>
          <span v-else>公开 variant 未生成</span>
        </p>
        <label class="design-sheet__label" :for="`design-alt-${entry.assetId}`">
          图片说明（alt）<span aria-hidden="true"> *</span>
        </label>
        <input
          :id="`design-alt-${entry.assetId}`"
          class="design-sheet__input"
          type="text"
          maxlength="500"
          :value="entry.alt"
          :disabled="locked"
          placeholder="例如：角色正侧背三视图与色板"
          @input="entry.alt = ($event.target as HTMLInputElement).value"
        >
        <p v-if="entry.status === 'FAILED'" class="design-sheet__error" role="alert">
          私有处理源生成失败；原图仍保留，可重试处理。
        </p>
        <div class="design-sheet__entry-actions">
          <button
            v-if="entry.status === 'FAILED'"
            type="button"
            class="editor__button editor__button--secondary"
            :disabled="locked"
            @click="retryEntryProcessing"
          >重试处理</button>
          <button
            type="button"
            class="editor__button editor__button--secondary"
            :disabled="locked"
            @click="entry = null"
          >移除设定图</button>
        </div>
      </div>
    </article>

    <p v-else-if="uploads.items.value.length === 0" class="design-sheet__empty">
      还没有设定图。常规领养在保存一张 READY 横版设定图前会被发布检查阻断。
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
      <button
        type="button"
        class="editor__button editor__button--secondary"
        :disabled="locked || busyUploads > 0"
        @click="pickFile"
      >选择设定图</button>
      <span class="design-sheet__filename">{{ selectedFile?.name ?? '未选择图片' }}</span>
      <button
        type="button"
        class="editor__button editor__button--primary"
        :disabled="!selectedFile || locked || busyUploads > 0"
        @click="uploadSelectedFile"
      >{{ busyUploads > 0 ? '处理中…' : '上传设定图' }}</button>
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
      <button
        type="button"
        class="editor__button editor__button--primary"
        :disabled="saving || locked"
        @click="saveDesignSheet"
      >{{ saving ? '保存中…' : '保存设定图' }}</button>
      <button
        type="button"
        class="editor__button editor__button--secondary"
        :disabled="saving"
        @click="resetFromWork(work)"
      >放弃更改</button>
      <span class="design-sheet__dirty">设定图有未保存更改</span>
    </div>
    <p class="design-sheet__note">“移除”只解除作品关系，私有原图保留；保存后生效。</p>
    <p v-if="saveError" class="design-sheet__error" role="alert">{{ saveError }}</p>
  </section>
</template>

<style scoped>
.design-sheet__purpose,
.design-sheet__watermark,
.design-sheet__note {
  margin: 0 0 var(--admin-space-3);
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.design-sheet__purpose code {
  font-family: var(--font-admin-mono);
}

.design-sheet__locked {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-info-soft);
  color: var(--admin-status-info);
  font-size: var(--admin-font-sm);
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

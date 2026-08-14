<script setup lang="ts">
import { managedWorkResponseSchema } from '~~/shared/schemas/work'
import type {
  ManagedStudioPhotoDto,
  ManagedWorkDto,
} from '~~/shared/types/contracts'
import { retryAssetProcessingResponseSchema } from '~~/shared/schemas/upload'
import { AdminApiError } from '~/composables/useAdminApi'
import { ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH } from '~~/shared/constants/admin-media-preview'
import { adminMediaPreviewUrl } from '~/utils/admin-media-preview'
import type { StudioPhotoEntry } from './StudioPhotoCard.vue'

interface SectionEntry extends StudioPhotoEntry {
  crop: {
    height: number
    width: number
    x: number
    y: number
  }
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

function toEntry(
  photo: ManagedStudioPhotoDto,
  previous?: SectionEntry,
): SectionEntry {
  return {
    alt: photo.alt,
    assetId: photo.assetId,
    crop: photo.crop,
    focalX: photo.focalX,
    focalY: photo.focalY,
    height: photo.height,
    position: photo.position,
    previewUrl: previous?.previewUrl
      ?? adminMediaPreviewUrl(photo.assetId, ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH),
    primary: photo.primary,
    publicVariantCount: photo.publicVariantCount,
    status: photo.status,
    version: photo.version,
    width: photo.width,
  }
}

const entries = ref<SectionEntry[]>([])
const baseline = ref('')

function resetFromWork(work: ManagedWorkDto) {
  const previous = entries.value
  entries.value = work.studioPhotos.map(photo =>
    toEntry(photo, previous.find(entry => entry.assetId === photo.assetId)),
  )
  baseline.value = JSON.stringify(payloadOf(entries.value))
}

function payloadOf(source: SectionEntry[]) {
  return source.map(entry => ({
    assetId: entry.assetId,
    alt: entry.alt.trim(),
    primary: entry.primary,
    focalX: entry.focalX,
    focalY: entry.focalY,
    crop: entry.crop,
  }))
}

resetFromWork(props.work)

// 页面在保存/发布/冲突重载后传入新 work：本地无未保存更改时跟随重建，
// 有未保存更改时保留本地编辑（版本冲突由页面横幅处理）。
watch(() => props.work, (work) => {
  if (!isDirty.value) {
    resetFromWork(work)
  }
})

onMounted(() => {
  void uploads.restore({
    workId: props.work.id,
    workVersion: props.work.version,
  })
})

const uploads = useStudioPhotoUpload({
  mediaRole: 'studio_photo',
  onAssetReady(item, asset) {
    if (entries.value.some(entry => entry.assetId === asset.assetId)) {
      uploads.dismiss(item)
      return
    }
    entries.value.push({
      alt: '',
      assetId: asset.assetId,
      crop: { x: 0, y: 0, width: 1, height: 1 },
      focalX: asset.focalX,
      focalY: asset.focalY,
      height: asset.height,
      position: entries.value.length,
      previewUrl: adminMediaPreviewUrl(asset.assetId, ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH),
      primary: entries.value.length === 0,
      publicVariantCount: 0,
      status: asset.status,
      version: asset.version,
      width: asset.width,
    })
    uploads.dismiss(item)
  },
  onWorkConflict() {
    emit('conflict')
  },
})

const saving = ref(false)
const processingAssetId = shallowRef<string | null>(null)
const saveError = ref<string | null>(null)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const selectedFile = ref<File | null>(null)

const isDirty = computed(() =>
  JSON.stringify(payloadOf(entries.value)) !== baseline.value,
)

const busyUploads = computed(() =>
  uploads.items.value.filter(item =>
    ['digesting', 'uploading', 'validating'].includes(item.state),
  ).length,
)

const uploadSlotsFull = computed(() =>
  entries.value.length + busyUploads.value >= 5,
)

const altMissing = computed(() =>
  entries.value.some(entry => entry.alt.trim() === ''),
)

const emptyText = computed(() => props.work.purpose === 'adoption'
  ? '还没有出厂照。常规领养可只用设定图发布；添加出厂照后将显示在统一作品详情的作品图集中。'
  : '还没有出厂照。发布前至少需要一张处理完成的出厂照并设为主图。',
)

watchEffect(() => {
  emit('stateChange', {
    busy: saving.value || processingAssetId.value !== null || busyUploads.value > 0,
    dirty: isDirty.value,
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
  if (!file || props.locked || uploadSlotsFull.value) {
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

function updateEntry(index: number, fields: Partial<SectionEntry>) {
  const entry = entries.value[index]
  if (entry) {
    Object.assign(entry, fields)
  }
}

function moveEntry(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= entries.value.length) {
    return
  }
  const [entry] = entries.value.splice(index, 1)
  entries.value.splice(target, 0, entry!)
}

function removeEntry(index: number) {
  entries.value.splice(index, 1)
  // 主图被移除后保持“恰好一张主图”约束，首张顺位补位。
  if (entries.value.length > 0 && !entries.value.some(entry => entry.primary)) {
    entries.value[0]!.primary = true
  }
}

function setPrimary(index: number) {
  entries.value.forEach((entry, position) => {
    entry.primary = position === index
  })
}

async function retryEntryProcessing(entry: SectionEntry) {
  if (processingAssetId.value !== null) {
    return
  }
  processingAssetId.value = entry.assetId
  saveError.value = null
  try {
    const result = await adminApi(
      `/api/admin/v1/media/assets/${entry.assetId}/retry-processing`,
      {
        method: 'POST',
        body: { expectedVersion: entry.version, payload: {} },
        schema: retryAssetProcessingResponseSchema,
      },
    )
    entry.status = result.data.status
    entry.version = result.data.version
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    saveError.value = '重试处理失败，请稍后重试。'
  }
  finally {
    processingAssetId.value = null
  }
}

async function savePhotos(): Promise<boolean> {
  if (saving.value || props.locked) {
    return false
  }
  saveError.value = null
  if (entries.value.length > 0 && altMissing.value) {
    saveError.value = '每张出厂照都需要填写图片说明后才能保存。'
    return false
  }
  saving.value = true
  try {
    const result = await adminApi(
      `/api/admin/v1/works/${props.work.id}/studio-photos`,
      {
        method: 'PUT',
        body: {
          expectedVersion: props.work.version,
          payload: { photos: payloadOf(entries.value) },
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
      saveError.value = '作品数据已在其他地方变化，本次出厂照未保存。'
      return false
    }
    if (error instanceof AdminApiError && error.status === 400) {
      saveError.value = '出厂照内容未通过校验，请检查图片说明与主图设置。'
      return false
    }
    saveError.value = '保存出厂照失败，请稍后重试。'
    return false
  }
  finally {
    saving.value = false
  }
}

defineExpose({ save: savePhotos })
</script>

<template>
  <section id="studio-photos" class="editor-card" aria-labelledby="media-title">
    <div class="editor-card__head">
      <h2 id="media-title" class="editor-card__title">出厂照</h2>
      <p class="editor-card__hint">{{ entries.length }}/5</p>
    </div>

    <p v-if="locked" class="photo-section__locked" role="status">
      作品已发布，出厂照为只读；如需调整请先下架。
    </p>
    <p class="photo-section__resolution-note">
      低分辨率照片也可以上传和保存；发布时会用 FFmpeg Lanczos 生成私有适配源。放大不会恢复细节，完整原图会保留。
    </p>

    <ul v-if="entries.length > 0" class="photo-section__list" role="list">
      <li v-for="(entry, index) in entries" :key="entry.assetId">
        <AdminStudioPhotoCard
          :entry="entry"
          :index="index"
          :locked="locked"
          :processing="processingAssetId === entry.assetId"
          :total="entries.length"
          @move="moveEntry(index, $event)"
          @remove="removeEntry(index)"
          @retry-processing="retryEntryProcessing(entry)"
          @set-primary="setPrimary(index)"
          @update="updateEntry(index, $event)"
        />
      </li>
    </ul>

    <p v-else-if="uploads.items.value.length === 0" class="photo-section__empty">
      {{ emptyText }}
    </p>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      aria-label="选择出厂照文件"
      @change="onFileChange"
    >

    <div class="photo-section__uploader">
      <button
        type="button"
        class="editor__button editor__button--secondary"
        :disabled="locked || uploadSlotsFull || busyUploads > 0"
        @click="pickFile"
      >选择照片</button>
      <span class="photo-section__filename" aria-live="polite">
        {{ selectedFile?.name ?? '未选择照片' }}
      </span>
      <button
        type="button"
        class="editor__button editor__button--primary"
        :disabled="!selectedFile || locked || uploadSlotsFull || busyUploads > 0"
        @click="uploadSelectedFile"
      >{{ busyUploads > 0 ? '处理中…' : '上传出厂照' }}</button>
    </div>

    <ul v-if="uploads.items.value.length > 0" class="photo-section__uploads" role="list">
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

    <div v-if="isDirty" class="photo-section__actions">
      <button
        type="button"
        class="editor__button editor__button--primary"
        :disabled="saving || locked"
        @click="savePhotos"
      >{{ saving ? '保存中…' : '保存出厂照' }}</button>
      <button
        type="button"
        class="editor__button editor__button--secondary"
        :disabled="saving"
        @click="resetFromWork(work)"
      >放弃更改</button>
      <span v-if="isDirty" class="photo-section__dirty">出厂照有未保存更改</span>
    </div>
    <p v-if="uploadSlotsFull && !locked" class="photo-section__hint" role="status">
      每件作品最多 5 张出厂照；移除一张后再上传。
    </p>
    <p class="photo-section__hint">
      “移除”只解除与作品的关联，私有原图保留；保存后生效。
    </p>
    <p v-if="saveError" class="photo-section__error" role="alert">{{ saveError }}</p>
  </section>
</template>

<style scoped>
.photo-section__uploads,
.photo-section__list {
  list-style: none;
  margin: 0 0 var(--admin-space-3);
  padding: 0;
  display: grid;
  gap: var(--admin-space-3);
}

.photo-section__empty {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-5);
  border: 1px dashed var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
  text-align: center;
}

.photo-section__locked {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-info-soft);
  color: var(--admin-status-info);
  font-size: var(--admin-font-sm);
}

.photo-section__resolution-note {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-warning-soft);
  color: var(--admin-status-warning);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.photo-section__actions {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
  margin-top: var(--admin-space-3);
}

.photo-section__uploader {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  flex-wrap: wrap;
}

.photo-section__filename {
  min-width: 8rem;
  max-width: 24rem;
  overflow: hidden;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-section__dirty {
  font-size: var(--admin-font-xs);
  color: var(--admin-status-warning);
  font-weight: 600;
}

.photo-section__hint {
  margin: var(--admin-space-2) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.photo-section__error {
  margin: var(--admin-space-3) 0 0;
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
}
</style>

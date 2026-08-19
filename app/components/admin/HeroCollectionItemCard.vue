<script setup lang="ts">
import type {
  AdminHeroItemDto,
  HeroOrientation,
  HeroPlacement,
  PublicationOperationDto,
} from '~~/shared/types/contracts'
import type {
  HeroCollectionFeedback,
  HeroCollectionItemInput,
} from '~/composables/useAdminHeroCollection'
import { ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH } from '~~/shared/constants/admin-media-preview'
import { adminMediaPreviewUrl } from '~/utils/admin-media-preview'
import { PUBLICATION_OPERATION_STATUS_LABELS } from '~/utils/media-labels'
import { adminUploadProgressModel } from '~/utils/admin-upload-progress'

const props = withDefaults(defineProps<{
  canMoveDown?: boolean
  canMoveUp?: boolean
  collectionVersion: number
  defaultSortOrder?: number
  feedback?: HeroCollectionFeedback | null
  item: AdminHeroItemDto | null
  mutating: boolean
  operation?: PublicationOperationDto | null
  orientation: HeroOrientation
  placement: HeroPlacement
}>(), {
  canMoveDown: false,
  canMoveUp: false,
  defaultSortOrder: 0,
  feedback: null,
  operation: null,
})

const emit = defineEmits<{
  conflict: []
  create: [payload: HeroCollectionItemInput]
  delete: []
  disable: []
  enable: []
  move: [direction: -1 | 1]
  retryOperation: []
  upscale: []
  update: [payload: HeroCollectionItemInput]
}>()

const alt = ref('')
const assetId = ref('')
const sortOrder = ref(0)
const upscaleConfirmed = ref(false)
const selectedFile = shallowRef<File | null>(null)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
// 委托页大图不轮播：单张启用、无顺位概念。
const singleSlot = computed(() => props.placement === 'commission')
function sync() {
  alt.value = props.item?.alt ?? ''
  assetId.value = props.item?.asset.assetId ?? ''
  sortOrder.value = singleSlot.value
    ? 0
    : props.item?.sortOrder ?? props.defaultSortOrder
  upscaleConfirmed.value = false
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

watch(() => [props.item?.id, props.item?.version, props.defaultSortOrder], sync, {
  immediate: true,
})

const upload = useHeroAssetUpload({
  contextLabel: () => props.placement === 'home' ? '首页大图' : '委托页大图',
  getHomeVersion: () => props.collectionVersion,
  onAssetReady: (_slot, asset) => {
    assetId.value = asset.assetId
    selectedFile.value = null
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  },
  onConflict: () => emit('conflict'),
  placement: props.placement,
  slot: props.orientation,
})

const valid = computed(() => (
  alt.value.trim().length >= 1
  && alt.value.trim().length <= 500
  && assetId.value.length > 0
  && Number.isInteger(sortOrder.value)
  && sortOrder.value >= 0
  && sortOrder.value <= 4
))
const busy = computed(() => props.mutating || (
  props.operation ? isPublicationInProgress(props.operation) : false
))
const uploadProcessing = computed(() => [
  'digesting',
  'uploading',
  'validating',
].includes(upload.item.state))
const uploadProgress = computed(() => adminUploadProgressModel({
  failureText: upload.item.failureText,
  ffmpeg: upload.item.state === 'validating' && upload.item.ffmpegPreprocessExpected,
  label: `${props.orientation === 'landscape' ? '横版' : '竖版'}大图上传`,
  progress: upload.item.progress,
  stage: upload.item.state === 'completed' ? 'completed' : upload.item.state,
}))
const operationMode = computed(() => props.operation?.status === 'PREPARING_SOURCE'
  ? 'indeterminate' as const
  : 'stage' as const)
const operationStatus = computed(() => props.operation?.status === 'DONE'
  ? 'success' as const
  : props.operation?.status === 'FAILED'
    ? 'error' as const
    : 'active' as const)
const operationLabel = computed(() => {
  const operation = props.operation
  if (!operation) {
    return ''
  }
  if (operation.operationType === 'PUBLISH') {
    return operation.status === 'DONE' ? '已完成发布' : '发布并启用大图'
  }
  if (operation.operationType === 'UNPUBLISH') {
    return operation.status === 'DONE' ? '已完成停用' : '停用并撤销大图'
  }
  return operation.status === 'DONE' ? '已完成适配' : '适配大图尺寸'
})
const previewUrl = computed(() => assetId.value
  ? adminMediaPreviewUrl(assetId.value, ADMIN_MEDIA_EDITOR_PREVIEW_WIDTH)
  : null,
)

function submit() {
  if (!valid.value || busy.value) {
    return
  }
  const payload = {
    alt: alt.value.trim(),
    assetId: assetId.value,
    sortOrder: sortOrder.value,
  }
  if (props.item) {
    emit('update', payload)
  }
  else {
    emit('create', payload)
  }
}

function pickFile() {
  if (!fileInput.value || busy.value || props.item?.enabled || uploadProcessing.value) {
    return
  }
  fileInput.value.value = ''
  fileInput.value.click()
}

function onFile(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

function uploadSelectedFile() {
  if (selectedFile.value) {
    void upload.startUpload(selectedFile.value)
  }
}

function requestUpscale() {
  emit('upscale')
}

function requestEnable() {
  emit('enable')
}

function requestDisable() {
  emit('disable')
}
</script>

<template>
  <article
    class="hero-item"
    :data-alt="item?.alt ?? alt"
    :data-enabled="item?.enabled ?? false"
    data-testid="hero-collection-item"
  >
    <header class="hero-item__head">
      <div>
        <h3 class="hero-item__title">
          {{ item ? (singleSlot ? '当前大图' : `顺位 ${item.sortOrder}`) : '新大图项' }}
        </h3>
        <p v-if="item" class="hero-item__state">
          {{ item.enabled ? '已启用' : '已停用' }} · {{ item.asset.width }}×{{ item.asset.height }}
        </p>
      </div>
      <div v-if="item?.enabled && !singleSlot" class="hero-item__move" aria-label="调整顺序">
        <AdminAction size="small" :disabled="busy || !canMoveUp" @click="emit('move', -1)">上移</AdminAction>
        <AdminAction size="small" :disabled="busy || !canMoveDown" @click="emit('move', 1)">下移</AdminAction>
      </div>
    </header>

    <div class="hero-item__preview" :data-orientation="orientation">
      <img
        v-if="previewUrl"
        :src="previewUrl"
        :alt="`${alt || '大图'}管理预览`"
      >
      <p v-else>上传图片后将在这里显示低清管理预览。</p>
      <span class="hero-item__frame-label">
        {{ orientation === 'landscape' ? '桌面 16:9 画框' : '手机 9:16 画框' }}
      </span>
    </div>

    <div class="hero-item__fields">
      <label>
        <span>替代文字</span>
        <input v-model="alt" type="text" maxlength="500" :disabled="busy || item?.enabled">
      </label>
      <label v-if="!singleSlot">
        <span>顺位（0–4）</span>
        <input v-model.number="sortOrder" type="number" min="0" max="4" :disabled="busy || item?.enabled">
      </label>
      <div class="hero-item__upload">
        <span>{{ orientation === 'landscape' ? '横版' : '竖版' }}原图</span>
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          :aria-label="`${orientation === 'landscape' ? '横版' : '竖版'}原图`"
          :disabled="busy || item?.enabled || uploadProcessing"
          @change="onFile"
        >
        <div class="hero-item__upload-actions">
          <AdminAction
            size="small"
            :disabled="busy || item?.enabled || uploadProcessing"
            @click="pickFile"
          >选择图片</AdminAction>
          <span class="hero-item__filename">
            {{ selectedFile?.name ?? upload.item.fileName ?? '未选择图片' }}
          </span>
          <AdminAction
            variant="primary"
            size="small"
            :disabled="!selectedFile || busy || item?.enabled || uploadProcessing"
            :loading="uploadProcessing"
            loading-label="上传中…"
            @click="uploadSelectedFile"
          >上传图片</AdminAction>
        </div>
        <small>
          {{ orientation === 'landscape'
            ? '单张 JPEG、PNG 或 WebP；推荐至少 1920×1080。'
            : '单张 JPEG、PNG 或 WebP；推荐至少 1080×1920。' }}
        </small>
      </div>
    </div>

    <AdminTaskProgress
      v-if="upload.item.state !== 'idle'"
      v-bind="uploadProgress"
    />

    <label v-if="item && !item.enabled && !item.upscaleReady" class="hero-item__confirm">
      <input v-model="upscaleConfirmed" type="checkbox" :disabled="busy">
      <span>我已确认允许生成私有放大处理源，原图保留。</span>
    </label>

    <AdminTaskProgress
      v-if="operation"
      :mode="operationMode"
      :label="operationLabel"
      :stage="PUBLICATION_OPERATION_STATUS_LABELS[operation.status]"
      :status="operationStatus"
      :detail="feedback?.text ?? null"
      :show-elapsed="operationStatus === 'active'"
      :started-at="operation.startedAt"
      :can-retry="Boolean(feedback?.retryOperationId)"
      retry-label="重试长任务"
      @retry="emit('retryOperation')"
    />

    <div class="hero-item__actions">
      <AdminAction
        :disabled="busy || !valid || item?.enabled || Boolean(selectedFile) || uploadProcessing"
        @click="submit"
      >
        {{ item ? '保存' : '新增' }}
      </AdminAction>
      <AdminAction
        v-if="item && !item.enabled && !item.upscaleReady"
        :disabled="busy || !upscaleConfirmed"
        @click="requestUpscale"
      >适配大尺寸</AdminAction>
      <AdminAction
        v-if="item && !item.enabled && item.upscaleReady"
        variant="primary"
        :disabled="busy"
        @click="requestEnable"
      >发布并启用</AdminAction>
      <AdminAction
        v-if="item?.enabled"
        :disabled="busy"
        @click="requestDisable"
      >停用并撤销公开图</AdminAction>
      <AdminAction
        v-if="item && !item.enabled"
        variant="danger"
        :disabled="busy"
        @click="emit('delete')"
      >删除</AdminAction>
    </div>
  </article>
</template>

<style scoped>
.hero-item {
  display: grid;
  gap: var(--admin-space-3);
  padding: var(--admin-space-4);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.hero-item[data-enabled='true'] {
  border-color: var(--admin-accent-primary);
}

.hero-item__head,
.hero-item__actions,
.hero-item__move {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-2);
}

.hero-item__title,
.hero-item__state {
  margin: 0;
}

.hero-item__title {
  font-size: var(--admin-font-md);
}

.hero-item__state {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
}

.hero-item__preview {
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

.hero-item__preview[data-orientation='portrait'] {
  width: min(100%, 20rem);
  aspect-ratio: 9 / 16;
  border-width: 0.65rem;
  border-radius: 1.5rem;
}

.hero-item__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-item__frame-label {
  position: absolute;
  right: var(--admin-space-2);
  bottom: var(--admin-space-2);
  padding: var(--admin-space-1) var(--admin-space-2);
  color: var(--admin-text-inverse);
  background: rgb(25 31 42 / 0.72);
  border-radius: var(--admin-radius-sm);
  font-size: var(--admin-font-xs);
}

.hero-item__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7rem;
  gap: var(--admin-space-3);
}

.hero-item__upload {
  display: grid;
  gap: var(--admin-space-1);
  font-size: var(--admin-font-xs);
  font-weight: 600;
}

.hero-item__fields label {
  display: grid;
  gap: var(--admin-space-1);
  font-size: var(--admin-font-xs);
  font-weight: 600;
}

.hero-item__upload {
  grid-column: 1 / -1;
}

.hero-item__fields > label input {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  font: inherit;
}

.hero-item__upload-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--admin-space-2);
  padding: var(--admin-space-3);
  background: var(--admin-bg-subtle);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.hero-item__filename {
  min-width: 8rem;
  flex: 1;
  color: var(--admin-text-secondary);
  font-weight: 400;
  overflow-wrap: anywhere;
}

.hero-item__upload small {
  color: var(--admin-text-secondary);
  font-weight: 400;
}

.hero-item__confirm {
  display: flex;
  align-items: flex-start;
  gap: var(--admin-space-2);
  font-size: var(--admin-font-xs);
}

.hero-item__actions {
  justify-content: flex-start;
}

@media (max-width: 640px) {
  .hero-item__fields {
    grid-template-columns: 1fr;
  }

  .hero-item__upload {
    grid-column: auto;
  }
}
</style>

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
import { ADMIN_MEDIA_LARGE_PREVIEW_WIDTH } from '~~/shared/constants/admin-media-preview'
import { adminMediaPreviewUrl } from '~/utils/admin-media-preview'
import { PUBLICATION_OPERATION_STATUS_LABELS } from '~/utils/media-labels'
import { adminUploadProgressModel } from '~/utils/admin-upload-progress'
import HeroFocalPicker from '~/components/admin/HeroFocalPicker.vue'

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
  cancel: []
  create: [payload: HeroCollectionItemInput]
  delete: []
  disable: []
  enable: [payload: HeroCollectionItemInput]
  move: [direction: -1 | 1]
  retryOperation: []
  upscale: [payload: HeroCollectionItemInput]
  update: [payload: HeroCollectionItemInput]
}>()

const alt = ref('')
const assetId = ref('')
const assetVersion = ref(0)
const focalX = ref(0.5)
const focalY = ref(0.5)
const sortOrder = ref(0)
const displaySortOrder = computed({
  get: () => sortOrder.value + 1,
  set: (value: number) => { sortOrder.value = value - 1 },
})
const upscaleConfirmed = ref(false)
const selectedFile = shallowRef<File | null>(null)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
// 委托页大图不轮播：单张启用、无顺位概念。
const singleSlot = computed(() => props.placement === 'commission')
function sync() {
  alt.value = props.item?.alt ?? ''
  assetId.value = props.item?.asset.assetId ?? ''
  assetVersion.value = props.item?.asset.version ?? 0
  focalX.value = props.item?.asset.focalX ?? 0.5
  focalY.value = props.item?.asset.focalY ?? 0.5
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
    assetVersion.value = asset.version
    focalX.value = asset.focalX
    focalY.value = asset.focalY
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
  && assetVersion.value > 0
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
const canSubmit = computed(() => valid.value && !busy.value && !props.item?.enabled
  && !selectedFile.value && !uploadProcessing.value)
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
  ? adminMediaPreviewUrl(assetId.value, ADMIN_MEDIA_LARGE_PREVIEW_WIDTH)
  : null,
)

function itemInput(): HeroCollectionItemInput {
  return {
    alt: alt.value.trim(),
    assetId: assetId.value,
    assetVersion: assetVersion.value,
    focalX: focalX.value,
    focalY: focalY.value,
    sortOrder: sortOrder.value,
  }
}

function submit() {
  if (!canSubmit.value) {
    return
  }
  const payload = itemInput()
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
  if (canSubmit.value && upscaleConfirmed.value) emit('upscale', itemInput())
}

function requestEnable() {
  if (canSubmit.value) emit('enable', itemInput())
}

function requestDisable() {
  emit('disable')
}

function updateFocal(value: { focalX: number, focalY: number }) {
  focalX.value = value.focalX
  focalY.value = value.focalY
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
        <h2 class="hero-item__title">
          {{ item ? (singleSlot ? '封面图片' : `轮播图片 ${item.sortOrder + 1}`) : '新增图片' }}
        </h2>
        <div v-if="item" class="hero-item__state">
          <AdminStatusBadge :label="item.enabled ? '已启用' : '未启用'" :tone="item.enabled ? 'success' : 'neutral'" />
          <span>{{ item.asset.width }} × {{ item.asset.height }}</span>
        </div>
      </div>
      <div v-if="item?.enabled && !singleSlot" class="hero-item__move" aria-label="调整顺序">
        <AdminAction size="small" :disabled="busy || !canMoveUp" @click="emit('move', -1)">上移</AdminAction>
        <AdminAction size="small" :disabled="busy || !canMoveDown" @click="emit('move', 1)">下移</AdminAction>
      </div>
    </header>

    <HeroFocalPicker
      :preview-url="previewUrl"
      :alt="alt"
      :orientation="orientation"
      :focal-x="focalX"
      :focal-y="focalY"
      :disabled="busy || Boolean(item?.enabled) || !previewUrl"
      :readonly="Boolean(item?.enabled)"
      @update="updateFocal"
    >
      <div v-if="item?.enabled" class="hero-item__published">
        <h3>图片说明</h3>
        <p>{{ item.alt }}</p>
        <p class="hero-item__hint">停用后可更换图片、修改说明与焦点。</p>
      </div>

      <div v-if="!item?.enabled" class="hero-item__fields">
        <label>
          <span>替代文字</span>
          <input v-model="alt" type="text" maxlength="500" :disabled="busy || item?.enabled">
        </label>
        <label v-if="!singleSlot">
          <span>播放顺序（1–5）</span>
          <input v-model.number="displaySortOrder" type="number" min="1" max="5" :disabled="busy || item?.enabled">
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
              {{ selectedFile?.name ?? upload.item.fileName ?? (assetId ? '已上传原图' : '未选择图片') }}
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
        <AdminAction v-if="!item" :disabled="busy || uploadProcessing" @click="emit('cancel')">取消新增</AdminAction>
        <AdminAction
          v-if="!item?.enabled"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ item ? '保存' : '新增' }}
        </AdminAction>
        <AdminAction
          v-if="item && !item.enabled && !item.upscaleReady"
          :disabled="!canSubmit || !upscaleConfirmed"
          @click="requestUpscale"
        >适配大尺寸</AdminAction>
        <AdminAction
          v-if="item && !item.enabled && item.upscaleReady"
          variant="primary"
          :disabled="!canSubmit"
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
    </HeroFocalPicker>
  </article>
</template>

<style scoped>
.hero-item {
  display: grid;
  gap: var(--admin-space-3);
  padding: var(--admin-space-5);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
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
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  margin-top: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
}

.hero-item__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
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

.hero-item__fields > label input {
  min-height: var(--admin-control-height);
  min-width: 0;
  width: 100%;
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

.hero-item__actions { justify-content: flex-start; padding-top: var(--admin-space-3); border-top: 1px solid var(--admin-border-secondary); }
.hero-item__move :deep(.admin-action), .hero-item__upload-actions :deep(.admin-action) { min-height: var(--admin-touch-target); }
.hero-item__published { display: grid; gap: var(--admin-space-3); font-size: var(--admin-font-sm); overflow-wrap: anywhere; }
.hero-item__published h3, .hero-item__published p { margin: 0; }
.hero-item__hint { color: var(--admin-text-secondary); }

@media (max-width: 640px) {
  .hero-item { padding: var(--admin-space-4); }
}
</style>

<script setup lang="ts">
import type {
  AdminHeroItemDto,
  AdminHeroItemPreviewDto,
  HeroOrientation,
  HeroPlacement,
  PublicationOperationDto,
} from '~~/shared/types/contracts'
import type {
  HeroCollectionFeedback,
  HeroCollectionItemInput,
} from '~/composables/useAdminHeroCollection'

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
  preview?: AdminHeroItemPreviewDto | null
  previewPending?: boolean
}>(), {
  canMoveDown: false,
  canMoveUp: false,
  defaultSortOrder: 0,
  feedback: null,
  operation: null,
  preview: null,
  previewPending: false,
})

const emit = defineEmits<{
  conflict: []
  create: [payload: HeroCollectionItemInput]
  delete: []
  disable: []
  enable: []
  loadPreview: []
  move: [direction: -1 | 1]
  retryOperation: []
  upscale: []
  update: [payload: HeroCollectionItemInput]
}>()

const alt = ref('')
const assetId = ref('')
const sortOrder = ref(0)
const upscaleConfirmed = ref(false)

function sync() {
  alt.value = props.item?.alt ?? ''
  assetId.value = props.item?.asset.assetId ?? ''
  sortOrder.value = props.item?.sortOrder ?? props.defaultSortOrder
  upscaleConfirmed.value = false
}

watch(() => [props.item?.id, props.item?.version, props.defaultSortOrder], sync, {
  immediate: true,
})

const upload = useHeroAssetUpload({
  contextLabel: () => props.placement === 'home' ? '首页大图' : '委托页大图',
  getHomeVersion: () => props.collectionVersion,
  onAssetReady: (_slot, asset) => {
    assetId.value = asset.assetId
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

function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    void upload.startUpload(file)
  }
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
          {{ item ? `顺位 ${item.sortOrder}` : '新大图项' }}
        </h3>
        <p v-if="item" class="hero-item__state">
          {{ item.enabled ? '已启用' : '已停用' }} · {{ item.asset.width }}×{{ item.asset.height }}
        </p>
      </div>
      <div v-if="item?.enabled" class="hero-item__move" aria-label="调整顺序">
        <button type="button" :disabled="busy || !canMoveUp" @click="emit('move', -1)">上移</button>
        <button type="button" :disabled="busy || !canMoveDown" @click="emit('move', 1)">下移</button>
      </div>
    </header>

    <div class="hero-item__preview">
      <img
        v-if="preview"
        :src="preview.url"
        :alt="`${alt || '大图'}管理预览`"
        :width="preview.width"
        :height="preview.height"
      >
      <img
        v-else-if="upload.item.previewUrl"
        :src="upload.item.previewUrl"
        alt="本地待上传大图预览"
      >
      <p v-else>停用后可生成服务端预览。</p>
    </div>

    <div class="hero-item__fields">
      <label>
        <span>替代文字</span>
        <input v-model="alt" type="text" maxlength="500" :disabled="busy || item?.enabled">
      </label>
      <label>
        <span>顺位（0–4）</span>
        <input v-model.number="sortOrder" type="number" min="0" max="4" :disabled="busy || item?.enabled">
      </label>
      <label class="hero-item__upload">
        <span>{{ orientation === 'landscape' ? '横版' : '竖版' }}原图</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          :disabled="busy || item?.enabled"
          @change="onFile"
        >
      </label>
    </div>

    <p v-if="upload.item.state !== 'idle'" class="hero-item__upload-state" role="status">
      {{ upload.item.state === 'completed'
        ? '上传并校验完成，请保存。'
        : upload.item.failureText || `上传处理中：${upload.item.state}` }}
    </p>

    <label v-if="item && !item.enabled && !item.upscaleReady" class="hero-item__confirm">
      <input v-model="upscaleConfirmed" type="checkbox" :disabled="busy">
      <span>我已确认允许生成私有放大处理源，原图保留。</span>
    </label>

    <p
      v-if="feedback"
      class="hero-item__feedback"
      :data-tone="feedback.tone"
      role="status"
    >{{ feedback.text }}</p>

    <div class="hero-item__actions">
      <button type="button" :disabled="busy || !valid || item?.enabled" @click="submit">
        {{ item ? '保存' : '新增' }}
      </button>
      <button
        v-if="item && !item.enabled"
        type="button"
        :disabled="busy || previewPending"
        @click="emit('loadPreview')"
      >{{ previewPending ? '预览生成中…' : '生成预览' }}</button>
      <button
        v-if="item && !item.enabled && !item.upscaleReady"
        type="button"
        :disabled="busy || !upscaleConfirmed"
        @click="emit('upscale')"
      >适配大尺寸</button>
      <button
        v-if="item && !item.enabled && item.upscaleReady"
        type="button"
        class="hero-item__primary"
        :disabled="busy"
        @click="emit('enable')"
      >发布并启用</button>
      <button
        v-if="item?.enabled"
        type="button"
        :disabled="busy"
        @click="emit('disable')"
      >停用并撤销公开图</button>
      <button
        v-if="feedback?.retryOperationId"
        type="button"
        :disabled="busy"
        @click="emit('retryOperation')"
      >重试长任务</button>
      <button
        v-if="item && !item.enabled"
        type="button"
        class="hero-item__danger"
        :disabled="busy"
        @click="emit('delete')"
      >删除</button>
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

.hero-item__state,
.hero-item__upload-state,
.hero-item__feedback {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
}

.hero-item__preview {
  display: grid;
  min-height: 10rem;
  overflow: hidden;
  background: var(--admin-bg-subtle);
  border-radius: var(--admin-radius-sm);
  place-items: center;
}

.hero-item__preview img {
  width: 100%;
  max-height: 24rem;
  object-fit: contain;
}

.hero-item__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7rem;
  gap: var(--admin-space-3);
}

.hero-item__fields label,
.hero-item__upload {
  display: grid;
  gap: var(--admin-space-1);
  font-size: var(--admin-font-xs);
  font-weight: 600;
}

.hero-item__upload {
  grid-column: 1 / -1;
}

.hero-item__fields input {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  font: inherit;
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

.hero-item__actions button,
.hero-item__move button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  font: inherit;
  font-size: var(--admin-font-xs);
  cursor: pointer;
}

.hero-item__actions button:disabled,
.hero-item__move button:disabled {
  cursor: default;
  opacity: 0.5;
}

.hero-item__actions .hero-item__primary {
  color: var(--admin-text-inverse);
  background: var(--admin-accent-primary);
  border-color: var(--admin-accent-primary);
}

.hero-item__actions .hero-item__danger,
.hero-item__feedback[data-tone='error'] {
  color: var(--admin-danger);
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

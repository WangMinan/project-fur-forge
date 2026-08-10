<script setup lang="ts">
import type {
  AdminHeroPreviewDto,
  AdminHeroSlideDto,
  HeroPlacement,
  PublicationOperationDto,
  WorkListItemDto,
} from '~~/shared/types/contracts'
import type { HeroSlideInput, SlideFeedback } from '~/composables/useAdminHome'
import { PUBLICATION_STATUS_LABELS } from '~/utils/work-labels'

// T20 首页轮播项卡片：slide 为 null 时是新建草稿。已启用项的字段整体锁定
// （服务端拒绝编辑启用项），只能停用/预览/排序；启用为异步发布操作。
const props = defineProps<{
  canMoveDown?: boolean
  canMoveUp?: boolean
  defaultSortOrder?: number
  feedback?: SlideFeedback | null
  ffmpegPending?: boolean
  homeVersion: number | null
  mutating: boolean
  operation?: PublicationOperationDto | null
  placement: HeroPlacement
  preview?: AdminHeroPreviewDto | null
  previewPending?: boolean
  slide: AdminHeroSlideDto | null
  works: WorkListItemDto[]
}>()

const emit = defineEmits<{
  conflict: []
  create: [payload: HeroSlideInput]
  delete: []
  disable: []
  enable: [allowUpscale: boolean]
  loadPreview: []
  move: [direction: -1 | 1]
  /** 已启用项直接保存顺位：把这一项移到目标顺位。 */
  reorderTo: [sortOrder: number]
  retryOperation: []
  save: [payload: HeroSlideInput]
}>()

const alt = ref(props.slide?.alt ?? '')
const sortOrder = ref(props.slide?.sortOrder ?? props.defaultSortOrder ?? 0)
const linkedWorkId = ref<string | null>(props.slide?.linkedWork?.id ?? null)
const landscapeAssetId = ref<string | null>(null)
const portraitAssetId = ref<string | null>(null)
const confirmDelete = ref(false)
const confirmUpscale = shallowRef(false)
const itemLabel = computed(() => props.placement === 'home' ? '轮播项' : '大图项')
const pageLabel = computed(() => props.placement === 'home' ? '首页' : '委托页')

function snapshotOf() {
  return JSON.stringify({
    alt: alt.value,
    sortOrder: sortOrder.value,
    linkedWorkId: linkedWorkId.value,
    landscapeAssetId: landscapeAssetId.value,
    portraitAssetId: portraitAssetId.value,
  })
}

const baseline = ref(snapshotOf())

function syncFromSlide(slide: AdminHeroSlideDto | null) {
  alt.value = slide?.alt ?? ''
  sortOrder.value = slide?.sortOrder ?? props.defaultSortOrder ?? 0
  linkedWorkId.value = slide?.linkedWork?.id ?? null
  landscapeAssetId.value = null
  portraitAssetId.value = null
  baseline.value = snapshotOf()
}

const isDirty = computed(() => snapshotOf() !== baseline.value)
/** 已启用：内容（alt / 图片 / 关联作品）只读，顺位仍可直接改。 */
const locked = computed(() => props.slide?.enabled === true)

/** 已启用时只有顺位可改，因此单独判断“只改了顺位”。 */
const orderOnlyDirty = computed(() => (
  locked.value && sortOrder.value !== props.slide?.sortOrder
))

watch(() => props.slide, (slide) => {
  if (!isDirty.value) {
    syncFromSlide(slide)
  }
  else {
    // 表单有未保存修改时只更新基线中的资产引用，避免覆盖输入。
    baseline.value = JSON.stringify({
      alt: slide?.alt ?? '',
      sortOrder: slide?.sortOrder ?? props.defaultSortOrder ?? 0,
      linkedWorkId: slide?.linkedWork?.id ?? null,
      landscapeAssetId: null,
      portraitAssetId: null,
    })
  }
})

const effectiveLandscapeId = computed(() =>
  landscapeAssetId.value ?? props.slide?.landscape.assetId ?? null,
)
const effectivePortraitId = computed(() =>
  portraitAssetId.value ?? props.slide?.portrait.assetId ?? null,
)

const altValid = computed(() => alt.value.trim().length >= 1 && alt.value.trim().length <= 500)
const sortOrderValid = computed(() =>
  Number.isInteger(sortOrder.value) && sortOrder.value >= 0 && sortOrder.value <= 9_999,
)
const pairReady = computed(() => effectiveLandscapeId.value !== null && effectivePortraitId.value !== null)
const lowResolutionSources = computed(() => {
  if (!props.slide) {
    return []
  }
  return [
    props.slide.landscape.width < 1920 || props.slide.landscape.height < 1080
      ? `横版 ${props.slide.landscape.width}×${props.slide.landscape.height}（推荐 1920×1080）`
      : null,
    props.slide.portrait.width < 1080 || props.slide.portrait.height < 1920
      ? `竖版 ${props.slide.portrait.width}×${props.slide.portrait.height}（推荐 1080×1920）`
      : null,
  ].filter((value): value is string => value !== null)
})
const requiresUpscale = computed(() => lowResolutionSources.value.length > 0)

const canSubmit = computed(() => {
  if (props.mutating || !sortOrderValid.value) {
    return false
  }
  // 已启用项只允许保存顺位：调整首页顺序不该要求先下架。
  if (locked.value) {
    return orderOnlyDirty.value
  }
  if (!altValid.value || !pairReady.value) {
    return false
  }
  return props.slide === null ? true : isDirty.value
})

const FFMPEG_UPSCALE_LABEL = '正在用 FFmpeg 放大适配（Lanczos 插值）…'
const OPERATION_PROGRESS_LABELS: Record<string, string> = {
  PREPARING_SOURCE: FFMPEG_UPSCALE_LABEL,
  GENERATING_PUBLIC: '正在生成公开图片…',
  APPLYING_WATERMARK: '正在烘焙活动水印…',
  VERIFYING_PUBLIC: '正在校验公开图片…',
  COMMITTING: '正在提交启用…',
  CLEANING_PUBLIC: '正在清理公开文件…',
}

const operationProgress = computed(() => {
  if (props.operation?.operationType === 'UNPUBLISH') {
    if (props.operation.status === 'COMMITTING') {
      return '正在从页面隐藏该大图…'
    }
    if (props.operation.status === 'CLEANING_PUBLIC') {
      return props.operation.edgePurgeStatus === 'PURGING'
        ? '页面已隐藏，正在撤销 ESA 缓存…'
        : '页面已隐藏，正在删除公开文件…'
    }
  }
  const status = props.operation?.status
  return status ? OPERATION_PROGRESS_LABELS[status] ?? null : null
})

const readyVariantCount = computed(() =>
  props.slide ? 12 - props.slide.missingVariantCount : 0,
)

const linkedWorkOptions = computed(() => props.works)

function payload(): HeroSlideInput {
  return {
    alt: alt.value.trim(),
    sortOrder: sortOrder.value,
    landscapeAssetId: effectiveLandscapeId.value!,
    portraitAssetId: effectivePortraitId.value!,
    linkedWorkId: linkedWorkId.value,
  }
}

function submit() {
  if (!canSubmit.value) {
    return
  }
  if (props.slide === null) {
    emit('create', payload())
  }
  else if (locked.value) {
    // 已启用项走顺位专用通道：整体重排已启用序列，不改内容。
    emit('reorderTo', sortOrder.value)
  }
  else {
    emit('save', payload())
  }
}

function onSortOrderInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  sortOrder.value = Number.isFinite(value) ? Math.trunc(value) : 0
}

function onLinkedWorkChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  linkedWorkId.value = value === '' ? null : value
}

function requestEnable() {
  if (requiresUpscale.value && !props.slide?.upscaleReady) {
    confirmUpscale.value = true
    return
  }
  emit('enable', false)
}
</script>

<template>
  <article
    class="slide-card"
    :data-enabled="slide?.enabled ? 'true' : 'false'"
    :data-testid="slide ? `home-slide-${slide.id}` : 'home-slide-draft'"
  >
    <header class="slide-card__head">
      <h3 class="slide-card__title">
        {{ slide ? `${itemLabel} · 顺位 ${slide.sortOrder}` : `新增${itemLabel}` }}
      </h3>
      <AdminStatusBadge
        v-if="slide"
        :tone="slide.enabled ? 'success' : 'neutral'"
        :label="slide.enabled ? '已启用' : '未启用'"
      />
      <span v-if="slide && slide.missingVariantCount > 0 && !slide.enabled" class="slide-card__variants">
        启用时将生成 {{ slide.missingVariantCount }} 张带水印公开衍生图
      </span>
    </header>

    <p v-if="locked" class="slide-card__locked-hint">
      已启用：顺位可以直接改，图片与文字需先停用。
    </p>

    <p v-if="requiresUpscale" class="slide-card__upscale-warning" role="status">
      {{ lowResolutionSources.join('；') }}。{{ slide?.upscaleReady
        ? '已生成私有适配源；原图仍保留，放大不会恢复原图细节。'
        : '启用前需要确认放大适配；插值只补足尺寸，不会恢复原图细节。' }}
    </p>

    <div class="slide-card__grid">
      <AdminHomeHeroSlotField
        orientation="landscape"
        :placement="placement"
        :saved-asset="slide?.landscape ?? null"
        :unsaved-asset-id="landscapeAssetId"
        :disabled="locked || mutating"
        :home-version="homeVersion"
        @uploaded="asset => (landscapeAssetId = asset.assetId)"
        @conflict="emit('conflict')"
      />
      <AdminHomeHeroSlotField
        orientation="portrait"
        :placement="placement"
        :saved-asset="slide?.portrait ?? null"
        :unsaved-asset-id="portraitAssetId"
        :disabled="locked || mutating"
        :home-version="homeVersion"
        @uploaded="asset => (portraitAssetId = asset.assetId)"
        @conflict="emit('conflict')"
      />

      <div class="slide-card__fields">
        <div class="slide-card__field">
          <label class="slide-card__label" :for="`hero-alt-${slide?.id ?? 'draft'}`">
            图片说明（alt）<span aria-hidden="true"> *</span>
          </label>
          <input
            :id="`hero-alt-${slide?.id ?? 'draft'}`"
            v-model="alt"
            class="slide-card__input"
            type="text"
            maxlength="500"
            :disabled="locked || mutating"
            :placeholder="`例如：蓝湄的${pageLabel}展示照`"
          >
        </div>

        <div class="slide-card__field">
          <label class="slide-card__label" :for="`hero-order-${slide?.id ?? 'draft'}`">
            顺位（0–4 可启用，不可重复）
          </label>
          <input
            :id="`hero-order-${slide?.id ?? 'draft'}`"
            class="slide-card__input slide-card__input--narrow"
            type="number"
            min="0"
            max="9999"
            step="1"
            :value="sortOrder"
            :disabled="mutating"
            @input="onSortOrderInput"
          >
        </div>

        <div class="slide-card__field">
          <label class="slide-card__label" :for="`hero-link-${slide?.id ?? 'draft'}`">
            关联作品（可选，仅已发布作品可关联）
          </label>
          <select
            :id="`hero-link-${slide?.id ?? 'draft'}`"
            class="slide-card__input"
            :value="linkedWorkId ?? ''"
            :disabled="locked || mutating"
            @change="onLinkedWorkChange"
          >
            <option value="">不关联作品</option>
            <option
              v-for="work in linkedWorkOptions"
              :key="work.id"
              :value="work.id"
              :disabled="work.publicationStatus !== 'published'"
            >
              {{ work.characterName }}（{{ work.slug }}）· {{ PUBLICATION_STATUS_LABELS[work.publicationStatus] }}
            </option>
          </select>
        </div>
        <p v-if="slide?.linkedWork && slide.linkedWork.publicationStatus !== 'published'" class="slide-card__link-warning" role="alert">
          关联作品当前未发布，启用会被服务端阻断；请先重新发布该作品或改用其他作品。
        </p>
      </div>
    </div>

    <div class="slide-card__actions">
      <button
        type="button"
        class="slide-card__action slide-card__action--primary"
        :disabled="!canSubmit"
        @click="submit"
      >{{ !slide
        ? (mutating ? '创建中…' : `创建${itemLabel}`)
        : locked
          ? (mutating ? '保存中…' : '保存顺位')
          : (mutating ? '保存中…' : '保存修改') }}</button>

      <template v-if="slide">
        <button
          v-if="!slide.enabled"
          type="button"
          class="slide-card__action"
          :disabled="mutating || operationProgress !== null"
          @click="requestEnable"
        >{{ operationProgress ? '启用中…' : '启用' }}</button>
        <button
          v-else
          type="button"
          class="slide-card__action"
          :disabled="mutating || operationProgress !== null"
          @click="emit('disable')"
        >{{ operation?.operationType === 'UNPUBLISH' && operationProgress ? '停用中…' : '停用' }}</button>

        <button
          v-if="slide.enabled"
          type="button"
          class="slide-card__action"
          :disabled="mutating || !canMoveUp"
          :aria-label="`上移${itemLabel}（当前顺位 ${slide.sortOrder}）`"
          @click="emit('move', -1)"
        >上移</button>
        <button
          v-if="slide.enabled"
          type="button"
          class="slide-card__action"
          :disabled="mutating || !canMoveDown"
          :aria-label="`下移${itemLabel}（当前顺位 ${slide.sortOrder}）`"
          @click="emit('move', 1)"
        >下移</button>

        <button
          v-if="!slide.enabled"
          type="button"
          class="slide-card__action"
          :disabled="mutating || previewPending"
          @click="emit('loadPreview')"
        >{{ previewPending ? '生成预览中…' : '活动水印预览' }}</button>
        <span v-else class="slide-card__active-preview-note">
          当前公开图已使用活动水印
        </span>

        <button
          v-if="!slide.enabled"
          type="button"
          class="slide-card__action slide-card__action--danger"
          :disabled="mutating"
          @click="confirmDelete = true"
        >删除</button>
      </template>
    </div>

    <div v-if="operationProgress || ffmpegPending" class="slide-card__progress">
      <AdminFfmpegProgress
        v-if="ffmpegPending || operation?.operationType === 'UPSCALE'"
        :label="operationProgress ?? FFMPEG_UPSCALE_LABEL"
      />
      <div v-else role="status">
        <p>{{ operationProgress }}<template v-if="operation?.operationType === 'PUBLISH'"> 当前活动 profile 已就绪 {{ readyVariantCount }} / 12</template></p>
        <progress
          v-if="operation?.operationType === 'PUBLISH'"
          :value="readyVariantCount"
          max="12"
          :aria-label="`${pageLabel}公开衍生图已就绪 ${readyVariantCount} / 12`"
        />
        <progress
          v-else
          :aria-label="`${pageLabel}大图正在停用并撤销 ESA 缓存`"
        />
      </div>
    </div>

    <div
      v-if="feedback"
      class="slide-card__feedback"
      :data-tone="feedback.tone"
      :role="feedback.tone === 'error' ? 'alert' : 'status'"
    >
      <p class="slide-card__feedback-text">
        {{ feedback.text }}
      </p>
      <button
        v-if="feedback.retryOperationId"
        type="button"
        class="slide-card__action"
        :disabled="mutating"
        @click="emit('retryOperation')"
      >{{ operation?.operationType === 'UPSCALE'
        ? '重试适配'
        : operation?.operationType === 'UNPUBLISH'
          ? '重试撤销'
          : '重试启用' }}</button>
    </div>

    <div v-if="preview" class="slide-card__preview" data-testid="hero-watermark-preview">
      <p class="slide-card__preview-note">
        活动居中水印真实预览（同源私有预览，5 分钟内有效）
      </p>
      <div class="slide-card__preview-grid">
        <img
          :src="preview.landscape.url"
          :alt="`${alt || `${pageLabel}图`}横版水印预览`"
          class="slide-card__preview-image slide-card__preview-image--landscape"
          referrerpolicy="no-referrer"
        >
        <img
          :src="preview.portrait.url"
          :alt="`${alt || `${pageLabel}图`}竖版水印预览`"
          class="slide-card__preview-image slide-card__preview-image--portrait"
          referrerpolicy="no-referrer"
        >
      </div>
    </div>

    <AdminConfirmDialog
      :open="confirmUpscale"
      title="确认放大适配这组图片？"
      confirm-label="确认并继续启用"
      @confirm="confirmUpscale = false; emit('enable', true)"
      @cancel="confirmUpscale = false"
    >
      <p>{{ lowResolutionSources.join('；') }}。</p>
      <p>服务端会用 FFmpeg Lanczos 插值生成私有适配源，再继续水印与公开图片流程。放大不会恢复原图不存在的细节，永久原图会保留不变。</p>
    </AdminConfirmDialog>

    <AdminConfirmDialog
      :open="confirmDelete"
      :title="`删除该${itemLabel}？`"
      confirm-label="确认删除"
      tone="danger"
      @confirm="confirmDelete = false; emit('delete')"
      @cancel="confirmDelete = false"
    >
      <p>删除后该{{ itemLabel }}的横竖槽位关联会被移除；已上传的私有原图保留在私有库中。</p>
    </AdminConfirmDialog>
  </article>
</template>

<style scoped>
.slide-card {
  display: grid;
  gap: var(--admin-space-3);
  padding: var(--admin-space-4);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.slide-card[data-enabled='true'] {
  border-color: var(--admin-accent-tint);
}

.slide-card__head {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
}

.slide-card__title {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.slide-card__variants {
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.slide-card__locked-hint {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.slide-card__upscale-warning {
  margin: 0;
  padding: var(--admin-space-3);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-status-warning-soft);
  color: var(--admin-status-warning);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.slide-card__grid {
  display: grid;
  gap: var(--admin-space-4);
}

@media (min-width: 768px) {
  .slide-card__grid {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 2fr);
    align-items: start;
  }
}

.slide-card__fields {
  display: grid;
  gap: var(--admin-space-3);
  align-content: start;
  min-width: 0;
}

.slide-card__label {
  display: block;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  margin-bottom: var(--admin-space-1);
}

.slide-card__input {
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

.slide-card__input--narrow {
  max-width: 8rem;
}

.slide-card__link-warning {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-warning);
}

.slide-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--admin-space-2);
}

.slide-card__action {
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

.slide-card__action:hover:not(:disabled) {
  background: var(--admin-bg-subtle);
}

.slide-card__action:disabled {
  opacity: 0.55;
  cursor: default;
}

.slide-card__action--primary {
  background: var(--admin-accent-primary);
  border-color: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font-weight: 600;
}

.slide-card__action--primary:hover:not(:disabled) {
  background: var(--admin-accent-primary);
  filter: brightness(1.05);
}

.slide-card__action--danger {
  color: var(--admin-danger);
  border-color: var(--admin-danger);
}

.slide-card__active-preview-note {
  align-self: center;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.slide-card__progress {
  display: grid;
  gap: var(--admin-space-2);
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.slide-card__progress progress {
  width: min(100%, 28rem);
}

.slide-card__feedback {
  padding: var(--admin-space-3);
  border-radius: var(--admin-radius-md);
  display: grid;
  gap: var(--admin-space-2);
  justify-items: start;
}

.slide-card__feedback[data-tone='success'] {
  background: var(--admin-status-success-soft);
  color: var(--admin-status-success);
}

.slide-card__feedback[data-tone='error'] {
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
}

.slide-card__feedback-text {
  margin: 0;
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.slide-card__preview {
  display: grid;
  gap: var(--admin-space-2);
}

.slide-card__preview-note {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.slide-card__preview-grid {
  display: flex;
  gap: var(--admin-space-3);
  align-items: flex-start;
  flex-wrap: wrap;
}

.slide-card__preview-image {
  display: block;
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-subtle);
}

.slide-card__preview-image--landscape {
  width: min(100%, 24rem);
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.slide-card__preview-image--portrait {
  width: 9rem;
  aspect-ratio: 9 / 16;
  object-fit: cover;
}
</style>

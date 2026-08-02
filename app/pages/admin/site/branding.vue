<script setup lang="ts">
import type { WatermarkCandidateDto } from '~~/shared/types/contracts'
import {
  WATERMARK_DEFAULT_OPACITY,
  WATERMARK_DEFAULT_SCALE,
} from '~~/shared/schemas/watermark'
import {
  formatWatermarkDateTime,
  WATERMARK_PROFILE_STATUS_LABELS,
  WATERMARK_PROFILE_STATUS_TONES,
} from '~/utils/watermark-labels'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '全局水印',
  robots: 'noindex, nofollow',
})

const {
  branding,
  conflictNotice,
  createDraft,
  load,
  mutating,
  operation,
  pageStatus,
  refreshBranding,
  retryOperation,
  runProfileMutation,
} = useWatermarkBranding()

const selectedAssetId = ref<string | null>(null)
const opacityPercent = ref(WATERMARK_DEFAULT_OPACITY)
const scalePercent = ref(WATERMARK_DEFAULT_SCALE)
// 基线与初始表单一致：首次载入 branding 时不误判 dirty，确保从草稿/活动配置同步。
const baseline = ref('')
const draftError = ref<string | null>(null)
const previewError = ref<string | null>(null)
const applyError = ref<string | null>(null)

function snapshotOf() {
  return JSON.stringify({
    opacity: opacityPercent.value,
    scale: scalePercent.value,
    source: selectedAssetId.value,
  })
}
baseline.value = snapshotOf()

function syncFromBranding(value: NonNullable<typeof branding.value>) {
  const reference = value.draftProfile ?? value.activeProfile
  selectedAssetId.value = reference?.sourceAssetId
    ?? value.candidates[0]?.assetId
    ?? null
  opacityPercent.value = reference?.opacityPercent ?? WATERMARK_DEFAULT_OPACITY
  scalePercent.value = reference?.scalePercent ?? WATERMARK_DEFAULT_SCALE
  baseline.value = snapshotOf()
}

const isDirty = computed(() =>
  branding.value !== null && snapshotOf() !== baseline.value,
)

watch(branding, (value) => {
  if (value && !isDirty.value) {
    syncFromBranding(value)
  }
  else if (value) {
    baseline.value = JSON.stringify({
      opacity: value.draftProfile?.opacityPercent
        ?? value.activeProfile?.opacityPercent
        ?? WATERMARK_DEFAULT_OPACITY,
      scale: value.draftProfile?.scalePercent
        ?? value.activeProfile?.scalePercent
        ?? WATERMARK_DEFAULT_SCALE,
      source: value.draftProfile?.sourceAssetId
        ?? value.activeProfile?.sourceAssetId
        ?? null,
    })
  }
})

const activeCandidate = computed<WatermarkCandidateDto | null>(() => {
  const value = branding.value
  if (!value?.activeProfile) {
    return null
  }
  return value.candidates.find(
    candidate => candidate.assetId === value.activeProfile!.sourceAssetId,
  ) ?? null
})

const previewReady = computed(() => {
  const current = operation.value
  const draft = branding.value?.draftProfile
  return !!(
    current
    && draft
    && current.operationType === 'WATERMARK_PREVIEW'
    && current.status === 'DONE'
    && current.profileId === draft.id
  )
})

const upload = useWatermarkLogoUpload({
  async onCompleted(assetId) {
    await refreshBranding()
    selectedAssetId.value = assetId
  },
  async onConflict() {
    conflictNotice.value = '站点品牌数据已在其他地方变化，已重新加载。'
    await refreshBranding()
  },
})

function onSelectCandidate(assetId: string) {
  selectedAssetId.value = assetId
}

async function onSaveDraft() {
  if (!selectedAssetId.value) {
    draftError.value = '请先选择一个 Logo 候选。'
    return
  }
  draftError.value = null
  draftError.value = await createDraft({
    opacityPercent: opacityPercent.value,
    scalePercent: scalePercent.value,
    sourceAssetId: selectedAssetId.value,
  })
}

async function onGeneratePreview() {
  previewError.value = null
  previewError.value = await runProfileMutation('preview')
}

async function onApply() {
  applyError.value = null
  applyError.value = await runProfileMutation('apply')
}

async function onRetry() {
  applyError.value = null
  previewError.value = null
  const message = await retryOperation()
  if (message) {
    if (operation.value?.operationType === 'WATERMARK_PREVIEW') {
      previewError.value = message
    }
    else {
      applyError.value = message
    }
  }
}

onMounted(() => {
  void load({ initial: true })
})
</script>

<template>
  <AdminShell current="branding">
    <div v-if="pageStatus === 'loading'" class="editor-state" role="status">
      正在加载站点品牌配置…
    </div>

    <div v-else-if="pageStatus === 'error'" class="editor-state editor-state--missing">
      <p class="editor-state__title" role="alert">站点品牌配置加载失败</p>
      <p class="editor-state__text">请检查网络连接后重试。</p>
      <button type="button" class="editor-state__retry" @click="load()">重试</button>
    </div>

    <div v-else-if="branding" class="branding">
      <header class="branding__header">
        <h1 class="branding__title">全局水印</h1>
        <p class="branding__subtitle">
          全站公开图的居中水印配置；Logo 与参数变更会生成新的草稿，应用后原子切换。
        </p>
      </header>

      <p v-if="conflictNotice" class="branding__notice branding__notice--warning" role="alert">
        {{ conflictNotice }}
      </p>

      <section class="editor-card branding-active" aria-labelledby="branding-active-title">
        <div class="editor-card__head">
          <h2 id="branding-active-title" class="editor-card__title">当前活动水印</h2>
          <AdminStatusBadge
            v-if="branding.activeProfile"
            :tone="WATERMARK_PROFILE_STATUS_TONES[branding.activeProfile.status]"
            :label="WATERMARK_PROFILE_STATUS_LABELS[branding.activeProfile.status]"
          />
        </div>
        <div v-if="branding.activeProfile" class="branding-active__body">
          <span class="branding-active__thumb-frame">
            <img
              v-if="activeCandidate"
              :src="activeCandidate.previewUrl"
              alt="当前水印 Logo 候选缩略图"
              class="branding-active__thumb"
              referrerpolicy="no-referrer"
            >
          </span>
          <dl class="branding-active__facts">
            <div class="branding-active__fact">
              <dt>配置</dt>
              <dd>{{ branding.activeProfile.profileName }}</dd>
            </div>
            <div class="branding-active__fact">
              <dt>位置</dt>
              <dd>居中</dd>
            </div>
            <div class="branding-active__fact">
              <dt>不透明度</dt>
              <dd>{{ branding.activeProfile.opacityPercent }}%</dd>
            </div>
            <div class="branding-active__fact">
              <dt>缩放</dt>
              <dd>{{ branding.activeProfile.scalePercent }}%</dd>
            </div>
            <div class="branding-active__fact">
              <dt>活动时间</dt>
              <dd>{{ formatWatermarkDateTime(branding.activeProfile.updatedAt) }}</dd>
            </div>
          </dl>
        </div>
        <p v-else class="branding-active__empty" role="status">
          当前没有活动水印配置；公开图发布检查要求先完成一次应用。
        </p>
        <p
          v-if="branding.draftProfile"
          class="branding-active__draft"
          role="status"
        >
          草稿：{{ branding.draftProfile.profileName }} · 居中 ·
          不透明度 {{ branding.draftProfile.opacityPercent }}% ·
          缩放 {{ branding.draftProfile.scalePercent }}%
          <AdminStatusBadge
            :tone="WATERMARK_PROFILE_STATUS_TONES[branding.draftProfile.status]"
            :label="WATERMARK_PROFILE_STATUS_LABELS[branding.draftProfile.status]"
          />
        </p>
      </section>

      <div class="branding__grid">
        <AdminBrandingCandidatesCard
          :branding-version="branding.version"
          :candidates="branding.candidates"
          :disabled="mutating"
          :selected-asset-id="selectedAssetId"
          :upload="upload"
          @select="onSelectCandidate"
        />

        <AdminBrandingParamsCard
          v-model:opacity-percent="opacityPercent"
          v-model:scale-percent="scalePercent"
          :disabled="mutating"
          :dirty="isDirty"
          :saving="mutating"
          :server-error="draftError"
          @save="onSaveDraft"
        />

        <AdminBrandingPreviewCard
          :draft="branding.draftProfile"
          :mutating="mutating"
          :operation="operation"
          @generate="onGeneratePreview"
          @retry="onRetry"
        />
      </div>

      <p v-if="previewError" class="branding__notice branding__notice--error" role="alert">
        {{ previewError }}
      </p>
      <p v-if="applyError" class="branding__notice branding__notice--error" role="alert">
        {{ applyError }}
      </p>

      <AdminBrandingApplyCard
        :branding="branding"
        :mutating="mutating"
        :operation="operation"
        :preview-ready="previewReady"
        @apply="onApply"
        @retry="onRetry"
      />
    </div>
  </AdminShell>
</template>

<style scoped>
.editor-state {
  max-width: var(--admin-reading-max);
  margin: var(--admin-space-8) auto;
  text-align: center;
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-8);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.editor-state--missing {
  border-style: dashed;
}

.editor-state__title {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
  color: var(--admin-text-primary);
}

.editor-state__text {
  margin: var(--admin-space-2) 0 var(--admin-space-4);
}

.editor-state__retry {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-accent-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.branding {
  max-width: var(--admin-content-max);
  display: grid;
  gap: var(--admin-space-5);
}

.branding__header {
  display: grid;
  gap: var(--admin-space-1);
}

.branding__title {
  margin: 0;
  font-size: var(--admin-font-lg);
  font-weight: 600;
}

.branding__subtitle {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.branding__notice {
  margin: 0;
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  font-size: var(--admin-font-sm);
}

.branding__notice--warning {
  background: var(--admin-status-warning-soft);
  color: var(--admin-status-warning);
}

.branding__notice--error {
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
}

.branding-active__body {
  display: flex;
  align-items: center;
  gap: var(--admin-space-4);
  flex-wrap: wrap;
}

.branding-active__thumb-frame {
  width: 5rem;
  height: 5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--admin-radius-md);
  background:
    repeating-conic-gradient(var(--admin-bg-subtle) 0% 25%, var(--admin-bg-primary) 0% 50%)
    0 0 / 1rem 1rem;
  border: 1px solid var(--admin-border-secondary);
  overflow: hidden;
  flex-shrink: 0;
}

.branding-active__thumb {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.branding-active__facts {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--admin-space-2) var(--admin-space-5);
}

.branding-active__fact {
  display: grid;
  gap: 0;
  font-size: var(--admin-font-sm);
}

.branding-active__fact dt {
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
}

.branding-active__fact dd {
  margin: 0;
  font-weight: 600;
}

.branding-active__empty {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-status-warning);
}

.branding-active__draft {
  margin: var(--admin-space-3) 0 0;
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.branding__grid {
  display: grid;
  gap: var(--admin-space-5);
  align-items: start;
}

@media (min-width: 1280px) {
  .branding__grid {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.2fr);
  }
}
</style>

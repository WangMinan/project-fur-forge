<script setup lang="ts">
import type {
  WatermarkBrandingDto,
  WatermarkOperationDto,
} from '~~/shared/types/contracts'
import {
  WATERMARK_OPERATION_STATUS_LABELS,
  WATERMARK_OPERATION_TYPE_LABELS,
  watermarkFailureHint,
} from '~/utils/watermark-labels'

// 应用与进度：显式确认后启动；进度用 role=status 持续播报，不用短暂 Toast；
// 失败持续展示并可重试；始终标明当前公开站使用的活动配置。
const props = defineProps<{
  branding: WatermarkBrandingDto
  changed: boolean
  mutating: boolean
  operation: WatermarkOperationDto | null
  opacityPercent: number
  scalePercent: number
  settingsValid: boolean
  sourceReady: boolean
}>()

const emit = defineEmits<{
  apply: []
  retry: []
}>()

const confirmOpen = ref(false)

const operationBusy = computed(() => {
  const status = props.operation?.status
  return status === 'GENERATING_PUBLIC'
    || status === 'VERIFYING_PUBLIC'
    || status === 'SWITCHING_PROFILE'
    || status === 'CLEANING_PUBLIC'
})

const rebuildOperation = computed(() =>
  props.operation?.operationType === 'WATERMARK_REBUILD'
    ? props.operation
    : null,
)

const progressMax = computed(() =>
  Math.max((rebuildOperation.value?.targetVariantCount ?? 0) * 2, 1),
)

const progressValue = computed(() => {
  const current = rebuildOperation.value
  if (!current || current.targetVariantCount === 0) {
    return undefined
  }
  return Math.min(current.generatedVariantCount, current.targetVariantCount)
    + Math.min(current.verifiedVariantCount, current.targetVariantCount)
})

const progressPercent = computed(() => progressValue.value === undefined
  ? null
  : Math.round(progressValue.value / progressMax.value * 100),
)

const canApply = computed(() =>
  props.sourceReady
  && props.settingsValid
  && props.changed
  && !props.mutating
  && !operationBusy.value
)

const applyBlockReason = computed(() => {
  if (!props.sourceReady) {
    return '请先上传或选择一个 Logo。'
  }
  if (!props.settingsValid) {
    return '请先修正水印参数。'
  }
  if (operationBusy.value) {
    return '有操作正在进行，请等待完成。'
  }
  if (!props.changed) {
    return '当前选择和参数与活动水印一致。'
  }
  return null
})

function profileSummary(profile: WatermarkBrandingDto['activeProfile']) {
  if (!profile) {
    return '无'
  }
  return `${profile.profileName} · 居中 · 不透明度 ${profile.opacityPercent}% · 缩放 ${profile.scalePercent}%`
}

const actionLabel = computed(() => props.branding.activeProfile
  ? '保存并刷新全站'
  : '保存并启用水印',
)

const pendingSummary = computed(() => props.sourceReady
  ? `居中 · 不透明度 ${props.opacityPercent}% · 缩放 ${props.scalePercent}%`
  : '尚未选择 Logo',
)

function onConfirmApply() {
  confirmOpen.value = false
  emit('apply')
}
</script>

<template>
  <section class="editor-card branding-apply" aria-labelledby="branding-apply-title">
    <div class="editor-card__head">
      <h2 id="branding-apply-title" class="editor-card__title">保存与刷新</h2>
      <p class="editor-card__hint">一次确认后自动生成、核验并切换</p>
    </div>

    <dl class="branding-apply__impact">
      <div class="branding-apply__fact">
        <dt>受影响已发布作品</dt>
        <dd>{{ branding.impact.publishedWorkCount }} 件</dd>
      </div>
      <div class="branding-apply__fact">
        <dt>需要重做的作品保护图</dt>
        <dd>{{ branding.impact.targetVariantCount }} 张</dd>
      </div>
      <div class="branding-apply__fact">
        <dt>不受影响的站点无水印图</dt>
        <dd>{{ branding.impact.siteDisplayVariantCount }} 张</dd>
      </div>
      <div class="branding-apply__fact">
        <dt>当前公开配置</dt>
        <dd>{{ profileSummary(branding.activeProfile) }}</dd>
      </div>
      <div class="branding-apply__fact">
        <dt>准备保存</dt>
        <dd>{{ pendingSummary }}</dd>
      </div>
    </dl>

    <p class="branding-apply__note">
      水印只用在作品图片上：作品列表、作品详情、领养列表和设定图。
      首页和委托页的大图始终不打水印，换水印不会改变它们。
      切换完成前旧作品图保持可用；生成或核验失败时，公开站仍使用原配置。
    </p>

    <div class="branding-apply__actions">
      <button
        type="button"
        class="editor__button editor__button--primary"
        :disabled="!canApply"
        @click="confirmOpen = true"
      >{{ mutating ? '正在提交…' : actionLabel }}</button>
      <p v-if="applyBlockReason" class="branding-apply__block" role="status">
        {{ applyBlockReason }}
      </p>
    </div>

    <div
      v-if="operation"
      class="branding-apply__operation"
      role="status"
      aria-live="polite"
      data-testid="watermark-operation"
    >
      <p class="branding-apply__operation-title">
        {{ WATERMARK_OPERATION_TYPE_LABELS[operation.operationType] }}：
        <AdminStatusBadge
          :tone="operation.status === 'DONE'
            ? 'success'
            : operation.status === 'FAILED'
              ? 'error'
              : 'info'"
          :label="WATERMARK_OPERATION_STATUS_LABELS[operation.status]"
        />
      </p>
      <p class="branding-apply__operation-counts">
        已生成 {{ operation.generatedVariantCount }}/{{ operation.targetVariantCount }}
        · 已核验 {{ operation.verifiedVariantCount }}/{{ operation.targetVariantCount }}
        · 待清理 {{ operation.cleanupPendingCount }}
      </p>
      <div v-if="rebuildOperation" class="branding-apply__progress">
        <p class="branding-apply__progress-label">
          <span>公开图生成与核验进度</span>
          <span>{{ progressPercent === null ? '正在统计…' : `${progressPercent}%` }}</span>
        </p>
        <progress
          class="branding-apply__progress-bar"
          :max="progressMax"
          :value="progressValue"
          :aria-label="progressPercent === null
            ? '正在统计全站水印应用进度'
            : `全站水印应用进度：${progressPercent}%`"
        />
      </div>
      <template v-if="operation.status === 'FAILED'">
        <p class="branding-apply__failure" role="alert">
          {{ watermarkFailureHint(operation.failureCode) }}
        </p>
        <button
          type="button"
          class="editor__button editor__button--secondary"
          :disabled="mutating"
          @click="emit('retry')"
        >重试</button>
      </template>
      <p v-else-if="operation.status === 'DONE'" class="branding-apply__done">
        操作已完成。
      </p>
    </div>

    <AdminConfirmDialog
      :open="confirmOpen"
      :title="`${actionLabel}？`"
      :confirm-label="actionLabel"
      tone="primary"
      @confirm="onConfirmApply"
      @cancel="confirmOpen = false"
    >
      <p>
        将保存当前 Logo 和参数，并为 {{ branding.impact.publishedWorkCount }} 件已发布作品重新生成
        {{ branding.impact.targetVariantCount }} 张作品保护图，核验通过后原子切换为：
      </p>
      <p><strong>{{ pendingSummary }}</strong></p>
      <p>
        首页与委托页大图不打水印，这次切换不会改动它们；
        切换前旧作品图保持可用，切换完成后旧作品图进入清理。
      </p>
    </AdminConfirmDialog>
  </section>
</template>

<style scoped>
.branding-apply {
  display: grid;
  gap: var(--admin-space-4);
  align-content: start;
}

.branding-apply__impact {
  margin: 0;
  display: grid;
  gap: var(--admin-space-2);
}

@media (min-width: 768px) {
  .branding-apply__impact {
    grid-template-columns: repeat(2, 1fr);
  }
}

.branding-apply__fact {
  display: grid;
  grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr);
  gap: var(--admin-space-2);
  font-size: var(--admin-font-sm);
}

.branding-apply__fact dt {
  color: var(--admin-text-tertiary);
}

.branding-apply__fact dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 520px) {
  .branding-apply__fact {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

.branding-apply__note {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  line-height: var(--admin-line-normal);
}

.branding-apply__actions {
  display: grid;
  gap: var(--admin-space-2);
  justify-items: start;
}

.branding-apply__block {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}


.branding-apply__operation {
  display: grid;
  gap: var(--admin-space-2);
  justify-items: start;
  padding: var(--admin-space-3) var(--admin-space-4);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-subtle);
}

.branding-apply__operation-title {
  margin: 0;
  font-size: var(--admin-font-sm);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
}

.branding-apply__operation-counts {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.branding-apply__progress {
  width: 100%;
}

.branding-apply__progress-label {
  display: flex;
  justify-content: space-between;
  gap: var(--admin-space-3);
  margin: 0 0 var(--admin-space-2);
  font-size: var(--admin-font-xs);
  color: var(--admin-text-secondary);
}

.branding-apply__progress-bar {
  display: block;
  width: 100%;
  height: 0.5rem;
  accent-color: var(--admin-accent-primary);
}

.branding-apply__failure {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-status-error);
}

.branding-apply__done {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-status-success);
}

</style>

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
  mutating: boolean
  operation: WatermarkOperationDto | null
  previewReady: boolean
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

const canApply = computed(() =>
  props.previewReady
  && !props.mutating
  && !operationBusy.value
  && props.branding.draftProfile !== null,
)

const applyBlockReason = computed(() => {
  if (props.branding.draftProfile === null) {
    return null
  }
  if (operationBusy.value) {
    return '有操作正在进行，请等待完成。'
  }
  if (!props.previewReady) {
    return '需要先在“真实预览”中为当前草稿生成并核验预览。'
  }
  return null
})

function profileSummary(profile: WatermarkBrandingDto['activeProfile']) {
  if (!profile) {
    return '无'
  }
  return `${profile.profileName} · 居中 · 不透明度 ${profile.opacityPercent}% · 缩放 ${profile.scalePercent}%`
}

function onConfirmApply() {
  confirmOpen.value = false
  emit('apply')
}
</script>

<template>
  <section class="editor-card branding-apply" aria-labelledby="branding-apply-title">
    <div class="editor-card__head">
      <h2 id="branding-apply-title" class="editor-card__title">应用到全站</h2>
      <p class="editor-card__hint">先生成并核验全部公开图，再原子切换</p>
    </div>

    <dl class="branding-apply__impact">
      <div class="branding-apply__fact">
        <dt>受影响已发布作品</dt>
        <dd>{{ branding.impact.publishedWorkCount }} 件</dd>
      </div>
      <div class="branding-apply__fact">
        <dt>受影响首页轮播项</dt>
        <dd>{{ branding.impact.enabledHeroSlideCount }} 项</dd>
      </div>
      <div class="branding-apply__fact">
        <dt>目标公开图总数</dt>
        <dd>{{ branding.impact.targetVariantCount }} 张</dd>
      </div>
      <div class="branding-apply__fact">
        <dt>当前公开配置</dt>
        <dd>{{ profileSummary(branding.activeProfile) }}</dd>
      </div>
      <div class="branding-apply__fact">
        <dt>新草稿配置</dt>
        <dd>{{ profileSummary(branding.draftProfile) }}</dd>
      </div>
    </dl>

    <p class="branding-apply__note">
      切换完成前，旧公开图保持可用；切换完成后，旧公开图进入清理。
      生成或核验失败时，当前公开站仍使用原配置。
    </p>

    <div class="branding-apply__actions">
      <button
        type="button"
        class="editor__button editor__button--primary"
        :disabled="!canApply"
        @click="confirmOpen = true"
      >应用草稿到全站</button>
      <p v-if="applyBlockReason" class="branding-apply__block" role="status">
        {{ applyBlockReason }}
      </p>
      <p class="branding-apply__desktop-hint" role="note">
        屏幕较窄：建议改用桌面端完成应用操作；当前可查看活动配置与操作进度。
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

    <p class="branding-apply__current">
      当前公开站使用：{{ profileSummary(branding.activeProfile) }}
    </p>

    <AdminConfirmDialog
      :open="confirmOpen"
      title="应用草稿水印到全站？"
      confirm-label="确认应用"
      tone="primary"
      @confirm="onConfirmApply"
      @cancel="confirmOpen = false"
    >
      <p>
        将为 {{ branding.impact.publishedWorkCount }} 件已发布作品、
        {{ branding.impact.enabledHeroSlideCount }} 项首页轮播重新生成
        {{ branding.impact.targetVariantCount }} 张公开图，核验通过后原子切换为：
      </p>
      <p><strong>{{ profileSummary(branding.draftProfile) }}</strong></p>
      <p>切换前旧公开图保持可用；切换完成后旧公开图进入清理。</p>
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
  grid-template-columns: 8.5rem 1fr;
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

.branding-apply__desktop-hint {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-info);
}

@media (min-width: 768px) {
  .branding-apply__desktop-hint {
    display: none;
  }
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

.branding-apply__current {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}
</style>

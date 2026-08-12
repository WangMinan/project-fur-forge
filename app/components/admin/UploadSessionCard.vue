<script setup lang="ts">
import type { StudioUploadItem } from '~/composables/useStudioPhotoUpload'

const props = defineProps<{
  item: StudioUploadItem
}>()

const emit = defineEmits<{
  cancel: []
  dismiss: []
  retryProcessing: []
  retryUpload: []
}>()

const progressPercent = computed(() =>
  props.item.progress === null ? null : Math.round(props.item.progress * 100),
)

const ffmpegActive = computed(() => props.item.state === 'validating' && (
  (props.item.session?.expected.byteSize ?? 0) > 20_000_000
  || props.item.asset?.processingFailureStage === 'PREPROCESS'
  || props.item.asset?.processingFailureStage === 'DERIVATIVE'
))

const stateLabel = computed(() => {
  switch (props.item.state) {
    case 'digesting':
      return '计算摘要中'
    case 'uploading':
      return `私有上传中 ${progressPercent.value ?? 0}%`
    case 'validating':
      return ffmpegActive.value
        ? '正在用 FFmpeg 生成私有处理源'
        : '服务端校验中'
    case 'completed':
      return props.item.asset?.status === 'FAILED' ? '处理失败' : '已完成'
    case 'cancelled':
      return '已取消'
    case 'expired':
      return '已过期'
    default:
      return '上传失败'
  }
})

const stateTone = computed(() => {
  switch (props.item.state) {
    case 'digesting':
    case 'uploading':
    case 'validating':
      return 'info' as const
    case 'completed':
      return props.item.asset?.status === 'FAILED' ? 'error' as const : 'success' as const
    case 'cancelled':
      return 'neutral' as const
    default:
      return 'error' as const
  }
})

const inFlight = computed(() =>
  ['digesting', 'uploading', 'validating'].includes(props.item.state),
)

const retryable = computed(() =>
  props.item.file !== null
  && ['failed', 'cancelled', 'expired'].includes(props.item.state),
)
</script>

<template>
  <article class="upload-card" :data-state="item.state">
    <div class="upload-card__thumb">
      <img
        v-if="item.previewUrl"
        :src="item.previewUrl"
        :alt="`${item.fileName} 预览`"
      >
      <span v-else aria-hidden="true">图</span>
    </div>
    <div class="upload-card__body">
      <p class="upload-card__name">{{ item.fileName }}</p>
      <p class="upload-card__state">
        <AdminStatusBadge :tone="stateTone" :label="stateLabel" />
      </p>
      <div
        v-if="item.state === 'uploading'"
        class="upload-card__progress"
        role="progressbar"
        :aria-valuenow="progressPercent ?? 0"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`${item.fileName} 上传进度`"
      >
        <span
          class="upload-card__progress-bar"
          :style="{ width: `${progressPercent ?? 0}%` }"
        />
      </div>
      <AdminFfmpegProgress
        v-if="ffmpegActive"
        :label="`${item.fileName}：FFmpeg 私有预处理中`"
      />
      <p v-if="item.failureText" class="upload-card__failure" role="alert">
        {{ item.failureText }}
        <template v-if="item.failureStage">（失败于{{ item.failureStage }}环节）</template>
      </p>
      <p v-if="item.file === null && retryable === false && item.state !== 'completed'" class="upload-card__failure">
        页面已恢复该会话；如需重新直传，请重新选择原文件。
      </p>
      <p v-if="item.asset?.status === 'FAILED' && !item.failureText" class="upload-card__failure" role="alert">
        私有处理源生成失败，可重试处理；原图仍在私有库中。
      </p>
    </div>
    <div class="upload-card__actions">
      <button
        v-if="item.state === 'uploading'"
        type="button"
        class="upload-card__action"
        @click="emit('cancel')"
      >取消</button>
      <button
        v-if="retryable"
        type="button"
        class="upload-card__action"
        @click="emit('retryUpload')"
      >重新上传</button>
      <button
        v-if="item.state === 'completed' && item.asset?.status === 'FAILED'"
        type="button"
        class="upload-card__action"
        @click="emit('retryProcessing')"
      >重试处理</button>
      <button
        v-if="!inFlight"
        type="button"
        class="upload-card__action upload-card__action--danger"
        @click="emit('dismiss')"
      >移除</button>
    </div>
  </article>
</template>

<style scoped>
.upload-card {
  display: flex;
  gap: var(--admin-space-3);
  align-items: flex-start;
  padding: var(--admin-space-3);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.upload-card[data-state='failed'],
.upload-card[data-state='expired'] {
  border-color: var(--admin-status-error);
}

.upload-card__thumb {
  flex: none;
  width: 4rem;
  height: 4rem;
  border-radius: var(--admin-radius-sm);
  overflow: hidden;
  background: var(--admin-bg-subtle);
  display: grid;
  place-items: center;
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
}

.upload-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.upload-card__body {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: var(--admin-space-2);
  align-content: start;
}

.upload-card__name {
  margin: 0;
  font-size: var(--admin-font-sm);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.upload-card__state {
  margin: 0;
}

.upload-card__progress {
  height: 0.375rem;
  border-radius: 999px;
  background: var(--admin-bg-subtle);
  overflow: hidden;
}

.upload-card__progress-bar {
  display: block;
  height: 100%;
  background: var(--admin-accent-primary);
  transition: width var(--admin-duration-fast) linear;
}

.upload-card__failure {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-error);
  line-height: var(--admin-line-normal);
}

.upload-card__actions {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-1);
}

.upload-card__action {
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

.upload-card__action:hover:not(:disabled) {
  background: var(--admin-bg-subtle);
}

.upload-card__action--danger {
  color: var(--admin-danger);
  border-color: var(--admin-danger);
}
</style>

<script setup lang="ts">
import type { StudioUploadItem } from '~/composables/useStudioPhotoUpload'
import { adminUploadProgressModel } from '~/utils/admin-upload-progress'

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
const processingRetryable = computed(() => (
  props.item.state === 'completed' && props.item.asset?.status === 'FAILED'
))
const progressModel = computed(() => adminUploadProgressModel({
  failureText: props.item.failureText
    ?? (processingRetryable.value
      ? '私有处理源生成失败；原图仍保留在私有存储中。'
      : null),
  ffmpeg: ffmpegActive.value,
  label: props.item.fileName,
  progress: props.item.progress,
  stage: processingRetryable.value ? 'failed' : props.item.state,
  stageLabel: stateLabel.value,
}))

function retry() {
  if (processingRetryable.value) {
    emit('retryProcessing')
  }
  else {
    emit('retryUpload')
  }
}
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
      <AdminTaskProgress
        v-if="inFlight || retryable || processingRetryable || item.state === 'cancelled'"
        v-bind="progressModel"
        :can-cancel="item.state === 'uploading'"
        :can-retry="retryable || processingRetryable"
        :retry-label="processingRetryable ? '重试处理' : '重新上传'"
        @cancel="emit('cancel')"
        @retry="retry"
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
      <AdminAction
        v-if="!inFlight"
        variant="danger"
        size="small"
        @click="emit('dismiss')"
      >移除</AdminAction>
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

</style>

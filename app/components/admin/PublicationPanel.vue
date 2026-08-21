<script setup lang="ts">
import {
  publicationActionResponseSchema,
  publicationOperationResponseSchema,
  workPublicationCheckResponseSchema,
} from '~~/shared/schemas/publication'
import type {
  PublicationOperationDto,
  WorkPublicationCheckDto,
} from '~~/shared/types/contracts'
import { PUBLICATION_STATUS_LABELS } from '~/utils/work-labels'
import {
  PUBLICATION_BLOCKER_LABELS,
  PUBLICATION_FAILURE_STAGE_LABELS,
  PUBLICATION_OPERATION_STATUS_LABELS,
  publicationFailureLabel,
} from '~/utils/media-labels'
import { AdminApiError } from '~/composables/useAdminApi'

const props = defineProps<{
  busy: boolean
  dirty: boolean
  saveBeforePublish: () => Promise<boolean>
  work: {
    id: string
    publicationStatus: 'draft' | 'published' | 'unpublished'
    version: number
  }
}>()

const emit = defineEmits<{
  conflict: []
  mutated: []
}>()

interface Feedback {
  cleanupRetry: boolean
  text: string
  tone: 'error' | 'success'
}

const adminApi = useAdminApi()
const polling = usePublicationPolling()
const check = ref<WorkPublicationCheckDto | null>(null)
const checkError = ref<string | null>(null)
const checkLoading = ref(false)
const pending = ref<'cleanup' | 'publish' | 'unpublish' | null>(null)
const feedback = ref<Feedback | null>(null)
const lastOperation = ref<PublicationOperationDto | null>(null)
const confirmUnpublish = ref(false)
let publishProgressTimer: ReturnType<typeof setInterval> | null = null

const STATUS_TONES = {
  draft: 'warning',
  published: 'success',
  unpublished: 'neutral',
} as const

const canStartPublish = computed(() =>
  (check.value?.canPublish === true || props.dirty)
  && pending.value === null
  && !(lastOperation.value && isPublicationInProgress(lastOperation.value))
  && !props.busy
  && props.work.publicationStatus !== 'published',
)

const publishCompleted = computed(() => Math.max(
  0,
  (check.value?.requiredVariantCount ?? 0) - (check.value?.missingVariantCount ?? 0),
))
const operationActive = computed(() => Boolean(
  lastOperation.value && isPublicationInProgress(lastOperation.value),
))
const taskOperation = computed(() => pending.value === null
  ? lastOperation.value
  : null)
const ffmpegPublishActive = computed(() => (
  pending.value === 'publish'
    ? (
    check.value?.adoptionCoverNeedsPreprocess === true
    || check.value?.designSheetNeedsPreprocess === true
    || check.value?.studioPhotoNeedsPreprocess === true
      )
    : taskOperation.value?.status === 'PREPARING_SOURCE'
))
const taskMode = computed(() => ffmpegPublishActive.value
  ? 'indeterminate' as const
  : 'stage' as const)
const taskStatus = computed(() => pending.value !== null
  ? 'active' as const
  : taskOperation.value?.status === 'DONE'
    ? 'success' as const
    : taskOperation.value?.status === 'FAILED'
      ? 'error' as const
      : 'active' as const)
const showTask = computed(() => pending.value !== null || taskOperation.value !== null)
const taskIsPublish = computed(() => pending.value === 'publish'
  || taskOperation.value?.operationType === 'PUBLISH')
const taskLabel = computed(() => {
  if (pending.value === 'cleanup') {
    return '公开文件与 ESA 缓存撤销'
  }
  if (pending.value === 'unpublish'
    || taskOperation.value?.operationType === 'UNPUBLISH') {
    return '作品下架与公开撤销'
  }
  if (pending.value === 'publish') {
    return '作品发布'
  }
  return taskOperation.value?.operationType === 'UPSCALE'
    ? '作品图片适配'
    : '作品发布'
})
const taskStage = computed(() => {
  if (pending.value === 'cleanup') {
    return '重试公开文件与缓存撤销'
  }
  if (pending.value === 'unpublish') {
    return '正在创建下架任务'
  }
  if (pending.value === 'publish') {
    return '正在创建发布任务'
  }
  return taskOperation.value
    ? PUBLICATION_OPERATION_STATUS_LABELS[taskOperation.value.status]
    : null
})
const taskDetail = computed(() => {
  if (pending.value === 'cleanup') {
    return '正在重试删除精确公开对象并撤销 ESA 缓存。'
  }
  if (pending.value !== null || (taskOperation.value
    && isPublicationInProgress(taskOperation.value))) {
    if (ffmpegPublishActive.value) {
      return '正在用 FFmpeg 准备低分辨率图片；单图处理没有可信百分比。'
    }
    if (check.value && taskIsPublish.value) {
      return `公开图片已就绪 ${publishCompleted.value}/${check.value.requiredVariantCount}`
    }
    return null
  }
  return feedback.value?.text ?? null
})

async function refreshPublishProgress() {
  try {
    const result = await adminApi(
      `/api/admin/v1/works/${props.work.id}/publication-check`,
      { schema: workPublicationCheckResponseSchema },
    )
    adoptCheck(result.data, false)
  }
  catch {
    // The publish response remains authoritative; a missed progress poll is harmless.
  }
}

function startPublishProgress() {
  stopPublishProgress()
  publishProgressTimer = setInterval(() => {
    void refreshPublishProgress()
  }, 1_000)
}

function adoptCheck(next: WorkPublicationCheckDto, restore = true) {
  check.value = next
  if (!next.latestOperation) {
    return
  }
  lastOperation.value = next.latestOperation
  if (restore && isPublicationInProgress(next.latestOperation)) {
    void pollOperation(next.latestOperation)
  }
  else if (restore && !isPublicationInProgress(next.latestOperation)) {
    handleOperationOutcome(next.latestOperation)
  }
}

async function pollOperation(operation: PublicationOperationDto) {
  if (polling.isPolling('work-publication')) {
    return
  }
  await polling.poll('work-publication', operation.operationId, {
    onTick: async (current) => {
      lastOperation.value = current
      await refreshPublishProgress()
    },
    onSettled: async (current) => {
      lastOperation.value = current
      handleOperationOutcome(current)
      await refreshPublishProgress()
      emit('mutated')
    },
  })
}

function stopPublishProgress() {
  if (publishProgressTimer) {
    clearInterval(publishProgressTimer)
    publishProgressTimer = null
  }
}

async function loadCheck(): Promise<boolean> {
  checkLoading.value = true
  checkError.value = null
  try {
    const result = await adminApi(
      `/api/admin/v1/works/${props.work.id}/publication-check`,
      { schema: workPublicationCheckResponseSchema },
    )
    adoptCheck(result.data)
    return true
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return false
    }
    checkError.value = '发布检查加载失败，请重试。'
    return false
  }
  finally {
    checkLoading.value = false
  }
}

function handleOperationOutcome(
  operation: PublicationOperationDto,
) {
  lastOperation.value = operation
  if (operation.status === 'DONE') {
    feedback.value = {
      cleanupRetry: false,
      text: operation.operationType === 'PUBLISH'
        ? '发布成功：公开图片已生成并通过校验。'
        : '已下架：公开页面不再可访问，公开文件与 ESA 缓存已撤销。',
      tone: 'success',
    }
    return
  }
  const stage = operation.failureStage
    ? PUBLICATION_FAILURE_STAGE_LABELS[operation.failureStage]
    : null
  const cleanupPending = operation.failureStage === 'CLEANING_PUBLIC'
    && (
      operation.cleanupPendingCount > 0
      || operation.edgePurgeStatus === 'FAILED'
    )
  const base = publicationFailureLabel(operation.failureCode)
  feedback.value = {
    cleanupRetry: cleanupPending,
    text: cleanupPending && operation.operationType === 'UNPUBLISH'
      ? `作品已下架，但公开文件或 ESA 缓存撤销未完成（${base}）。作品不会重新公开，可重试撤销。`
      : `${base}${stage ? `（失败于${stage}环节）` : ''}`,
    tone: 'error',
  }
}

async function publish() {
  if (!canStartPublish.value) {
    return
  }
  feedback.value = null
  pending.value = 'publish'
  try {
    if (!(await props.saveBeforePublish())) {
      feedback.value = {
        cleanupRetry: false,
        text: '页面修改未保存，请先处理页面中的提示后重试。',
        tone: 'error',
      }
      return
    }
    await nextTick()
    if (!(await loadCheck())) {
      feedback.value = {
        cleanupRetry: false,
        text: '页面修改已保存，但发布检查未完成，请重试。',
        tone: 'error',
      }
      return
    }
    if (!check.value?.canPublish) {
      feedback.value = {
        cleanupRetry: false,
        text: '页面修改已保存，请先完成上方列出的待办项。',
        tone: 'error',
      }
      return
    }
    startPublishProgress()
    const result = await adminApi(
      `/api/admin/v1/works/${props.work.id}/publish`,
      {
        method: 'POST',
        body: { expectedVersion: props.work.version, payload: {} },
        schema: publicationActionResponseSchema,
      },
    )
    lastOperation.value = result.data.operation
    handleOperationOutcome(result.data.operation)
    emit('mutated')
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      feedback.value = {
        cleanupRetry: false,
        text: '作品数据已在其他地方变化，发布未执行。请刷新后重试。',
        tone: 'error',
      }
      emit('conflict')
      return
    }
    feedback.value = {
      cleanupRetry: false,
      text: '发布请求失败，请稍后重试。',
      tone: 'error',
    }
  }
  finally {
    stopPublishProgress()
    pending.value = null
  }
}

async function unpublish() {
  confirmUnpublish.value = false
  feedback.value = null
  pending.value = 'unpublish'
  try {
    const result = await adminApi(
      `/api/admin/v1/works/${props.work.id}/unpublish`,
      {
        method: 'POST',
        body: { expectedVersion: props.work.version, payload: {} },
        schema: publicationActionResponseSchema,
      },
    )
    lastOperation.value = result.data.operation
    handleOperationOutcome(result.data.operation)
    emit('mutated')
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      feedback.value = {
        cleanupRetry: false,
        text: '作品数据已变化，或仍被启用的首页轮播关联。请先停用或解除关联，刷新后重试。',
        tone: 'error',
      }
      emit('conflict')
      return
    }
    feedback.value = {
      cleanupRetry: false,
      text: '下架请求失败，请稍后重试。',
      tone: 'error',
    }
  }
  finally {
    pending.value = null
  }
}

async function retryCleanup() {
  if (pending.value !== null) {
    return
  }
  const operation = lastOperation.value
  if (!operation) {
    return
  }
  pending.value = 'cleanup'
  try {
    const result = await adminApi(
      `/api/admin/v1/publication-operations/${operation.operationId}/retry-cleanup`,
      {
        method: 'POST',
        body: { expectedVersion: operation.version, payload: {} },
        schema: publicationOperationResponseSchema,
      },
    )
    lastOperation.value = result.data
    if (result.data.status === 'DONE') {
      feedback.value = {
        cleanupRetry: false,
        text: '公开文件与 ESA 缓存撤销完成。',
        tone: 'success',
      }
    }
    else {
      feedback.value = {
        cleanupRetry: result.data.cleanupPendingCount > 0
          || result.data.edgePurgeStatus === 'FAILED',
        text: '公开文件或 ESA 缓存撤销仍未完成，可再次重试。',
        tone: 'error',
      }
    }
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      feedback.value = {
        cleanupRetry: false,
        text: '操作版本已变化，请刷新状态后重试。',
        tone: 'error',
      }
      emit('conflict')
      return
    }
    feedback.value = {
      cleanupRetry: true,
      text: '重试清理失败，请稍后重试。',
      tone: 'error',
    }
  }
  finally {
    pending.value = null
  }
}

watch(() => props.work.version, () => {
  // 发布/下架成功后页面会刷新作品（版本递增）：反馈必须持久显示，
  // 只刷新发布检查，不清空上一次操作的结果。
  if (pending.value !== 'publish') {
    void loadCheck()
  }
})

onMounted(() => {
  void loadCheck()
})

onUnmounted(() => {
  stopPublishProgress()
})
</script>

<template>
  <section class="editor-card" aria-labelledby="publication-title" data-testid="publication-panel">
    <div class="editor-card__head">
      <h2 id="publication-title" class="editor-card__title">发布</h2>
      <AdminStatusBadge
        :tone="STATUS_TONES[work.publicationStatus]"
        :label="PUBLICATION_STATUS_LABELS[work.publicationStatus]"
      />
      <p v-if="check?.canPublish" class="publication__ok">可以发布</p>
    </div>

    <div v-if="checkLoading && !check" class="publication__state" role="status">
      正在加载发布检查…
    </div>

    <template v-else-if="check">
      <p class="publication__summary">
        横版封面 {{ check.adoptionCoverCount }}/1 · 设定图 {{ check.designSheetCount }}/1 ·
        出厂照 {{ check.studioPhotoCount }}/5 ·
        公开图片 {{ check.requiredVariantCount - check.missingVariantCount }}/{{ check.requiredVariantCount }}
      </p>
      <div v-if="!check.canPublish" class="publication__blocked">
        <p class="publication__blocked-title">暂不可发布，请先完成：</p>
        <ul class="publication__blockers" role="list">
          <li v-for="blocker in check.blockers" :key="blocker">
            {{ PUBLICATION_BLOCKER_LABELS[blocker] }}
          </li>
        </ul>
      </div>
      <p
        v-if="check.adoptionCoverNeedsPreprocess"
        class="publication__preprocess"
        role="status"
      >
        横版封面原图分辨率较低，但可以发布。系统会先生成私有适配源，再生成公开封面。
      </p>
      <p
        v-if="check.designSheetNeedsPreprocess"
        class="publication__preprocess"
        role="status"
      >
        设定图原图分辨率较低，但可以发布。系统会先用 FFmpeg Lanczos 生成私有适配源，然后才会执行上传。
      </p>
      <p
        v-if="check.studioPhotoNeedsPreprocess"
        class="publication__preprocess"
        role="status"
      >
        有出厂照原图分辨率较低，但可以发布。系统会先用 FFmpeg Lanczos 生成私有适配源；放大不会恢复细节，完整原图会保留。
      </p>
      <p v-if="check.missingVariantCount > 0" class="publication__variants">
        发布时将生成 {{ check.missingVariantCount }} 张带水印公开图片，可能需要较长时间。
      </p>
    </template>

    <p v-if="checkError" class="publication__error" role="alert">
      {{ checkError }}
      <AdminAction variant="text" @click="loadCheck">重新加载</AdminAction>
    </p>

    <div class="publication__actions">
      <AdminAction
        v-if="work.publicationStatus !== 'published'"
        variant="primary"
        :disabled="!canStartPublish"
        :loading="pending === 'publish'"
        loading-label="保存并发布中…"
        :title="dirty ? '将先保存页面修改，再检查并发布' : check?.canPublish ? undefined : '请先完成发布检查中的所有待办项'"
        @click="publish"
      >发布</AdminAction>
      <AdminAction
        v-if="work.publicationStatus === 'published'"
        variant="danger"
        :disabled="pending !== null || operationActive || busy"
        @click="confirmUnpublish = true"
      >下架</AdminAction>
      <AdminAction
        variant="text"
        :disabled="checkLoading"
        :loading="checkLoading"
        loading-label="检查中…"
        @click="loadCheck"
      >刷新检查</AdminAction>
    </div>

    <AdminTaskProgress
      v-if="showTask"
      class="publication__progress"
      :mode="taskMode"
      :label="taskLabel"
      :stage="taskStage"
      :status="taskStatus"
      :completed-count="taskIsPublish
        && (check?.requiredVariantCount ?? 0) > 0
        ? publishCompleted
        : null"
      :total-count="taskIsPublish
        ? check?.requiredVariantCount ?? null
        : null"
      :detail="taskDetail"
      :show-elapsed="taskStatus === 'active'"
      :started-at="taskOperation?.startedAt ?? null"
      :can-retry="pending === 'cleanup' || feedback?.cleanupRetry === true"
      retry-label="重试清理公开文件"
      retry-loading-label="正在重试清理…"
      :retry-busy="pending === 'cleanup'"
      :retry-disabled="pending === 'cleanup'"
      @retry="retryCleanup"
    />
    <AdminTaskProgress
      v-else-if="feedback"
      class="publication__progress"
      mode="stage"
      label="操作未完成"
      stage="请按提示处理后重试"
      :status="feedback.tone === 'error' ? 'error' : 'success'"
      :detail="feedback.text"
    />

    <AdminConfirmDialog
      :open="confirmUnpublish"
      title="下架该作品？"
      confirm-label="确认下架"
      tone="danger"
      @confirm="unpublish"
      @cancel="confirmUnpublish = false"
    >
      <p>下架后公开页面立即对访客不可见，公开图片文件会被删除；完整原图与作品内容保留，可随时重新发布。</p>
    </AdminConfirmDialog>
  </section>
</template>

<style scoped>
.publication__state {
  margin: 0 0 var(--admin-space-3);
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.publication__ok {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-status-success);
  font-weight: 600;
}

.publication__summary {
  margin: 0 0 var(--admin-space-3);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
}

.publication__blocked {
  margin: 0 0 var(--admin-space-3);
}

.publication__blocked-title {
  margin: 0 0 var(--admin-space-2);
  font-size: var(--admin-font-sm);
  color: var(--admin-status-warning);
  font-weight: 600;
}

.publication__blockers {
  margin: 0;
  padding-inline-start: var(--admin-space-5);
  display: grid;
  gap: var(--admin-space-1);
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.publication__preprocess {
  margin: var(--admin-space-3) 0;
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-warning-soft);
  color: var(--admin-status-warning);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.publication__variants {
  margin: 0 0 var(--admin-space-3);
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.publication__error {
  margin: 0 0 var(--admin-space-3);
  font-size: var(--admin-font-sm);
  color: var(--admin-status-error);
}

.publication__actions {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
}

.publication__progress {
  margin-block-start: var(--admin-space-3);
}

</style>

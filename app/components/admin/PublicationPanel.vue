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
  publicationFailureLabel,
} from '~/utils/media-labels'
import { AdminApiError } from '~/composables/useAdminApi'

const props = defineProps<{
  busy: boolean
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
const check = ref<WorkPublicationCheckDto | null>(null)
const checkError = ref<string | null>(null)
const checkLoading = ref(false)
const pending = ref<'cleanup' | 'publish' | 'unpublish' | null>(null)
const feedback = ref<Feedback | null>(null)
const lastOperation = ref<PublicationOperationDto | null>(null)
const confirmUnpublish = ref(false)

const STATUS_TONES = {
  draft: 'warning',
  published: 'success',
  unpublished: 'neutral',
} as const

const canPublish = computed(() =>
  check.value?.canPublish === true
  && pending.value === null
  && !props.busy
  && props.work.publicationStatus !== 'published',
)

async function loadCheck() {
  checkLoading.value = true
  checkError.value = null
  try {
    const result = await adminApi(
      `/api/admin/v1/works/${props.work.id}/publication-check`,
      { schema: workPublicationCheckResponseSchema },
    )
    check.value = result.data
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    checkError.value = '发布检查加载失败，请重试。'
  }
  finally {
    checkLoading.value = false
  }
}

function handleOperationOutcome(
  operation: PublicationOperationDto,
  publicationStatus: 'draft' | 'published' | 'unpublished',
) {
  lastOperation.value = operation
  if (operation.status === 'DONE') {
    feedback.value = {
      cleanupRetry: false,
      text: publicationStatus === 'published'
        ? '发布成功：公开图片已生成并通过校验。'
        : '已下架：公开页面不再可访问，公开文件已清理。',
      tone: 'success',
    }
    return
  }
  const stage = operation.failureStage
    ? PUBLICATION_FAILURE_STAGE_LABELS[operation.failureStage]
    : null
  const cleanupPending = operation.failureStage === 'CLEANING_PUBLIC'
    && operation.cleanupPendingCount > 0
  const base = publicationFailureLabel(operation.failureCode)
  feedback.value = {
    cleanupRetry: cleanupPending,
    text: cleanupPending && operation.operationType === 'UNPUBLISH'
      ? `作品已下架，但公开文件清理未完成（${base}）。作品不会重新公开，可重试清理。`
      : `${base}${stage ? `（失败于${stage}环节）` : ''}`,
    tone: 'error',
  }
}

async function publish() {
  if (!canPublish.value) {
    return
  }
  feedback.value = null
  pending.value = 'publish'
  try {
    const result = await adminApi(
      `/api/admin/v1/works/${props.work.id}/publish`,
      {
        method: 'POST',
        body: { expectedVersion: props.work.version, payload: {} },
        schema: publicationActionResponseSchema,
      },
    )
    handleOperationOutcome(result.data.operation, result.data.work.publicationStatus)
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
    handleOperationOutcome(result.data.operation, result.data.work.publicationStatus)
    emit('mutated')
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      feedback.value = {
        cleanupRetry: false,
        text: '作品数据已在其他地方变化，下架未执行。请刷新后重试。',
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
        text: '公开文件清理完成。',
        tone: 'success',
      }
    }
    else {
      feedback.value = {
        cleanupRetry: result.data.cleanupPendingCount > 0,
        text: '公开文件清理仍未完成，可再次重试。',
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
  void loadCheck()
})

onMounted(() => {
  void loadCheck()
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
      <div v-if="!check.canPublish" class="publication__blocked">
        <p class="publication__blocked-title">暂不可发布，请先完成：</p>
        <ul class="publication__blockers" role="list">
          <li v-for="blocker in check.blockers" :key="blocker">
            {{ PUBLICATION_BLOCKER_LABELS[blocker] }}
          </li>
        </ul>
      </div>
      <p v-if="check.missingVariantCount > 0" class="publication__variants">
        发布时将生成 {{ check.missingVariantCount }} 张带水印公开衍生图，请求可能需要较长时间。
      </p>
    </template>

    <p v-if="checkError" class="publication__error" role="alert">
      {{ checkError }}
      <button type="button" class="publication__link" @click="loadCheck">重新加载</button>
    </p>

    <div class="publication__actions">
      <button
        v-if="work.publicationStatus !== 'published'"
        type="button"
        class="editor__button editor__button--primary"
        :disabled="!canPublish"
        :title="check?.canPublish ? undefined : '请先完成发布检查中的所有待办项'"
        @click="publish"
      >{{ pending === 'publish' ? '发布中…' : '发布' }}</button>
      <button
        v-if="work.publicationStatus === 'published'"
        type="button"
        class="editor__button editor__button--danger"
        :disabled="pending !== null || busy"
        @click="confirmUnpublish = true"
      >下架</button>
      <button
        type="button"
        class="publication__link"
        :disabled="checkLoading"
        @click="loadCheck"
      >刷新检查</button>
    </div>

    <p v-if="pending === 'publish'" class="publication__state" role="status">
      正在生成并校验公开图片，请勿重复提交或关闭页面…
    </p>
    <p v-else-if="pending === 'unpublish'" class="publication__state" role="status">
      正在下架并清理公开文件…
    </p>

    <div
      v-if="feedback"
      class="publication__feedback"
      :data-tone="feedback.tone"
      :role="feedback.tone === 'error' ? 'alert' : 'status'"
    >
      <p class="publication__feedback-text">{{ feedback.text }}</p>
      <button
        v-if="feedback.cleanupRetry"
        type="button"
        class="editor__button editor__button--secondary"
        :disabled="pending !== null"
        @click="retryCleanup"
      >{{ pending === 'cleanup' ? '清理中…' : '重试清理公开文件' }}</button>
    </div>

    <AdminConfirmDialog
      :open="confirmUnpublish"
      title="下架该作品？"
      confirm-label="确认下架"
      tone="danger"
      @confirm="unpublish"
      @cancel="confirmUnpublish = false"
    >
      <p>下架后公开页面立即对访客不可见，公开 Bucket 中的衍生图会被删除；私有原图与作品内容保留，可随时重新发布。</p>
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

.publication__link {
  border: none;
  background: none;
  padding: 0 var(--admin-space-2);
  min-height: var(--admin-touch-target);
  font: inherit;
  font-size: var(--admin-font-sm);
  color: var(--admin-accent-primary);
  cursor: pointer;
}

.publication__link:disabled {
  opacity: 0.55;
  cursor: default;
}

.publication__feedback {
  margin-top: var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  display: grid;
  gap: var(--admin-space-2);
  justify-items: start;
}

.publication__feedback[data-tone='success'] {
  background: var(--admin-status-success-soft);
  color: var(--admin-status-success);
}

.publication__feedback[data-tone='error'] {
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
}

.publication__feedback-text {
  margin: 0;
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.editor__button--danger {
  border: none;
  background: var(--admin-danger);
  color: var(--admin-text-inverse);
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border-radius: var(--admin-radius-md);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.editor__button--danger:hover:not(:disabled) {
  background: var(--admin-danger-hover);
}

.editor__button--danger:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>

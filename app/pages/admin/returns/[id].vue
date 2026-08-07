<script setup lang="ts">
import {
  adminReturnPhotoResponseSchema,
  deleteReturnPhotoResponseSchema,
  returnPhotoPublicationActionResponseSchema,
  returnPhotoPublicationCheckResponseSchema,
} from '~~/shared/schemas/return-photo'
import { workListResponseSchema } from '~~/shared/schemas/work'
import type {
  AdminReturnPhotoDto,
  ReturnPhotoPublicationCheckDto,
  PublicationOperationDto,
  WorkListItemDto,
} from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'
import { PUBLICATION_STATUS_LABELS } from '~/utils/work-labels'
import {
  RETURN_BLOCKER_LABELS,
  RETURN_CONSENT_SOURCE_LABELS,
  RETURN_OPERATION_STAGE_LABELS,
} from '~/utils/return-labels'

/**
 * T36 返图编辑：一条记录只编辑一张图。
 *
 * 分区顺序按 .design/admin-console IA 锁定：
 * 1 关联作品 → 2 返图图片 → 3 alt 与排序 → 4 授权记录（仅后台可见）
 * → 5 私有原图与无水印公开预览 → 6 发布检查/发布/下架/失败恢复
 * → 7 危险操作边界。
 *
 * 页面不出现“出厂照”文案、相册控件、水印参数或回收站入口。
 */
definePageMeta({
  layout: 'admin',
  ssr: false,
})

const route = useRoute()
const adminApi = useAdminApi()
const returnPhotoId = computed(() => String(route.params.id))

const status = ref<'error' | 'loading' | 'ready'>('loading')
const record = ref<AdminReturnPhotoDto | null>(null)
const works = ref<WorkListItemDto[]>([])
const check = ref<ReturnPhotoPublicationCheckDto | null>(null)
const operation = ref<PublicationOperationDto | null>(null)

/** 表单草稿：409 冲突时保留，不被服务端值静默覆盖。 */
const form = reactive({
  alt: '',
  consentNote: '',
  consentSource: '' as '' | 'qq' | 'email' | 'other',
  consentConfirmedAt: '',
  sortOrder: 0,
  workId: '',
})

const saving = ref(false)
const publishing = ref(false)
const deleting = ref(false)
const actionError = ref<string | null>(null)
const savedAt = ref<number | null>(null)
const conflict = ref<AdminReturnPhotoDto | null>(null)
const confirmDelete = ref(false)

useSeoMeta({
  title: computed(() => (
    record.value ? `返图管理 · ${record.value.work.characterName}` : '返图管理'
  )),
  robots: 'noindex, nofollow',
})

function applyToForm(value: AdminReturnPhotoDto) {
  form.alt = value.alt
  form.sortOrder = value.sortOrder
  form.workId = value.work.workId
  form.consentSource = value.authorization.source ?? ''
  form.consentNote = value.authorization.note ?? ''
  form.consentConfirmedAt = value.authorization.confirmedAt
    ? value.authorization.confirmedAt.slice(0, 10)
    : ''
}

async function loadCheck() {
  try {
    const response = await adminApi(
      `/api/admin/v1/returns/${returnPhotoId.value}/publication-check`,
      { schema: returnPhotoPublicationCheckResponseSchema },
    )
    check.value = response.data
  }
  catch {
    check.value = null
  }
}

async function load(options: { keepDraft?: boolean } = {}) {
  try {
    const response = await adminApi(
      `/api/admin/v1/returns/${returnPhotoId.value}`,
      { schema: adminReturnPhotoResponseSchema },
    )
    record.value = response.data
    if (!options.keepDraft) {
      applyToForm(response.data)
    }
    status.value = 'ready'
    await loadCheck()
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    status.value = 'error'
  }
}

const upload = useReturnPhotoUpload({
  onConflict: () => {
    void reloadForConflict()
  },
  onUploaded: async () => {
    // 绑定成功后返图版本已经 +1，必须重新读取服务端状态。
    await load({ keepDraft: true })
  },
})

async function reloadForConflict() {
  try {
    const response = await adminApi(
      `/api/admin/v1/returns/${returnPhotoId.value}`,
      { schema: adminReturnPhotoResponseSchema },
    )
    conflict.value = response.data
    record.value = response.data
    await loadCheck()
  }
  catch {
    conflict.value = null
  }
}

onMounted(async () => {
  await load()
  try {
    const response = await adminApi('/api/admin/v1/works', {
      schema: workListResponseSchema,
    })
    works.value = response.data
  }
  catch {
    works.value = []
  }
})

const isPublished = computed(
  () => record.value?.publicationStatus === 'published',
)

const authorizationPayload = computed(() => ({
  source: form.consentSource === '' ? null : form.consentSource,
  confirmedAt: form.consentConfirmedAt === ''
    ? null
    : new Date(`${form.consentConfirmedAt}T00:00:00Z`).toISOString(),
  note: form.consentNote.trim() === '' ? null : form.consentNote.trim(),
}))

async function save() {
  const current = record.value
  if (!current || saving.value) {
    return
  }
  saving.value = true
  actionError.value = null
  conflict.value = null
  try {
    const response = await adminApi(
      `/api/admin/v1/returns/${current.id}`,
      {
        method: 'PUT',
        body: {
          expectedVersion: current.version,
          payload: {
            workId: form.workId,
            alt: form.alt.trim(),
            sortOrder: form.sortOrder,
            authorization: authorizationPayload.value,
          },
        },
        schema: adminReturnPhotoResponseSchema,
      },
    )
    record.value = response.data
    applyToForm(response.data)
    savedAt.value = Date.now()
    await loadCheck()
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      if (error.reason === 'RETURN_PHOTO_PUBLISHED_READONLY') {
        actionError.value = '这条返图已发布，更换关联作品前请先下架。'
      }
      else {
        actionError.value = '这条返图已在别处修改。下面显示的是最新服务端内容，你当前填写的内容仍然保留。'
        await reloadForConflict()
      }
      return
    }
    actionError.value = error instanceof AdminApiError
      && error.reason === 'RETURN_PHOTO_WORK_NOT_FOUND'
      ? '选择的作品不存在，请重新选择。'
      : '保存失败，请检查填写内容后重试。'
  }
  finally {
    saving.value = false
  }
}

async function runPublication(action: 'publish' | 'unpublish') {
  const current = record.value
  if (!current || publishing.value) {
    return
  }
  publishing.value = true
  actionError.value = null
  try {
    const response = await adminApi(
      `/api/admin/v1/returns/${current.id}/${action}`,
      {
        method: 'POST',
        body: { expectedVersion: current.version, payload: {} },
        schema: returnPhotoPublicationActionResponseSchema,
      },
    )
    operation.value = response.data.operation
    await load({ keepDraft: true })
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      if (error.reason === 'RETURN_PHOTO_PUBLICATION_BLOCKED') {
        actionError.value = '还有未满足的发布条件，请先处理下面列出的项目。'
      }
      else if (error.reason === 'ACTIVE_OPERATION_EXISTS') {
        actionError.value = '上一个发布任务还在进行中，请稍后刷新查看结果。'
      }
      else {
        actionError.value = '返图已在别处修改，请刷新后重试。'
        await reloadForConflict()
      }
      await loadCheck()
      return
    }
    actionError.value = action === 'publish'
      ? '发布失败，请查看下面的任务状态后重试。'
      : '下架失败，请稍后重试。'
    await load({ keepDraft: true })
  }
  finally {
    publishing.value = false
  }
}

async function removeDraft() {
  const current = record.value
  if (!current || deleting.value) {
    return
  }
  deleting.value = true
  actionError.value = null
  try {
    await adminApi(`/api/admin/v1/returns/${current.id}`, {
      method: 'DELETE',
      body: { expectedVersion: current.version, payload: {} },
      schema: deleteReturnPhotoResponseSchema,
    })
    await navigateTo('/admin/returns')
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    actionError.value = error instanceof AdminApiError && error.status === 409
      ? '返图状态已变化，请刷新后重试。'
      : '删除失败，请稍后重试。'
  }
  finally {
    deleting.value = false
    confirmDelete.value = false
  }
}

function onPickFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const current = record.value
  if (!file || !current) {
    return
  }
  void upload.start(file, {
    returnPhotoId: current.id,
    version: current.version,
  })
  input.value = ''
}

/**
 * 私有原图预览也用服务端缩放版本（640px 宽）：
 * 预览框最大约 22rem，原图往往是几 MB 的手机照片，不必整张回传。
 */
const privatePreviewSrc = computed(() => (
  record.value?.asset
    ? `/api/admin/v1/media/assets/${record.value.asset.assetId}/preview?w=640`
    : null
))
</script>

<template>
  <AdminShell current="returns">
    <section class="return-editor">
      <header class="return-editor__header">
        <div>
          <p class="return-editor__breadcrumb">
            <NuxtLink to="/admin/returns">返图管理</NuxtLink>
          </p>
          <h1 class="return-editor__title">
            {{ record ? `${record.work.characterName}的返图` : '返图' }}
          </h1>
          <p v-if="record" class="return-editor__status">
            <AdminStatusBadge
              :label="PUBLICATION_STATUS_LABELS[record.publicationStatus]"
              :tone="isPublished ? 'success' : record.publicationStatus === 'unpublished' ? 'warning' : 'neutral'"
            />
            <span v-if="savedAt" class="return-editor__saved" role="status">已保存</span>
          </p>
        </div>
      </header>

      <p v-if="status === 'loading'" class="return-editor__state" role="status">
        正在加载返图…
      </p>
      <p v-else-if="status === 'error'" class="return-editor__state" role="alert">
        返图加载失败，请刷新页面后重试。
      </p>

      <template v-else-if="record">
        <p v-if="actionError" class="return-editor__error" role="alert">
          {{ actionError }}
        </p>

        <AdminReturnEditorCards
          v-model:form="form"
          :record="record"
          :works="works"
          :check="check"
          :operation="operation"
          :conflict="conflict"
          :upload="upload"
          :saving="saving"
          :publishing="publishing"
          :deleting="deleting"
          :confirm-delete="confirmDelete"
          :private-preview-src="privatePreviewSrc"
          :blocker-labels="RETURN_BLOCKER_LABELS"
          :consent-source-labels="RETURN_CONSENT_SOURCE_LABELS"
          :operation-stage-labels="RETURN_OPERATION_STAGE_LABELS"
          @save="save"
          @publish="runPublication('publish')"
          @unpublish="runPublication('unpublish')"
          @pick-file="onPickFile"
          @request-delete="confirmDelete = true"
          @cancel-delete="confirmDelete = false"
          @confirm-delete="removeDraft"
        />
      </template>
    </section>
  </AdminShell>
</template>

<style scoped>
.return-editor {
  max-width: var(--admin-content-max);
}

.return-editor__breadcrumb {
  font-size: var(--admin-font-sm);
}

.return-editor__breadcrumb a {
  color: var(--admin-accent-primary);
}

.return-editor__title {
  margin-top: var(--admin-space-2);
  font-size: var(--admin-font-xl);
  font-weight: 600;
}

.return-editor__status {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  margin-top: var(--admin-space-2);
}

.return-editor__saved {
  color: var(--admin-status-success);
  font-size: var(--admin-font-xs);
}

.return-editor__state {
  margin-top: var(--admin-space-6);
  padding: var(--admin-space-7);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  text-align: center;
}

.return-editor__error {
  margin-top: var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}
</style>

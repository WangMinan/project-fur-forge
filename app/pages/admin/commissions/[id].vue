<script setup lang="ts">
import {
  commissionSubmissionDetailResponseSchema,
  updateCommissionSubmissionResponseSchema,
} from '~~/shared/schemas/commission'
import type {
  CommissionSubmissionDetailDto,
  CommissionSubmissionStatus,
} from '~~/shared/types/contracts'
import { commissionSourceLabel } from '~/utils/commission-source'
import { AdminApiError } from '~/composables/useAdminApi'
import { ADMIN_MEDIA_LARGE_PREVIEW_WIDTH } from '~~/shared/constants/admin-media-preview'

definePageMeta({ layout: 'admin', ssr: false })
useSeoMeta({ title: '委托申请详情', robots: 'noindex, nofollow' })

const route = useRoute()
const adminApi = useAdminApi()
const detail = ref<CommissionSubmissionDetailDto | null>(null)
const pageStatus = ref<'error' | 'loading' | 'ready'>('loading')
const editing = shallowRef(false)
const imageError = shallowRef(false)
const detailHeader = useTemplateRef<HTMLElement>('detailHeader')
function manualSaved(value: CommissionSubmissionDetailDto) {
  detail.value = value
  syncForm(value)
  editing.value = false
  imageError.value = false
  exportError.value = null
  void nextTick(() => detailHeader.value?.querySelector<HTMLElement>('[data-commission-edit]')?.focus({ preventScroll: true }))
}
const status = ref<CommissionSubmissionStatus>('pending')
const internalNote = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)
const saveSuccess = ref<string | null>(null)
const conflictOpen = ref(false)
const saveTrigger = shallowRef<HTMLElement | null>(null)

function syncForm(value: CommissionSubmissionDetailDto) {
  status.value = value.status
  internalNote.value = value.internalNote ?? ''
}

async function load() {
  pageStatus.value = 'loading'
  imageError.value = false
  saveSuccess.value = null
  try {
    const response = await adminApi(
      `/api/admin/v1/commissions/${String(route.params.id)}`,
      { schema: commissionSubmissionDetailResponseSchema },
    )
    detail.value = response.data
    syncForm(response.data)
    pageStatus.value = 'ready'
  }
  catch {
    pageStatus.value = 'error'
  }
}

async function save() {
  if (!detail.value || saving.value) {
    return
  }
  saveError.value = null
  saveSuccess.value = null
  saveTrigger.value = document.activeElement as HTMLElement | null
  saving.value = true
  try {
    const response = await adminApi(
      `/api/admin/v1/commissions/${detail.value.id}`,
      {
        method: 'PUT',
        body: {
          expectedVersion: detail.value.version,
          payload: {
            status: status.value,
            internalNote: internalNote.value.trim() || null,
          },
        },
        schema: updateCommissionSubmissionResponseSchema,
      },
    )
    detail.value = response.data
    syncForm(response.data)
    saveSuccess.value = '处理结果已保存。'
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 409) {
      conflictOpen.value = true
    }
    else {
      saveError.value = '保存失败，当前填写内容仍保留。'
    }
  }
  finally {
    saving.value = false
  }
}

async function acknowledgeConflict() {
  conflictOpen.value = false
  await load()
}

async function onDeleted() {
  await navigateTo('/admin/commissions?status=rejected')
}

function formatTime(value: string | null) {
  if (!value) {
    return '—'
  }
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

/**
 * 导出制作单：已接受的申请才给按钮。
 *
 * PDF 由服务端生成（A4 横版：资料按需续页 + 满页设定图），不走浏览器打印——
 * 打印结果会被操作员的默认打印机纸张、方向和灰度设置改变，导出的文件必须与打印机无关。
 */
const exportable = computed(() => detail.value?.status === 'accepted' && Boolean(detail.value.designReferencePreviewHref))
const exporting = ref(false)
const exportError = ref<string | null>(null)
const exportLoadedBytes = shallowRef(0)
const exportTotalBytes = shallowRef<number | null>(null)

function formatDownloadBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.ceil(bytes / 1024)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const exportProgressLabel = computed(() => {
  if (!exporting.value) return null
  if (exportLoadedBytes.value === 0 && exportTotalBytes.value === null) {
    return '正在生成制作单…'
  }
  const loaded = formatDownloadBytes(exportLoadedBytes.value)
  if (exportTotalBytes.value === null) {
    return `正在下载 ${loaded}`
  }
  const total = formatDownloadBytes(exportTotalBytes.value)
  const percent = Math.min(100, Math.round(
    exportLoadedBytes.value / exportTotalBytes.value * 100,
  ))
  return `正在下载 ${loaded} / ${total}（${percent}%）`
})

async function readPdfBlob(response: Response) {
  const contentLength = Number(response.headers.get('content-length'))
  exportTotalBytes.value = Number.isSafeInteger(contentLength) && contentLength > 0
    ? contentLength
    : null
  if (!response.body) {
    const blob = await response.blob()
    exportLoadedBytes.value = blob.size
    return blob
  }
  const chunks: BlobPart[] = []
  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      exportLoadedBytes.value += value.byteLength
      chunks.push(value.buffer.slice(
        value.byteOffset,
        value.byteOffset + value.byteLength,
      ) as ArrayBuffer)
    }
  }
  finally {
    reader.releaseLock()
  }
  return new Blob(chunks, { type: 'application/pdf' })
}

async function exportWorkOrder() {
  if (!detail.value || !exportable.value || exporting.value) {
    return
  }
  exporting.value = true
  exportError.value = null
  exportLoadedBytes.value = 0
  exportTotalBytes.value = null
  try {
    // 走 fetch 而不是直接开链接：失败时能给出提示，而不是把错误 JSON 下载下来。
    const response = await fetch(
      `/api/admin/v1/commissions/${detail.value.id}/work-order`,
      { credentials: 'same-origin' },
    )
    if (!response.ok) {
      throw new Error('export failed')
    }
    const blob = await readPdfBlob(response)
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `commission-work-order-${detail.value.receiptCode}.pdf`
    anchor.click()
    URL.revokeObjectURL(href)
  }
  catch {
    exportError.value = '制作单导出失败，请重试。'
  }
  finally {
    exporting.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <AdminShell current="commissions">
    <div class="commission-detail">
      <header v-if="!editing" ref="detailHeader" class="commission-detail__header">
        <div>
          <NuxtLink to="/admin/commissions">← 委托申请</NuxtLink>
          <h1>委托申请详情</h1>
        </div>
        <div class="commission-detail__tools">
          <div class="commission-detail__actions">
            <AdminAction v-if="detail?.origin === 'manual'" data-commission-edit variant="primary" :disabled="exporting" @click="editing = true">编辑申请</AdminAction>
            <AdminAction v-if="exportable" class="commission-detail__export-action" :loading="exporting" loading-label="导出中…" variant="primary" @click="exportWorkOrder">导出制作单</AdminAction>
          </div>
          <p v-if="exportError" role="alert" class="commission-detail__error">
            {{ exportError }}
          </p>
          <p
            v-if="exportProgressLabel"
            class="commission-detail__export-progress"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {{ exportProgressLabel }}
          </p>
        </div>
      </header>

      <div v-if="pageStatus === 'loading'" class="commission-detail__state" role="status">
        正在加载申请…
      </div>
      <div v-else-if="pageStatus === 'error'" class="commission-detail__state" role="alert">
        <p>申请详情加载失败。</p>
        <AdminAction @click="load">重试</AdminAction>
      </div>
      <AdminManualCommissionForm v-else-if="detail && editing" :initial="detail" class="commission-detail__manual" @saved="manualSaved" />
      <template v-else-if="detail">
        <section class="commission-detail__card" aria-labelledby="commission-contact-title">
          <h2 id="commission-contact-title">申请与联系</h2>
          <dl class="commission-detail__facts">
            <div><dt>称呼</dt><dd>{{ detail.nickname }}</dd></div>
            <div><dt>物种</dt><dd>{{ detail.species ?? (detail.origin === 'manual' ? '未填写' : '待人工补录') }}</dd></div>
            <div><dt>申请编号</dt><dd>{{ detail.receiptCode }}</dd></div>
            <div><dt>手机号</dt><dd>{{ detail.phone ? `${detail.phone.countryCode} ${detail.phone.number}` : '未填写' }}</dd></div>
            <div><dt>QQ</dt><dd>{{ detail.qq ?? '未填写' }}</dd></div>
            <div><dt>身高</dt><dd>{{ detail.heightCm === null ? '未填写' : `${detail.heightCm} cm` }}</dd></div>
            <div><dt>体重</dt><dd>{{ detail.weightKg === null ? '未填写' : `${detail.weightKg} kg` }}</dd></div>
            <div><dt>来源</dt><dd>{{ commissionSourceLabel(detail) }}</dd></div>
            <div v-if="detail.origin === 'manual'"><dt>其他联系方式</dt><dd>{{ detail.otherContact ?? '未填写' }}</dd></div>
            <div v-if="detail.origin === 'manual'"><dt>原申请日期</dt><dd>{{ detail.originalAppliedOn ?? '未填写' }}</dd></div>
            <div v-if="detail.origin === 'manual'"><dt>历史处理日期</dt><dd>{{ detail.historicalHandledOn ?? '未填写' }}</dd></div>
            <div><dt>{{ detail.origin === 'manual' ? '录入时间' : '提交时间' }}</dt><dd>{{ formatTime(detail.createdAt) }}</dd></div>
            <div><dt>处理时间</dt><dd>{{ formatTime(detail.handledAt) }}</dd></div>
          </dl>
        </section>

        <section
          class="commission-detail__card commission-detail__card--image"
          aria-labelledby="commission-image-title"
        >
          <h2 id="commission-image-title">设定图</h2>
          <p v-if="!detail.designReferencePreviewHref">暂未上传设定图。补齐图片后，已接受的申请可导出制作单。</p>
          <div v-else-if="imageError" class="commission-detail__image-error" role="alert">
            <p>设定图预览加载失败，请重试。已保存的图片未被修改。</p>
            <AdminAction @click="imageError = false">重试图片</AdminAction>
          </div>
          <img
            v-else
            class="commission-detail__image"
            :src="`${detail.designReferencePreviewHref}?w=${ADMIN_MEDIA_LARGE_PREVIEW_WIDTH}`"
            alt="委托申请私有设定图"
            referrerpolicy="no-referrer"
            @error="imageError = true"
          >
          <!-- 放大预览直接新开原图：浏览器自带缩放与拖动，比自制灯箱好用。 -->
          <a
            v-if="detail.designReferencePreviewHref"
            class="commission-detail__zoom"
            :href="`${detail.designReferencePreviewHref}?original=1`"
            target="_blank"
            rel="noopener noreferrer"
          >放大预览原图 ↗</a>
        </section>

        <p v-if="detail.origin === 'manual'" class="commission-detail__card">后台录入 · 无需邮件。资料和处理状态修改也不会发送邮件。</p>
        <AdminCommissionEmailStatus v-else :key="detail.id" :submission-id="detail.id" />

        <section v-if="detail.origin === 'manual'" class="commission-detail__card">
          <h2>处理</h2>
          <p>状态：{{ detail.status === 'pending' ? '待处理' : detail.status === 'accepted' ? '已接受' : '已拒绝' }}</p>
          <p>成年确认：{{ detail.offlineAdultConfirmed ? '已在线下确认' : '未确认' }}</p>
          <p>资料使用确认：{{ detail.offlinePrivacyConfirmed ? '已在线下确认' : '未确认' }}</p>
          <p class="commission-detail__note">{{ detail.internalNote ?? '未填写内部备注' }}</p>
          <AdminAction :disabled="exporting" @click="editing = true">编辑资料与处理结果</AdminAction>
        </section>
        <section v-else class="commission-detail__card" aria-labelledby="commission-handling-title">
          <h2 id="commission-handling-title">处理</h2>
          <label for="commission-status">状态</label>
          <AdminSelect id="commission-status" v-model="status" :disabled="saving" :options="[{ value: 'pending', label: '待处理' }, { value: 'accepted', label: '已接受' }, { value: 'rejected', label: '已拒绝' }]" @change="saveSuccess = null" />
          <label for="commission-note">内部备注</label>
          <textarea
            id="commission-note"
            v-model="internalNote"
            maxlength="2000"
            rows="6"
            @input="saveSuccess = null"
          />
          <p v-if="saveError" role="alert" class="commission-detail__error">{{ saveError }}</p>
          <p v-if="saveSuccess" role="status" class="commission-detail__success">
            {{ saveSuccess }}
          </p>
          <AdminAction :loading="saving" loading-label="保存中…" variant="primary" @click="save">保存处理结果</AdminAction>
        </section>
        <section
          v-if="detail.status === 'rejected'"
          class="commission-detail__card"
          aria-labelledby="commission-deletion-title"
        >
          <h2 id="commission-deletion-title">删除申请数据</h2>
          <AdminCommissionDeletionAction
            :submission-id="detail.id"
            :status="detail.status"
            @deleted="onDeleted"
          />
        </section>
      </template>

      <AdminConfirmDialog
        :open="conflictOpen"
        :return-focus-to="saveTrigger"
        title="申请已在其他位置更新"
        confirm-label="重新载入（放弃当前修改）"
        cancel-label="保留当前输入"
        @confirm="acknowledgeConflict"
        @cancel="conflictOpen = false"
      >
        <p role="alert">为避免覆盖他人的处理结果，当前保存已停止。重新载入将放弃当前输入；取消可保留输入供核对。</p>
      </AdminConfirmDialog>
    </div>

  </AdminShell>
</template>

<style scoped>
/* 用满页宽：申请信息与处理表单一栏，设定图另起一栏，右侧不再空一大片。 */
.commission-detail {
  max-width: var(--admin-content-max);
  min-width: 0;
  display: grid;
  gap: var(--admin-space-5);
  align-content: start;
}

.commission-detail__manual { grid-column: 1 / -1; }
.commission-detail__note { white-space: pre-wrap; overflow-wrap: anywhere; }
.commission-detail__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--admin-space-3);
}

.commission-detail__header h1 {
  margin: var(--admin-space-2) 0 0;
}

@media (min-width: 1024px) {
  .commission-detail {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
  }

  .commission-detail__header,
  .commission-detail__state {
    grid-column: 1 / -1;
  }

  /* 设定图占右栏并跨两行，和左栏的「申请与联系」「处理」并排。 */
  .commission-detail__card--image {
    grid-column: 2;
    grid-row: 2 / span 2;
  }
}

.commission-detail__state,
.commission-detail__card {
  padding: var(--admin-space-5);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  background: var(--admin-bg-primary);
}

.commission-detail__card {
  min-width: 0;
  margin: 0;
  align-content: start;
  display: grid;
  gap: var(--admin-space-3);
}

.commission-detail__card h2,
.commission-detail__card p {
  margin: 0;
}

.commission-detail__facts {
  display: grid;
  gap: var(--admin-space-3);
  margin: 0;
}

.commission-detail__facts div {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: var(--admin-space-3);
}

.commission-detail__facts dt {
  color: var(--admin-text-secondary);
}

.commission-detail__facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.commission-detail__image {
  display: block;
  width: 100%;
  max-height: 42rem;
  object-fit: contain;
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-subtle);
}

.commission-detail__tools {
  display: grid;
  justify-items: end;
  gap: var(--admin-space-2);
  min-width: 0;
  max-width: 100%;
  margin-left: auto;
}

.commission-detail__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--admin-space-2);
}

.commission-detail__export-action { min-width: 9rem; }

.commission-detail__image-error {
  display: grid;
  justify-items: start;
  gap: var(--admin-space-3);
  color: var(--admin-status-error);
}

.commission-detail__zoom {
  justify-self: start;
  font-size: var(--admin-font-sm);
}

.commission-detail__export-progress {
  margin: 0;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  font-variant-numeric: tabular-nums;
}

.commission-detail textarea {
  width: 100%;
  padding: var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  font: inherit;
}

.commission-detail__error {
  color: var(--admin-status-error);
}

.commission-detail__success {
  padding: var(--admin-space-3);
  color: var(--admin-status-success, #246b45);
  background: color-mix(in srgb, #2f7b5c 10%, var(--admin-bg-primary));
  border-radius: var(--admin-radius-md);
}

@media (max-width: 640px) {
  .commission-detail__facts div {
    grid-template-columns: 1fr;
    gap: var(--admin-space-1);
  }
}
</style>

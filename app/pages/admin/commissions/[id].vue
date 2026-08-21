<script setup lang="ts">
import {
  commissionSubmissionDetailResponseSchema,
  updateCommissionSubmissionResponseSchema,
} from '~~/shared/schemas/commission'
import type {
  CommissionSubmissionDetailDto,
  CommissionSubmissionStatus,
} from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'

definePageMeta({ layout: 'admin', ssr: false })
useSeoMeta({ title: '委托申请详情', robots: 'noindex, nofollow' })

const route = useRoute()
const adminApi = useAdminApi()
const detail = ref<CommissionSubmissionDetailDto | null>(null)
const pageStatus = ref<'error' | 'loading' | 'ready'>('loading')
const status = ref<CommissionSubmissionStatus>('pending')
const internalNote = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)
const saveSuccess = ref<string | null>(null)
const conflictOpen = ref(false)

function syncForm(value: CommissionSubmissionDetailDto) {
  status.value = value.status
  internalNote.value = value.internalNote ?? ''
}

async function load() {
  pageStatus.value = 'loading'
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
 * PDF 由服务端生成（两页 A4 横版：单主信息 + 满页设定图），不走浏览器打印——
 * 打印结果会被操作员的默认打印机纸张、方向和灰度设置改变，导出的文件必须与打印机无关。
 */
const exportable = computed(() => detail.value?.status === 'accepted')
const exporting = ref(false)
const exportError = ref<string | null>(null)

async function exportWorkOrder() {
  if (!detail.value || !exportable.value || exporting.value) {
    return
  }
  exporting.value = true
  exportError.value = null
  try {
    // 走 fetch 而不是直接开链接：失败时能给出提示，而不是把错误 JSON 下载下来。
    const response = await fetch(
      `/api/admin/v1/commissions/${detail.value.id}/work-order`,
      { credentials: 'same-origin' },
    )
    if (!response.ok) {
      throw new Error('export failed')
    }
    const blob = await response.blob()
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
      <header class="commission-detail__header">
        <div>
          <NuxtLink to="/admin/commissions">← 委托申请</NuxtLink>
          <h1>委托申请详情</h1>
        </div>
        <div v-if="exportable" class="commission-detail__export">
          <button type="button" :disabled="exporting" @click="exportWorkOrder">
            {{ exporting ? '导出中…' : '导出制作单' }}
          </button>
          <p v-if="exportError" role="alert" class="commission-detail__error">
            {{ exportError }}
          </p>
        </div>
      </header>

      <div v-if="pageStatus === 'loading'" class="commission-detail__state" role="status">
        正在加载申请…
      </div>
      <div v-else-if="pageStatus === 'error'" class="commission-detail__state" role="alert">
        <p>申请详情加载失败。</p>
        <button type="button" @click="load">重试</button>
      </div>
      <template v-else-if="detail">
        <section class="commission-detail__card" aria-labelledby="commission-contact-title">
          <h2 id="commission-contact-title">申请与联系</h2>
          <dl class="commission-detail__facts">
            <div><dt>称呼</dt><dd>{{ detail.nickname }}</dd></div>
            <div><dt>物种</dt><dd>{{ detail.species ?? '待人工补录' }}</dd></div>
            <div><dt>回执</dt><dd>{{ detail.receiptCode }}</dd></div>
            <div><dt>手机号</dt><dd>{{ detail.phone.countryCode }} {{ detail.phone.number }}</dd></div>
            <div><dt>QQ</dt><dd>{{ detail.qq }}</dd></div>
            <div><dt>身高</dt><dd>{{ detail.heightCm }} cm</dd></div>
            <div><dt>体重</dt><dd>{{ detail.weightKg }} kg</dd></div>
            <div><dt>提交时间</dt><dd>{{ formatTime(detail.createdAt) }}</dd></div>
            <div><dt>处理时间</dt><dd>{{ formatTime(detail.handledAt) }}</dd></div>
          </dl>
        </section>

        <section
          class="commission-detail__card commission-detail__card--image"
          aria-labelledby="commission-image-title"
        >
          <h2 id="commission-image-title">设定图</h2>
          <img
            class="commission-detail__image"
            :src="detail.designReferencePreviewHref"
            alt="委托申请私有设定图"
            referrerpolicy="no-referrer"
          >
          <!-- 放大预览直接新开原图：浏览器自带缩放与拖动，比自制灯箱好用。 -->
          <a
            class="commission-detail__zoom"
            :href="detail.designReferencePreviewHref"
            target="_blank"
            rel="noopener noreferrer"
          >放大预览原图 ↗</a>
        </section>

        <section class="commission-detail__card" aria-labelledby="commission-handling-title">
          <h2 id="commission-handling-title">处理</h2>
          <label for="commission-status">状态</label>
          <select id="commission-status" v-model="status" @change="saveSuccess = null">
            <option value="pending">待处理</option>
            <option value="accepted">已接受</option>
            <option value="rejected">已拒绝</option>
          </select>
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
          <button type="button" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存处理结果' }}
          </button>
        </section>
        <section
          v-if="detail.status === 'rejected'"
          class="commission-detail__card"
          aria-labelledby="commission-deletion-title"
        >
          <h2 id="commission-deletion-title">删除申请数据</h2>
          <p>先执行单条 dry-run，核对脱敏数据库/私有对象计数与阻断原因；再明确确认永久删除。</p>
          <AdminCommissionDeletionAction
            :submission-id="detail.id"
            :status="detail.status"
            @deleted="onDeleted"
          />
        </section>
      </template>

      <AdminConfirmDialog
        :open="conflictOpen"
        title="申请已在其他位置更新"
        confirm-label="知道了，重新载入"
        :show-cancel="false"
        @confirm="acknowledgeConflict"
        @cancel="acknowledgeConflict"
      >
        <p role="alert">为避免覆盖他人的处理结果，当前保存已停止。确认后载入最新内容。</p>
      </AdminConfirmDialog>
    </div>

  </AdminShell>
</template>

<style scoped>
/* 用满页宽：申请信息与处理表单一栏，设定图另起一栏，右侧不再空一大片。 */
.commission-detail {
  display: grid;
  gap: var(--admin-space-5);
  align-content: start;
}

.commission-detail__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
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

.commission-detail__export {
  display: grid;
  justify-items: end;
  gap: var(--admin-space-2);
}

.commission-detail__zoom {
  justify-self: start;
  font-size: var(--admin-font-sm);
}

.commission-detail button:disabled {
  opacity: 0.6;
}

.commission-detail select,
.commission-detail textarea {
  width: 100%;
  padding: var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  font: inherit;
}

.commission-detail button {
  justify-self: start;
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: 0;
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-inverse);
  background: var(--admin-accent-primary);
  font: inherit;
  font-weight: 600;
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

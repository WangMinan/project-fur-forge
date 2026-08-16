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
const conflictOpen = ref(false)

function syncForm(value: CommissionSubmissionDetailDto) {
  status.value = value.status
  internalNote.value = value.internalNote ?? ''
}

async function load() {
  pageStatus.value = 'loading'
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

function formatTime(value: string | null) {
  if (!value) {
    return '—'
  }
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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
            <div><dt>回执</dt><dd>{{ detail.receiptCode }}</dd></div>
            <div><dt>手机号</dt><dd>{{ detail.phone.countryCode }} {{ detail.phone.number }}</dd></div>
            <div><dt>QQ</dt><dd>{{ detail.qq }}</dd></div>
            <div><dt>身高</dt><dd>{{ detail.heightCm }} cm</dd></div>
            <div><dt>体重</dt><dd>{{ detail.weightKg }} kg</dd></div>
            <div><dt>提交时间</dt><dd>{{ formatTime(detail.createdAt) }}</dd></div>
            <div><dt>处理时间</dt><dd>{{ formatTime(detail.handledAt) }}</dd></div>
          </dl>
        </section>

        <section class="commission-detail__card" aria-labelledby="commission-image-title">
          <h2 id="commission-image-title">私有设定图</h2>
          <img
            class="commission-detail__image"
            :src="detail.designReferencePreviewHref"
            alt="委托申请私有设定图"
            referrerpolicy="no-referrer"
          >
          <p>图片仅通过当前管理会话读取，响应禁止缓存。</p>
        </section>

        <section class="commission-detail__card" aria-labelledby="commission-handling-title">
          <h2 id="commission-handling-title">处理</h2>
          <label for="commission-status">状态</label>
          <select id="commission-status" v-model="status">
            <option value="pending">待处理</option>
            <option value="accepted">已接受</option>
            <option value="rejected">已拒绝</option>
          </select>
          <label for="commission-note">内部备注</label>
          <textarea id="commission-note" v-model="internalNote" maxlength="2000" rows="6" />
          <p v-if="saveError" role="alert" class="commission-detail__error">{{ saveError }}</p>
          <button type="button" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存处理结果' }}
          </button>
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
.commission-detail {
  display: grid;
  gap: var(--admin-space-5);
  max-width: var(--admin-reading-max);
}

.commission-detail__header h1 {
  margin: var(--admin-space-2) 0 0;
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
  width: min(100%, 38rem);
  max-height: 42rem;
  object-fit: contain;
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-subtle);
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

@media (max-width: 640px) {
  .commission-detail__facts div {
    grid-template-columns: 1fr;
    gap: var(--admin-space-1);
  }
}
</style>

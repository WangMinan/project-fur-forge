<script setup lang="ts">
import { commissionSubmissionListResponseSchema } from '~~/shared/schemas/commission'
import type {
  CommissionSubmissionListItemDto,
  CommissionSubmissionStatus,
} from '~~/shared/types/contracts'

definePageMeta({ layout: 'admin', ssr: false })
useSeoMeta({ title: '委托申请', robots: 'noindex, nofollow' })

const route = useRoute()
const adminApi = useAdminApi()
const items = ref<CommissionSubmissionListItemDto[]>([])
const pageStatus = ref<'error' | 'loading' | 'ready'>('loading')
const activeStatus = computed<CommissionSubmissionStatus>(() => (
  ['accepted', 'rejected'].includes(String(route.query.status))
    ? route.query.status as CommissionSubmissionStatus
    : 'pending'
))
const tabs: Array<{ label: string, status: CommissionSubmissionStatus }> = [
  { label: '待处理', status: 'pending' },
  { label: '已接受', status: 'accepted' },
  { label: '已拒绝', status: 'rejected' },
]

function tabHref(status: CommissionSubmissionStatus) {
  return status === 'pending' ? '/admin/commissions' : `/admin/commissions?status=${status}`
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function load() {
  pageStatus.value = 'loading'
  try {
    const response = await adminApi(
      `/api/admin/v1/commissions?status=${activeStatus.value}`,
      { schema: commissionSubmissionListResponseSchema },
    )
    items.value = response.data
    pageStatus.value = 'ready'
  }
  catch {
    pageStatus.value = 'error'
  }
}

watch(activeStatus, () => void load())
onMounted(() => void load())
</script>

<template>
  <AdminShell current="commissions">
    <div class="commission-inbox">
      <header class="commission-inbox__header">
        <div>
          <h1>委托申请</h1>
          <p>列表只显示称呼、提交时间、状态与回执；联系方式在详情中按需查看。</p>
        </div>
        <button type="button" :disabled="pageStatus === 'loading'" @click="load">
          {{ pageStatus === 'loading' ? '刷新中…' : '刷新' }}
        </button>
      </header>

      <nav class="commission-inbox__tabs" aria-label="委托申请状态">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.status"
          :to="tabHref(tab.status)"
          :aria-current="activeStatus === tab.status ? 'page' : undefined"
        >{{ tab.label }}</NuxtLink>
      </nav>

      <div v-if="pageStatus === 'loading'" class="commission-inbox__state" role="status">
        正在加载申请…
      </div>
      <div v-else-if="pageStatus === 'error'" class="commission-inbox__state" role="alert">
        <p>申请列表加载失败。</p>
        <button type="button" @click="load">重试</button>
      </div>
      <div v-else-if="items.length === 0" class="commission-inbox__state">
        当前状态下没有申请。
      </div>
      <ul v-else class="commission-inbox__list" role="list">
        <li v-for="item in items" :key="item.id">
          <NuxtLink :to="`/admin/commissions/${item.id}`" class="commission-inbox__item">
            <span class="commission-inbox__name">{{ item.nickname }}</span>
            <span>{{ formatTime(item.createdAt) }}</span>
            <span>{{ item.receiptCode }}</span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </AdminShell>
</template>

<style scoped>
.commission-inbox {
  display: grid;
  gap: var(--admin-space-5);
  max-width: var(--admin-content-max);
}

.commission-inbox__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--admin-space-4);
  flex-wrap: wrap;
}

.commission-inbox__header h1,
.commission-inbox__header p {
  margin: 0;
}

.commission-inbox__header p {
  margin-top: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.commission-inbox button,
.commission-inbox__tabs a {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-4);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  font: inherit;
}

.commission-inbox__tabs {
  display: flex;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
}

.commission-inbox__tabs a {
  display: inline-flex;
  align-items: center;
}

.commission-inbox__tabs a[aria-current='page'] {
  color: var(--admin-text-inverse);
  background: var(--admin-accent-primary);
  border-color: var(--admin-accent-primary);
}

.commission-inbox__state {
  padding: var(--admin-space-6);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-subtle);
}

.commission-inbox__list {
  display: grid;
  gap: var(--admin-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.commission-inbox__item {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) auto auto;
  gap: var(--admin-space-4);
  padding: var(--admin-space-4);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.commission-inbox__name {
  color: var(--admin-text-primary);
  font-weight: 600;
}

@media (max-width: 767px) {
  .commission-inbox__item {
    grid-template-columns: 1fr;
    gap: var(--admin-space-1);
  }
}
</style>

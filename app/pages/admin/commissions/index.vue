<script setup lang="ts">
import { commissionSubmissionListResponseSchema } from '~~/shared/schemas/commission'
import type {
  CommissionSubmissionListItemDto,
  CommissionSubmissionStatus,
} from '~~/shared/types/contracts'
import { includesSearchText } from '~~/shared/utils/search'
import {
  adminWorkPageCount,
  paginateAdminWorks,
} from '~/utils/admin-work-list'

definePageMeta({ layout: 'admin', ssr: false })
useSeoMeta({ title: '委托申请', robots: 'noindex, nofollow' })

const route = useRoute()
const adminApi = useAdminApi()
const items = ref<CommissionSubmissionListItemDto[]>([])
const pageStatus = ref<'error' | 'loading' | 'ready'>('loading')
const query = shallowRef('')
const page = shallowRef(1)
const pageSize = shallowRef(10)
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

const filteredItems = computed(() => items.value.filter(item => (
  includesSearchText(
    `${item.nickname} ${item.species ?? ''} ${item.receiptCode}`,
    query.value,
  )
)))
const pageCount = computed(() => adminWorkPageCount(filteredItems.value.length, pageSize.value))
const visibleItems = computed(() => paginateAdminWorks(
  filteredItems.value,
  page.value,
  pageSize.value,
))
const visibleFrom = computed(() => filteredItems.value.length === 0
  ? 0
  : (page.value - 1) * pageSize.value + 1)
const visibleTo = computed(() => Math.min(
  page.value * pageSize.value,
  filteredItems.value.length,
))

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

function removeDeleted(id: string) {
  items.value = items.value.filter(item => item.id !== id)
}

watch([query, pageSize, activeStatus], () => {
  page.value = 1
})
watch(pageCount, (count) => {
  if (page.value > count) {
    page.value = count
  }
})
watch(activeStatus, () => void load())
onMounted(() => void load())
</script>

<template>
  <AdminShell current="commissions">
    <div class="commission-inbox">
      <header class="commission-inbox__header">
        <div>
          <h1>委托申请</h1>
          <p>列表只显示昵称、物种、提交时间、状态与回执；联系方式在详情中按需查看。</p>
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

      <section
        v-if="pageStatus === 'ready' && items.length > 0"
        class="admin-list-toolbar commission-inbox__toolbar"
        aria-label="查找委托申请"
      >
        <div class="admin-list-toolbar__field">
          <label class="admin-list-toolbar__label" for="admin-commission-search">查找申请</label>
          <input
            id="admin-commission-search"
            v-model="query"
            class="admin-list-toolbar__control"
            type="search"
            placeholder="昵称、物种或回执编号"
            autocomplete="off"
          >
        </div>
        <p class="commission-inbox__count" role="status">
          {{ query.trim() ? `找到 ${filteredItems.length} / ${items.length} 条` : `共 ${items.length} 条` }}
        </p>
      </section>

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
      <div v-else-if="filteredItems.length === 0" class="commission-inbox__state">
        <p>没有符合条件的申请。</p>
        <button type="button" @click="query = ''">清除查找</button>
      </div>
      <template v-else>
        <ul class="commission-inbox__list" role="list">
          <li v-for="item in visibleItems" :key="item.id" class="commission-inbox__row">
            <NuxtLink :to="`/admin/commissions/${item.id}`" class="commission-inbox__item">
              <span class="commission-inbox__name">
                {{ item.nickname }} · {{ item.species ?? '物种待补录' }}
              </span>
              <span>{{ formatTime(item.createdAt) }}</span>
              <span>{{ item.receiptCode }}</span>
            </NuxtLink>
            <AdminCommissionDeletionAction
              :submission-id="item.id"
              :status="item.status"
              @deleted="removeDeleted(item.id)"
            />
          </li>
        </ul>
        <AdminPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :page-count="pageCount"
          :result-count="filteredItems.length"
          :visible-from="visibleFrom"
          :visible-to="visibleTo"
          label="委托申请分页"
          unit="条"
        />
      </template>
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

.commission-inbox__count {
  margin: 0;
  align-self: end;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

@media (min-width: 768px) {
  /* 与作品列表同一工具条模式：查找框为主，计数行贴底对齐。 */
  .admin-list-toolbar.commission-inbox__toolbar {
    grid-template-columns: minmax(14rem, 2fr) auto;
    align-items: end;
  }
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
  background: var(--admin-bg-primary);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.commission-inbox__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--admin-space-3);
}

.commission-inbox__name {
  color: var(--admin-text-primary);
  font-weight: 600;
}

@media (max-width: 767px) {
  .commission-inbox__row {
    grid-template-columns: 1fr;
  }

  .commission-inbox__item {
    grid-template-columns: 1fr;
    gap: var(--admin-space-1);
  }
}
</style>

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
const searchField = useTemplateRef<{ focus: () => void }>('searchField')
function clearSearch() { query.value = ''; searchField.value?.focus() }
function resetFilters() { clearSearch(); void navigateTo('/admin/commissions') }
const page = shallowRef(1)
const pageSize = shallowRef(10)
const activeStatus = computed<CommissionSubmissionStatus | 'all'>(() => (
  ['pending', 'accepted', 'rejected'].includes(String(route.query.status))
    ? route.query.status as CommissionSubmissionStatus
    : 'all'
))
const source = computed(() => ['website', 'qq', 'wechat', 'other'].includes(String(route.query.source)) ? String(route.query.source) : 'all')
const sourceOptions = [{ value: 'all', label: '全部来源' }, { value: 'website', label: '官网提交' }, { value: 'qq', label: '后台录入 · QQ' }, { value: 'wechat', label: '后台录入 · 微信' }, { value: 'other', label: '后台录入 · 其他' }]
function sourceHref(value: string | number) {
  return { path: '/admin/commissions', query: { ...(activeStatus.value === 'all' ? {} : { status: activeStatus.value }), ...(value === 'all' ? {} : { source: value }) } }
}
const statusOptions: Array<{ label: string, value: CommissionSubmissionStatus | 'all' }> = [
  { label: '全部状态', value: 'all' },
  { label: '待处理', value: 'pending' },
  { label: '已接受', value: 'accepted' },
  { label: '已拒绝', value: 'rejected' },
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

function statusHref(status: CommissionSubmissionStatus | 'all') {
  return { path: '/admin/commissions', query: { ...(status === 'all' ? {} : { status }), ...(source.value === 'all' ? {} : { source: source.value }) } }
}

let latestLoad = 0
async function load() {
  const request = ++latestLoad
  pageStatus.value = 'loading'
  try {
    const response = await adminApi(
      `/api/admin/v1/commissions?status=${activeStatus.value}&source=${source.value}`,
      { schema: commissionSubmissionListResponseSchema },
    )
    if (request !== latestLoad) return
    items.value = response.data
    pageStatus.value = 'ready'
  }
  catch {
    if (request === latestLoad) pageStatus.value = 'error'
  }
}

function removeDeleted(id: string) {
  items.value = items.value.filter(item => item.id !== id)
}

watch([query, pageSize, activeStatus, source], () => {
  page.value = 1
})
watch(pageCount, (count) => {
  if (page.value > count) {
    page.value = count
  }
})
watch([activeStatus, source], () => void load())
onMounted(() => void load())
</script>

<template>
  <AdminShell current="commissions">
    <div class="admin-list-page commission-inbox">
      <AdminPageHeader title="委托申请" :meta="pageStatus === 'ready' ? `共 ${items.length} 条申请` : undefined">
        <AdminAction to="/admin/commissions/new" variant="primary">录入申请</AdminAction>
        <AdminAction class="commission-inbox__refresh-desktop" :loading="pageStatus === 'loading'" loading-label="刷新中…" @click="load">刷新</AdminAction>
      </AdminPageHeader>

      <AdminListToolbar
        label="查找和筛选委托申请"
        :filters-active="Boolean(query || activeStatus !== 'all' || source !== 'all')"
        :result-count="filteredItems.length"
        :total-count="items.length"
        unit="条"
        @reset="resetFilters"
      >
        <template #actions>
          <AdminAction class="commission-inbox__refresh-mobile" :loading="pageStatus === 'loading'" loading-label="刷新中…" @click="load">刷新</AdminAction>
        </template>
        <AdminListSearch id="admin-commission-search" ref="searchField" v-model="query" label="查找申请" placeholder="昵称、物种或申请编号" />
        <div class="admin-list-toolbar__field">
          <label class="admin-list-toolbar__label" for="admin-commission-status">处理状态</label>
          <AdminSelect
            id="admin-commission-status"
            :model-value="activeStatus"
            :options="statusOptions"
            :disabled="pageStatus === 'loading'"
            @update:model-value="navigateTo(statusHref($event))"
          />
        </div>
        <div class="admin-list-toolbar__field">
          <label class="admin-list-toolbar__label" for="commission-source">来源</label>
          <AdminSelect id="commission-source" :model-value="source" :options="sourceOptions" @update:model-value="navigateTo(sourceHref($event))" />
        </div>
      </AdminListToolbar>

      <div v-if="pageStatus === 'loading'" class="commission-inbox__state" role="status">正在加载申请…</div>
      <div v-else-if="pageStatus === 'error'" class="commission-inbox__state" role="alert">
        <p>申请列表加载失败。</p>
        <AdminAction @click="load">重试</AdminAction>
      </div>
      <template v-else>
        <div v-if="items.length === 0" class="commission-inbox__state">当前状态下没有申请。</div>
        <div v-else-if="filteredItems.length === 0" class="commission-inbox__state">
          <p>没有符合条件的申请。</p>
          <AdminAction @click="clearSearch">清除查找</AdminAction>
        </div>
        <AdminCommissionListTable v-else :items="visibleItems" @deleted="removeDeleted" />
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
.commission-inbox__refresh-mobile { display: none; }
@media (max-width: 767px) {
  .commission-inbox__refresh-desktop { display: none; }
  .commission-inbox__refresh-mobile { display: inline-flex; }
}
.commission-inbox__state { padding: var(--admin-space-6); border: 1px solid var(--admin-border-secondary); border-radius: var(--admin-radius-md); background: var(--admin-bg-primary); text-align: center; }
</style>

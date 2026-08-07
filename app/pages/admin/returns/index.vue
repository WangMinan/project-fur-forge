<script setup lang="ts">
import {
  adminReturnPhotoListResponseSchema,
} from '~~/shared/schemas/return-photo'
import { workListResponseSchema } from '~~/shared/schemas/work'
import type {
  AdminReturnPhotoDto,
  WorkListItemDto,
} from '~~/shared/types/contracts'
import { PUBLICATION_STATUS_LABELS } from '~/utils/work-labels'

/**
 * T36 返图列表：一行一张返图，不显示“图片数”或相册概念。
 * 按关联作品与发布状态筛选，底部编号分页。
 */
definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '返图管理',
  robots: 'noindex, nofollow',
})

const adminApi = useAdminApi()
const status = ref<'error' | 'loading' | 'ready'>('loading')
const items = ref<AdminReturnPhotoDto[]>([])
const works = ref<WorkListItemDto[]>([])
const page = ref(1)
const pageCount = ref(0)
const resultCount = ref(0)
const workFilter = ref('')
const statusFilter = ref('')
/** 文本搜索在已取回的当页结果上做，匹配作品名与图片说明。 */
const query = ref('')

async function load() {
  status.value = 'loading'
  try {
    const query = new URLSearchParams({ page: String(page.value) })
    if (workFilter.value) {
      query.set('workId', workFilter.value)
    }
    if (statusFilter.value) {
      query.set('publicationStatus', statusFilter.value)
    }
    const response = await adminApi(
      `/api/admin/v1/returns?${query.toString()}`,
      { schema: adminReturnPhotoListResponseSchema },
    )
    items.value = response.data.items
    pageCount.value = response.data.pageCount
    resultCount.value = response.data.resultCount
    status.value = 'ready'
  }
  catch {
    status.value = 'error'
  }
}

async function loadWorks() {
  try {
    const response = await adminApi('/api/admin/v1/works', {
      schema: workListResponseSchema,
    })
    works.value = response.data
  }
  catch {
    works.value = []
  }
}

onMounted(async () => {
  await Promise.all([load(), loadWorks()])
})

watch([workFilter, statusFilter], () => {
  page.value = 1
  void load()
})

watch(page, () => {
  void load()
})

const filtersActive = computed(() => (
  workFilter.value !== '' || statusFilter.value !== '' || query.value.trim() !== ''
))

const visibleItems = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (keyword === '') {
    return items.value
  }
  return items.value.filter(item => (
    item.work.characterName.toLowerCase().includes(keyword)
    || item.alt.toLowerCase().includes(keyword)
  ))
})

/** 状态既有文字也有语义色，不只靠颜色表达。 */
function statusTone(value: 'draft' | 'published' | 'unpublished') {
  if (value === 'published') {
    return 'success' as const
  }
  return value === 'unpublished' ? 'warning' as const : 'neutral' as const
}

function resetFilters() {
  workFilter.value = ''
  statusFilter.value = ''
  query.value = ''
}
</script>

<template>
  <AdminShell current="returns">
    <section class="returns-admin">
      <header class="returns-admin__header">
        <div>
          <h1 class="returns-admin__title">返图管理</h1>
          <p class="returns-admin__meta">
            共 {{ resultCount }} 张。一条记录就是一张返图，公开展示在返图墙。
          </p>
        </div>
        <NuxtLink class="returns-admin__new" to="/admin/returns/new">
          新增返图
        </NuxtLink>
      </header>

      <div class="returns-admin__filters">
        <label class="returns-admin__field">
          <span>搜索</span>
          <input
            v-model="query"
            type="search"
            placeholder="作品名或图片说明"
          >
        </label>
        <label class="returns-admin__field">
          <span>关联作品</span>
          <select v-model="workFilter">
            <option value="">全部作品</option>
            <option v-for="work in works" :key="work.id" :value="work.id">
              {{ work.characterName }}
            </option>
          </select>
        </label>
        <label class="returns-admin__field">
          <span>发布状态</span>
          <select v-model="statusFilter">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="unpublished">已下架</option>
          </select>
        </label>
        <button
          v-if="filtersActive"
          type="button"
          class="returns-admin__reset"
          @click="resetFilters"
        >清除筛选</button>
      </div>

      <p v-if="status === 'loading'" class="returns-admin__state" role="status">
        正在加载返图…
      </p>
      <p v-else-if="status === 'error'" class="returns-admin__state" role="alert">
        返图列表加载失败，请稍后重试。
      </p>
      <p
        v-else-if="visibleItems.length === 0"
        class="returns-admin__state"
        data-testid="returns-empty"
      >
        {{ filtersActive ? '没有符合筛选条件的返图。' : '还没有返图。点击“新增返图”开始。' }}
      </p>

      <table v-else class="returns-table" aria-label="返图列表">
        <thead>
          <tr>
            <th scope="col">返图</th>
            <th scope="col">关联作品</th>
            <th scope="col">发布状态</th>
            <th scope="col">顺序</th>
            <th scope="col"><span class="visually-hidden">操作</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in visibleItems" :key="item.id">
            <td>
              <AdminReturnThumb :item="item" />
            </td>
            <td>
              <span class="returns-table__work">{{ item.work.characterName }}</span>
              <span class="returns-table__work-status">
                作品{{ PUBLICATION_STATUS_LABELS[item.work.publicationStatus] }}
              </span>
            </td>
            <td>
              <AdminStatusBadge
                :label="PUBLICATION_STATUS_LABELS[item.publicationStatus]"
                :tone="statusTone(item.publicationStatus)"
              />
            </td>
            <td>{{ item.sortOrder }}</td>
            <td>
              <NuxtLink
                class="returns-table__edit"
                :to="`/admin/returns/${item.id}`"
              >编辑</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>

      <nav
        v-if="pageCount > 1"
        class="returns-admin__pagination"
        aria-label="返图管理分页"
      >
        <button type="button" :disabled="page <= 1" @click="page -= 1">
          上一页
        </button>
        <span>第 {{ page }} / {{ pageCount }} 页</span>
        <button type="button" :disabled="page >= pageCount" @click="page += 1">
          下一页
        </button>
      </nav>
    </section>
  </AdminShell>
</template>

<style scoped>
.returns-admin__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--admin-space-4);
}

.returns-admin__title {
  font-size: var(--admin-font-xl);
  font-weight: 600;
}

.returns-admin__meta {
  margin-top: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.returns-admin__new {
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-touch-target);
  padding: 0 var(--admin-space-5);
  border-radius: var(--admin-radius-md);
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font-size: var(--admin-font-sm);
}

.returns-admin__new:hover {
  background: var(--admin-accent-hover);
  color: var(--admin-text-inverse);
}

.returns-admin__filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--admin-space-4);
  margin-top: var(--admin-space-6);
}

.returns-admin__field {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.returns-admin__field select,
.returns-admin__field input {
  min-height: var(--admin-control-height);
  min-width: 12rem;
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
}

.returns-admin__reset {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-4);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
  cursor: pointer;
}

.returns-admin__state {
  margin-top: var(--admin-space-6);
  padding: var(--admin-space-7);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  text-align: center;
}

.returns-table {
  width: 100%;
  margin-top: var(--admin-space-6);
  border-collapse: collapse;
  font-size: var(--admin-font-sm);
}

.returns-table th,
.returns-table td {
  padding: var(--admin-space-3);
  border-bottom: 1px solid var(--admin-border-secondary);
  text-align: left;
  vertical-align: middle;
}

.returns-table th {
  color: var(--admin-text-secondary);
  font-weight: 600;
}

.returns-table tbody tr {
  min-height: var(--admin-table-row-min);
}

.returns-table__work {
  display: block;
  color: var(--admin-text-primary);
}

.returns-table__work-status {
  display: block;
  margin-top: var(--admin-space-1);
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
}

.returns-table__edit {
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-touch-target);
  color: var(--admin-accent-primary);
}

.returns-admin__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--admin-space-3);
  margin-top: var(--admin-space-5);
  padding-top: var(--admin-space-4);
  border-top: 1px solid var(--admin-border-secondary);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.returns-admin__pagination button {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-4);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
  cursor: pointer;
}

.returns-admin__pagination button:disabled {
  opacity: 0.45;
  cursor: default;
}

@media (max-width: 767px) {
  .returns-table thead {
    display: none;
  }

  .returns-table tr {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--admin-space-2) var(--admin-space-3);
    padding: var(--admin-space-3) 0;
    border-bottom: 1px solid var(--admin-border-secondary);
  }

  .returns-table td {
    padding: 0;
    border: none;
  }
}
</style>

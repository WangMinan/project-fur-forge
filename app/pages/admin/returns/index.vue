<script setup lang="ts">
import {
  adminReturnCharacterListResponseSchema,
  deleteReturnCharacterResponseSchema,
} from '~~/shared/schemas/return-photo'
import type { AdminReturnCharacterListItemDto } from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'
import { ADMIN_WORK_PAGE_SIZES } from '~/utils/admin-work-list'

/**
 * T35-F1 返图管理：列出设定，不是单张照片。
 * 一个设定可以有多张返图，张数摘要显示在行内；分页与作品管理一致。
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
const items = ref<AdminReturnCharacterListItemDto[]>([])
const page = ref(1)
const pageSize = ref(ADMIN_WORK_PAGE_SIZES[0]!)
const pageCount = ref(0)
const resultCount = ref(0)
const query = ref('')
const deleteTarget = ref<AdminReturnCharacterListItemDto | null>(null)
const deleting = ref(false)
const actionError = ref<string | null>(null)

async function load() {
  status.value = 'loading'
  try {
    const search = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value),
    })
    if (query.value.trim() !== '') {
      search.set('query', query.value.trim())
    }
    const response = await adminApi(
      `/api/admin/v1/returns?${search.toString()}`,
      { schema: adminReturnCharacterListResponseSchema },
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

onMounted(() => {
  void load()
})

// 查找与每页条数变化都回到第一页，避免停在不存在的页码上。
watch([query, pageSize], () => {
  page.value = 1
  void load()
})

watch(page, () => {
  void load()
})

const visibleFrom = computed(() => (
  resultCount.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1
))
const visibleTo = computed(
  () => Math.min(page.value * pageSize.value, resultCount.value),
)

/** 删除设定会连带删除它的返图；已发布的返图先自动下架。 */
async function deleteCharacter() {
  const target = deleteTarget.value
  if (!target || deleting.value) {
    return
  }
  deleting.value = true
  try {
    await adminApi(`/api/admin/v1/returns/${target.id}`, {
      method: 'DELETE',
      body: { expectedVersion: target.version, payload: {} },
      schema: deleteReturnCharacterResponseSchema,
    })
    deleteTarget.value = null
    await load()
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    deleteTarget.value = null
    actionError.value = error instanceof AdminApiError && error.status === 409
      ? '设定已在别处修改，未删除。请刷新后重试。'
      : '删除失败，请稍后重试。'
    // 删除可能已部分完成，重新读取真实状态。
    await load()
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <AdminShell current="returns">
    <section class="returns-admin">
      <header class="returns-admin__header">
        <div>
          <h1 class="returns-admin__title">返图管理</h1>
          <p class="returns-admin__meta">共 {{ resultCount }} 个设定</p>
        </div>
        <NuxtLink class="returns-admin__new" to="/admin/returns/new">
          新增设定
        </NuxtLink>
      </header>

      <div class="returns-admin__filters">
        <label class="returns-admin__field">
          <span>查找</span>
          <input v-model="query" type="search" placeholder="名称或昵称">
        </label>
      </div>

      <p v-if="status === 'loading'" class="returns-admin__state" role="status">
        正在加载…
      </p>
      <p v-else-if="status === 'error'" class="returns-admin__state" role="alert">
        加载失败，请稍后重试。
      </p>
      <p
        v-else-if="items.length === 0"
        class="returns-admin__state"
        data-testid="returns-empty"
      >
        {{ query.trim() === '' ? '还没有设定。点击“新增设定”开始。' : '没有匹配的设定。' }}
      </p>

      <template v-else>
        <table class="returns-table" aria-label="返图设定列表">
          <thead>
            <tr>
              <th scope="col">主图</th>
              <th scope="col">设定</th>
              <th scope="col">返图</th>
              <th scope="col">关联作品</th>
              <th scope="col"><span class="visually-hidden">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>
                <AdminReturnThumb
                  :asset-id="item.primaryAssetId"
                  :name="item.name"
                />
              </td>
              <td>
                <NuxtLink
                  class="returns-table__name"
                  :to="`/admin/returns/${item.id}`"
                >{{ item.name }}</NuxtLink>
                <span v-if="item.nickname" class="returns-table__nickname">
                  @{{ item.nickname }}
                </span>
              </td>
              <td>
                <span class="returns-table__counts">
                  {{ item.photoCount }} 张
                </span>
                <span class="returns-table__published">
                  已发布 {{ item.publishedPhotoCount }} 张
                </span>
              </td>
              <td>
                <span v-if="item.work" class="returns-table__work">
                  {{ item.work.characterName }}
                </span>
                <span v-else class="returns-table__work-none">未关联</span>
              </td>
              <td>
                <div class="returns-table__actions">
                  <NuxtLink
                    class="returns-table__edit"
                    :to="`/admin/returns/${item.id}`"
                  >编辑</NuxtLink>
                  <button
                    type="button"
                    class="returns-table__delete"
                    :aria-label="`删除 ${item.name}`"
                    @click="deleteTarget = item"
                  >删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <AdminPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          label="返图设定分页"
          unit="个"
          :page-count="pageCount"
          :result-count="resultCount"
          :visible-from="visibleFrom"
          :visible-to="visibleTo"
        />
      </template>

      <AdminConfirmDialog
        :open="deleteTarget !== null"
        :title="deleteTarget ? `删除「${deleteTarget.name}」？` : '删除设定？'"
        :confirm-label="deleting ? '删除中…' : '确认删除'"
        tone="danger"
        @confirm="deleteCharacter"
        @cancel="deleteTarget = null"
      >
        <p>
          这个设定
          <template v-if="deleteTarget && deleteTarget.photoCount > 0">
            及它的 {{ deleteTarget.photoCount }} 张返图
          </template>
          会被删除，已发布的返图会先下架。私有原图保留。此操作无法撤销。
        </p>
      </AdminConfirmDialog>

      <AdminConfirmDialog
        :open="actionError !== null"
        title="设定未删除"
        confirm-label="知道了"
        :show-cancel="false"
        @confirm="actionError = null"
        @cancel="actionError = null"
      >
        <p role="alert">{{ actionError }}</p>
      </AdminConfirmDialog>
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

.returns-admin__state {
  margin-top: var(--admin-space-6);
  padding: var(--admin-space-7);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  text-align: center;
}

/* 白底表格，与 /admin/works 一致。 */
.returns-table {
  width: 100%;
  margin-top: var(--admin-space-6);
  border-collapse: collapse;
  background: var(--admin-bg-primary);
  font-size: var(--admin-font-sm);
}

.returns-table tbody tr:hover {
  background: var(--admin-bg-workspace);
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

.returns-table__name {
  display: block;
  color: var(--admin-text-primary);
  font-weight: 600;
}

.returns-table__name:hover {
  color: var(--admin-accent-primary);
}

.returns-table__nickname,
.returns-table__published,
.returns-table__work-none {
  display: block;
  margin-top: var(--admin-space-1);
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
}

.returns-table__counts,
.returns-table__work {
  display: block;
}

.returns-table__actions {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
}

.returns-table__edit {
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-touch-target);
  color: var(--admin-accent-primary);
}

.returns-table__delete {
  min-height: var(--admin-touch-target);
  padding: 0;
  color: var(--admin-danger);
  background: none;
  border: none;
  font: inherit;
  cursor: pointer;
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

<script setup lang="ts">
import {
  deleteWorkResponseSchema,
  managedWorkResponseSchema,
  workListResponseSchema,
} from '~~/shared/schemas/work'
import type { WorkListItemDto } from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'
import {
  BUSINESS_STATUS_LABELS,
  PUBLICATION_STATUS_LABELS,
  SUIT_TYPE_LABELS,
  WORK_PURPOSE_LABELS,
} from '~/utils/work-labels'
import { formatCnyMinorUnits } from '~/utils/format'
import { workApiErrorText } from '~/utils/work-errors'
import {
  PUBLIC_FEATURED_LIMIT,
  toWorkFieldsPayload,
  workFormFromDto,
} from '~/utils/work-form'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '作品管理',
  robots: 'noindex, nofollow',
})

const adminApi = useAdminApi()
const status = ref<'error' | 'loading' | 'ready'>('loading')
const works = ref<WorkListItemDto[]>([])
const deleteTarget = ref<WorkListItemDto | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

const orderingPendingId = ref<string | null>(null)
const orderingErrors = ref<Record<string, string>>({})

const PUBLICATION_TONES = {
  draft: 'warning',
  published: 'success',
  unpublished: 'neutral',
} as const

/** 公开首页只消费已发布的精选，超出上限时给出可核对的提示。 */
const publishedFeaturedCount = computed(() => works.value.filter(
  work => work.featured && work.publicationStatus === 'published',
).length)

function adoptionSummary(work: WorkListItemDto) {
  if (work.purpose !== 'adoption') {
    return null
  }
  const status = work.businessStatus
    ? BUSINESS_STATUS_LABELS[work.businessStatus]
    : '状态未记录'
  const price = work.priceCnyMinor === null
    ? '不公开价格'
    : formatCnyMinorUnits(work.priceCnyMinor)
  return `${status} · ${price}`
}

async function loadWorks() {
  status.value = 'loading'
  try {
    const result = await adminApi('/api/admin/v1/works', {
      schema: workListResponseSchema,
    })
    works.value = result.data
    status.value = 'ready'
  }
  catch {
    status.value = 'error'
  }
}

/**
 * 列表内改排序或精选：先读当前完整字段，再带列表持有的资源版本提交。
 * 版本过期时由服务端返回 409，不在客户端伪造成功。
 */
async function updateOrdering(
  work: WorkListItemDto,
  patch: { featured?: boolean, sortOrder?: number },
) {
  if (orderingPendingId.value !== null) {
    return
  }
  orderingPendingId.value = work.id
  orderingErrors.value = Object.fromEntries(
    Object.entries(orderingErrors.value).filter(([id]) => id !== work.id),
  )
  try {
    const current = await adminApi(`/api/admin/v1/works/${work.id}`, {
      schema: managedWorkResponseSchema,
    })
    const form = workFormFromDto(current.data)
    if (patch.sortOrder !== undefined) {
      form.sortOrder = String(patch.sortOrder)
    }
    if (patch.featured !== undefined) {
      form.featured = patch.featured
    }
    await adminApi(`/api/admin/v1/works/${work.id}`, {
      method: 'PUT',
      body: {
        expectedVersion: work.version,
        payload: toWorkFieldsPayload(form),
      },
      schema: managedWorkResponseSchema,
    })
    await loadWorks()
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    orderingErrors.value = {
      ...orderingErrors.value,
      [work.id]: workApiErrorText(error, '保存失败，请刷新后重试。'),
    }
  }
  finally {
    orderingPendingId.value = null
  }
}

async function deleteWork() {
  const target = deleteTarget.value
  if (!target || deleting.value) {
    return
  }
  deleting.value = true
  deleteError.value = null
  try {
    await adminApi(`/api/admin/v1/works/${target.id}`, {
      method: 'DELETE',
      body: { expectedVersion: target.version, payload: {} },
      schema: deleteWorkResponseSchema,
    })
    works.value = works.value.filter(work => work.id !== target.id)
    deleteTarget.value = null
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    deleteTarget.value = null
    deleteError.value = error instanceof AdminApiError && error.status === 409
      ? '作品已发布或版本发生变化，请先刷新；已发布作品需先下架。'
      : '删除失败，请稍后重试。作品内容未被删除。'
  }
  finally {
    deleting.value = false
  }
}

onMounted(() => {
  void loadWorks()
})
</script>

<template>
  <AdminShell current="works">
    <div class="works-page">
      <header class="works-page__header">
        <h1 class="works-page__title">作品管理</h1>
        <p v-if="status === 'ready'" class="works-page__meta">
          共 {{ works.length }} 件
        </p>
        <NuxtLink to="/admin/works/new" class="works-page__create">创建作品</NuxtLink>
      </header>

      <div v-if="status === 'loading'" class="works-page__notice" role="status">
        正在加载作品列表…
      </div>

      <div v-else-if="status === 'error'" class="works-page__notice works-page__notice--error">
        <p role="alert">作品列表加载失败，请检查网络连接后重试。</p>
        <button type="button" class="works-page__retry" @click="loadWorks">重试</button>
      </div>

      <p v-if="deleteError" class="works-page__delete-error" role="alert">
        {{ deleteError }}
      </p>

      <p
        v-if="status === 'ready' && publishedFeaturedCount > PUBLIC_FEATURED_LIMIT"
        class="works-page__featured-warning"
        role="status"
      >
        已发布精选 {{ publishedFeaturedCount }} 件，首页精选轨道只显示排序最前的
        {{ PUBLIC_FEATURED_LIMIT }} 件；正式内容建议保持 3–{{ PUBLIC_FEATURED_LIMIT }} 件。
      </p>

      <div v-if="status === 'ready' && works.length === 0" class="works-page__empty">
        <p class="works-page__empty-title">暂无作品</p>
        <p class="works-page__empty-text">创建第一件作品，上传出厂照后即可发布。</p>
        <NuxtLink to="/admin/works/new" class="works-page__create">创建第一件作品</NuxtLink>
      </div>

      <template v-else-if="status === 'ready'">
        <table class="works-table">
          <caption class="sr-only">作品列表</caption>
          <thead>
            <tr>
              <th scope="col">作品</th>
              <th scope="col">用途</th>
              <th scope="col">排序 / 精选</th>
              <th scope="col">发布状态</th>
              <th scope="col">出厂照</th>
              <th scope="col"><span class="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="work in works" :key="work.id">
              <td>
                <div class="works-table__work">
                  <span class="works-table__name">
                    <NuxtLink :to="`/admin/works/${work.id}`" class="works-table__link">
                      {{ work.characterName }}
                    </NuxtLink>
                    <span class="works-table__species">
                      {{ work.species }} · {{ SUIT_TYPE_LABELS[work.suitType] }}
                    </span>
                  </span>
                </div>
              </td>
              <td>
                <span class="works-table__purpose">{{ WORK_PURPOSE_LABELS[work.purpose] }}</span>
                <span v-if="adoptionSummary(work)" class="works-table__adoption">
                  {{ adoptionSummary(work) }}
                </span>
              </td>
              <td>
                <AdminWorkOrderingControls
                  scope="table"
                  :work="work"
                  :pending="orderingPendingId === work.id"
                  :error="orderingErrors[work.id] ?? null"
                  @update="updateOrdering(work, $event)"
                />
              </td>
              <td>
                <AdminStatusBadge
                  :tone="PUBLICATION_TONES[work.publicationStatus]"
                  :label="PUBLICATION_STATUS_LABELS[work.publicationStatus]"
                />
              </td>
              <td>
                <span class="works-table__media">{{ work.studioPhotoCount }}/5</span>
              </td>
              <td>
                <div class="works-table__actions">
                  <NuxtLink :to="`/admin/works/${work.id}`" class="works-table__edit">编辑</NuxtLink>
                  <button
                    type="button"
                    class="works-table__delete"
                    :aria-label="`删除 ${work.characterName}`"
                    @click="deleteTarget = work"
                  >删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <ul class="works-cards" role="list">
          <li v-for="work in works" :key="work.id" class="works-card">
            <div class="works-card__body">
              <p class="works-card__name">
                {{ work.characterName }}
                <span class="works-card__meta">{{ work.species }} · {{ SUIT_TYPE_LABELS[work.suitType] }}</span>
              </p>
              <p class="works-card__row">
                {{ WORK_PURPOSE_LABELS[work.purpose] }}
                <AdminStatusBadge
                  :tone="PUBLICATION_TONES[work.publicationStatus]"
                  :label="PUBLICATION_STATUS_LABELS[work.publicationStatus]"
                />
              </p>
              <p v-if="adoptionSummary(work)" class="works-card__row works-card__row--muted">
                {{ adoptionSummary(work) }}
              </p>
              <AdminWorkOrderingControls
                scope="card"
                :work="work"
                :pending="orderingPendingId === work.id"
                :error="orderingErrors[work.id] ?? null"
                @update="updateOrdering(work, $event)"
              />
              <p class="works-card__row works-card__row--muted">
                出厂照 {{ work.studioPhotoCount }}/5
              </p>
            </div>
            <div class="works-card__actions">
              <NuxtLink :to="`/admin/works/${work.id}`" class="works-card__edit">编辑</NuxtLink>
              <button
                type="button"
                class="works-card__delete"
                :aria-label="`删除 ${work.characterName}`"
                @click="deleteTarget = work"
              >删除</button>
            </div>
          </li>
        </ul>
      </template>

      <AdminConfirmDialog
        :open="deleteTarget !== null"
        :title="deleteTarget ? `删除「${deleteTarget.characterName}」？` : '删除作品？'"
        :confirm-label="deleting ? '删除中…' : '确认删除'"
        tone="danger"
        @confirm="deleteWork"
        @cancel="deleteTarget = null"
      >
        <p>作品资料与媒体关联将删除，公开衍生图会先清理；私有原图保留。已发布作品必须先下架。此操作无法撤销。</p>
      </AdminConfirmDialog>
    </div>
  </AdminShell>
</template>

<style scoped>
.works-page {
  max-width: var(--admin-content-max);
}

.works-page__header {
  display: flex;
  align-items: baseline;
  gap: var(--admin-space-4);
  flex-wrap: wrap;
  margin-bottom: var(--admin-space-5);
}

.works-page__title {
  margin: 0;
  font-size: var(--admin-font-xl);
  font-weight: 600;
  line-height: var(--admin-line-tight);
}

.works-page__meta {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.works-page__create {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border-radius: var(--admin-radius-md);
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font-weight: 600;
}

.works-page__create:hover {
  background: var(--admin-accent-hover);
}

.works-page__notice {
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-6);
  text-align: center;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.works-page__notice--error {
  display: grid;
  gap: var(--admin-space-3);
  justify-items: center;
  color: var(--admin-status-error);
}

.works-page__notice--error p {
  margin: 0;
}

.works-page__featured-warning {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  color: var(--admin-status-warning);
  background: var(--admin-status-warning-soft);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.works-table__purpose {
  display: block;
}

.works-table__adoption {
  display: block;
  margin-top: 0.1rem;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.works-page__delete-error {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  color: var(--admin-status-error);
  background: var(--admin-status-error-soft);
  font-size: var(--admin-font-sm);
}

.works-page__retry {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-accent-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.works-page__empty {
  background: var(--admin-bg-primary);
  border: 1px dashed var(--admin-border-primary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-8);
  text-align: center;
  display: grid;
  gap: var(--admin-space-2);
  justify-items: center;
}

.works-page__empty-title {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.works-page__empty-text {
  margin: 0 0 var(--admin-space-3);
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.works-page__empty .works-page__create {
  margin-left: 0;
}

.works-table {
  display: none;
  width: 100%;
  border-collapse: collapse;
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
}

.works-table th {
  text-align: left;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  color: var(--admin-text-secondary);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-bottom: 1px solid var(--admin-border-secondary);
  white-space: nowrap;
}

.works-table td {
  padding: var(--admin-space-3) var(--admin-space-4);
  border-bottom: 1px solid var(--admin-border-secondary);
  font-size: var(--admin-font-sm);
  vertical-align: middle;
}

.works-table tbody tr:last-child td {
  border-bottom: none;
}

.works-table tbody tr:hover {
  background: var(--admin-bg-workspace);
}

.works-table__work {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
}

.works-table__name {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.works-table__link {
  font-weight: 600;
  color: var(--admin-text-primary);
}

.works-table__link:hover {
  color: var(--admin-accent-primary);
}

.works-table__species {
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.works-table__media {
  white-space: nowrap;
  color: var(--admin-text-secondary);
}

.works-table__edit {
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-touch-target);
  color: var(--admin-accent-primary);
  font-weight: 600;
  white-space: nowrap;
}

.works-table__actions,
.works-card__actions {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
}

.works-table__delete,
.works-card__delete {
  min-height: var(--admin-touch-target);
  padding: 0;
  color: var(--admin-danger);
  background: none;
  border: none;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.works-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--admin-space-3);
}

.works-card {
  display: flex;
  gap: var(--admin-space-3);
  align-items: flex-start;
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  padding: var(--admin-space-3);
}

.works-card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
}

.works-card__name {
  margin: 0;
  font-weight: 600;
}

.works-card__meta {
  display: block;
  font-weight: 400;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.works-card__row {
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
  font-size: var(--admin-font-sm);
}

.works-card__row--muted {
  font-size: var(--admin-font-xs);
  color: var(--admin-text-secondary);
}

.works-card__edit {
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-touch-target);
  color: var(--admin-accent-primary);
  font-weight: 600;
}

.works-card__actions {
  margin-left: auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
}

@media (min-width: 1024px) {
  .works-table {
    display: table;
  }

  .works-cards {
    display: none;
  }
}
</style>

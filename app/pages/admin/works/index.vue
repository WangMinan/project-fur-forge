<script setup lang="ts">
import {
  deleteWorkResponseSchema,
  managedWorkResponseSchema,
  workListResponseSchema,
} from '~~/shared/schemas/work'
import type {
  WorkListItemDto,
  WorkPublicationCheckDto,
} from '~~/shared/types/contracts'
import { workPublicationCheckResponseSchema } from '~~/shared/schemas/publication'
import { AdminApiError } from '~/composables/useAdminApi'
import {
  BUSINESS_STATUS_LABELS,
  PUBLICATION_STATUS_LABELS,
  SUIT_TYPE_LABELS,
  WORK_PURPOSE_LABELS,
} from '~/utils/work-labels'
import { formatCnyMinorUnits } from '~/utils/format'
import { workApiErrorText } from '~/utils/work-errors'
import { PUBLIC_FEATURED_LIMIT } from '~/utils/work-form'
import { PUBLICATION_BLOCKER_LABELS } from '~/utils/media-labels'
import { ADMIN_MEDIA_CARD_PREVIEW_WIDTH } from '~~/shared/constants/admin-media-preview'
import { adminMediaPreviewUrl } from '~/utils/admin-media-preview'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '作品管理',
  robots: 'noindex, nofollow',
})

const adminApi = useAdminApi()
const route = useRoute()
const activeTab = computed(() => route.query.tab === 'featured' ? 'featured' : 'all')
const status = ref<'error' | 'loading' | 'ready'>('loading')
const works = ref<WorkListItemDto[]>([])
const featuredOrder = useFeaturedWorkOrder()
const {
  filteredWorks,
  filtersActive,
  page,
  pageCount,
  pageSize,
  publicationStatus,
  purpose,
  query,
  resetFilters,
  suitType,
  visibleFrom,
  visibleTo,
  visibleWorks,
} = useAdminWorkListView(works)
const publicationChecks = ref<Record<string, WorkPublicationCheckDto | null>>({})
const deleteTarget = ref<WorkListItemDto | null>(null)
const deleting = ref(false)
const actionError = ref<{ message: string, title: string } | null>(null)

const orderingPendingId = ref<string | null>(null)
const featuredRemovingId = ref<string | null>(null)

const PUBLICATION_TONES = {
  draft: 'warning',
  published: 'success',
  unpublished: 'neutral',
} as const

/** 公开首页只消费已发布的精选，超出上限时给出可核对的提示。 */
const publishedFeaturedCount = computed(() => works.value.filter(
  work => work.featured && work.publicationStatus === 'published',
).length)

/**
 * 列表缩略图用哪张资产。
 *
 * 领养作品可以只有设定图、没有出厂照（这是允许的发布形态），
 * 这时用设定图当缩略图，不留空。
 */
function thumbAssetId(work: WorkListItemDto) {
  return work.primaryAssetId
    ?? (work.purpose === 'adoption' ? work.designSheetAssetId : null)
}

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

function blockerSummary(work: WorkListItemDto) {
  if (work.publicationStatus === 'published') {
    return '当前已发布'
  }
  const check = publicationChecks.value[work.id]
  if (!check) {
    return '发布检查暂不可用'
  }
  if (check.canPublish) {
    return '无发布阻断'
  }
  const labels = check.blockers.slice(0, 2).map(
    blocker => PUBLICATION_BLOCKER_LABELS[blocker],
  )
  return `${labels.join('；')}${check.blockers.length > 2 ? `；另 ${check.blockers.length - 2} 项` : ''}`
}

async function loadWorks() {
  status.value = 'loading'
  try {
    const result = await adminApi('/api/admin/v1/works', {
      schema: workListResponseSchema,
    })
    works.value = result.data
    const checks = await Promise.all(result.data.map(async (work) => {
      try {
        const response = await adminApi(
          `/api/admin/v1/works/${work.id}/publication-check`,
          { schema: workPublicationCheckResponseSchema },
        )
        return [work.id, response.data] as const
      }
      catch {
        return [work.id, null] as const
      }
    }))
    publicationChecks.value = Object.fromEntries(checks)
    status.value = 'ready'
  }
  catch {
    status.value = 'error'
  }
}

/** 已发布作品也走展示设置接口；完整作品字段仍保留下架门禁。 */
async function updateOrdering(
  work: WorkListItemDto,
  patch: { featured: boolean },
) {
  if (orderingPendingId.value !== null) {
    return
  }
  orderingPendingId.value = work.id
  try {
    await adminApi(`/api/admin/v1/works/${work.id}/presentation`, {
      method: 'PUT',
      body: {
        expectedVersion: work.version,
        payload: { featured: patch.featured },
      },
      schema: managedWorkResponseSchema,
    })
    await loadWorks()
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    actionError.value = {
      title: '精选设置未保存',
      message: workApiErrorText(error, '保存失败，请刷新后重试。'),
    }
    // 原生 checkbox 在 change 后会先改变 DOM 状态；失败时重新读取服务端真值，
    // 避免“提示未保存但界面仍显示已勾选”的误导。
    await loadWorks()
  }
  finally {
    orderingPendingId.value = null
  }
}

async function removeFeatured(work: WorkListItemDto) {
  if (featuredRemovingId.value !== null || featuredOrder.pendingId.value !== null) {
    return
  }
  featuredRemovingId.value = work.id
  try {
    await adminApi(`/api/admin/v1/works/${work.id}/presentation`, {
      method: 'PUT',
      body: {
        expectedVersion: work.version,
        payload: { featured: false },
      },
      schema: managedWorkResponseSchema,
    })
    await featuredOrder.load()
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    actionError.value = {
      title: '未移出首页精选',
      message: workApiErrorText(error, '保存失败，已保留原顺序，请重新加载后重试。'),
    }
    await featuredOrder.load()
  }
  finally {
    featuredRemovingId.value = null
  }
}

async function deleteWork() {
  const target = deleteTarget.value
  if (!target || deleting.value) {
    return
  }
  deleting.value = true
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
    actionError.value = {
      title: '作品未删除',
      message: error instanceof AdminApiError && error.status === 409
        ? '作品已发布或版本发生变化，请先刷新；已发布作品需先下架。'
        : '删除失败，请稍后重试。作品内容未被删除。',
    }
  }
  finally {
    deleting.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'featured') {
    void featuredOrder.load()
  }
  else {
    void loadWorks()
  }
}, { immediate: true })
</script>

<template>
  <AdminShell current="works">
    <div class="admin-list-page works-page">
      <header class="admin-list-page__header">
        <h1 class="admin-list-page__title">作品管理</h1>
        <p v-if="activeTab === 'all' && status === 'ready'" class="admin-list-page__meta">
          共 {{ works.length }} 件作品
        </p>
        <p v-else-if="activeTab === 'featured' && featuredOrder.status.value === 'ready'" class="admin-list-page__meta">
          共 {{ featuredOrder.items.value.length }} 件精选
        </p>
        <NuxtLink to="/admin/works/new" class="admin-list-page__create">
          创建作品
        </NuxtLink>
      </header>

      <nav class="works-tabs" aria-label="作品管理视图">
        <NuxtLink
          to="/admin/works"
          class="works-tabs__item"
          :aria-current="activeTab === 'all' ? 'page' : undefined"
        >全部作品</NuxtLink>
        <NuxtLink
          to="/admin/works?tab=featured"
          class="works-tabs__item"
          :aria-current="activeTab === 'featured' ? 'page' : undefined"
        >首页精选</NuxtLink>
      </nav>

      <div v-if="activeTab === 'all' && status === 'loading'" class="works-page__notice" role="status">
        正在加载作品列表…
      </div>

      <div v-else-if="activeTab === 'all' && status === 'error'" class="works-page__notice works-page__notice--error">
        <p role="alert">作品列表加载失败，请检查网络连接后重试。</p>
        <button type="button" class="works-page__retry" @click="loadWorks">重试</button>
      </div>

      <p
        v-if="activeTab === 'all' && status === 'ready' && publishedFeaturedCount > PUBLIC_FEATURED_LIMIT"
        class="works-page__featured-warning"
        role="status"
      >
        已发布精选 {{ publishedFeaturedCount }} 件，首页只显示排序最前的
        {{ PUBLIC_FEATURED_LIMIT }} 件。
      </p>

      <AdminWorkListToolbar
        v-if="activeTab === 'all' && status === 'ready' && works.length > 0"
        v-model:query="query"
        v-model:purpose="purpose"
        v-model:suit-type="suitType"
        v-model:publication-status="publicationStatus"
        :filters-active="filtersActive"
        :result-count="filteredWorks.length"
        :total-count="works.length"
        @reset="resetFilters"
      />

      <div v-if="activeTab === 'all' && status === 'ready' && works.length === 0" class="works-page__empty">
        <p class="works-page__empty-title">暂无作品</p>
        <p class="works-page__empty-text">创建第一件作品，上传出厂照后即可发布。</p>
        <NuxtLink to="/admin/works/new" class="admin-list-page__create">
          创建第一件作品
        </NuxtLink>
      </div>

      <div
        v-else-if="activeTab === 'all' && status === 'ready' && filteredWorks.length === 0"
        class="works-page__empty"
      >
        <p class="works-page__empty-title">没有符合条件的作品</p>
        <p class="works-page__empty-text">换一个关键词或筛选条件后再试。</p>
        <button type="button" class="works-page__reset" @click="resetFilters">清除查找与筛选</button>
      </div>

      <template v-else-if="activeTab === 'all' && status === 'ready'">
        <table class="admin-list-table works-table" aria-label="作品管理表格">
          <thead>
            <tr>
              <th scope="col">作品</th>
              <th scope="col">用途</th>
              <th scope="col">首页精选</th>
              <th scope="col">发布状态</th>
              <th scope="col">媒体</th>
              <th scope="col">发布阻断</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="work in visibleWorks" :key="work.id">
              <td>
                <div class="works-table__work">
                  <span class="works-table__thumb">
                    <!-- 低分辨率缩略图：表格格子只有 3rem，不需要原图。 -->
                    <img
                      v-if="thumbAssetId(work)"
                      :src="adminMediaPreviewUrl(thumbAssetId(work)!, ADMIN_MEDIA_CARD_PREVIEW_WIDTH)"
                      alt=""
                      loading="lazy"
                      referrerpolicy="same-origin"
                    >
                    <span v-else aria-hidden="true">无图</span>
                  </span>
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
                <span class="works-table__media">
                  设定图 {{ work.purpose === 'adoption' && work.designSheetAssetId ? '有' : work.purpose === 'adoption' ? '无' : '—' }}
                  · 出厂照 {{ work.studioPhotoCount }}/5
                </span>
                <span class="works-table__media-links">
                  <NuxtLink
                    v-if="work.purpose === 'adoption'"
                    :to="`/admin/works/${work.id}#design-sheet`"
                  >设定图</NuxtLink>
                  <NuxtLink :to="`/admin/works/${work.id}#studio-photos`">出厂照</NuxtLink>
                </span>
              </td>
              <td>
                <span class="works-table__blockers">{{ blockerSummary(work) }}</span>
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
          <li v-for="work in visibleWorks" :key="work.id" class="works-card">
            <span class="works-card__thumb">
              <img
                v-if="thumbAssetId(work)"
                :src="adminMediaPreviewUrl(thumbAssetId(work)!, ADMIN_MEDIA_CARD_PREVIEW_WIDTH)"
                alt=""
                loading="lazy"
                referrerpolicy="same-origin"
              >
              <span v-else aria-hidden="true">无图</span>
            </span>
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
                @update="updateOrdering(work, $event)"
              />
              <p class="works-card__row works-card__row--muted">
                设定图 {{ work.purpose === 'adoption' && work.designSheetAssetId ? '有' : work.purpose === 'adoption' ? '无' : '—' }}
                · 出厂照 {{ work.studioPhotoCount }}/5
              </p>
              <p class="works-card__row works-card__row--muted">{{ blockerSummary(work) }}</p>
              <p class="works-card__row works-card__quick-links">
                <NuxtLink
                  v-if="work.purpose === 'adoption'"
                  :to="`/admin/works/${work.id}#design-sheet`"
                >编辑设定图</NuxtLink>
                <NuxtLink :to="`/admin/works/${work.id}#studio-photos`">编辑出厂照</NuxtLink>
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

        <AdminPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :page-count="pageCount"
          :result-count="filteredWorks.length"
          :visible-from="visibleFrom"
          :visible-to="visibleTo"
        />
      </template>

      <AdminFeaturedWorkOrderPanel
        v-if="activeTab === 'featured'"
        :error="featuredOrder.error.value"
        :items="featuredOrder.items.value"
        :pending-id="featuredOrder.pendingId.value"
        :removing-id="featuredRemovingId"
        :status="featuredOrder.status.value"
        @move="featuredOrder.move"
        @reload="featuredOrder.load"
        @remove="removeFeatured"
      />

      <AdminConfirmDialog
        :open="deleteTarget !== null"
        :title="deleteTarget ? `删除「${deleteTarget.characterName}」？` : '删除作品？'"
        :confirm-label="deleting ? '删除中…' : '确认删除'"
        tone="danger"
        @confirm="deleteWork"
        @cancel="deleteTarget = null"
      >
        <p>作品资料与公开图片会被删除，私有原图保留。此操作无法撤销。</p>
      </AdminConfirmDialog>

      <AdminConfirmDialog
        :open="actionError !== null"
        :title="actionError?.title ?? '操作未完成'"
        confirm-label="知道了"
        :show-cancel="false"
        @confirm="actionError = null"
        @cancel="actionError = null"
      >
        <p role="alert">{{ actionError?.message }}</p>
      </AdminConfirmDialog>
    </div>
  </AdminShell>
</template>

<style scoped>
/* 页头、主操作与表格样式来自 admin-base.css 的 .admin-list-* 共用类。 */

.works-tabs {
  display: flex;
  gap: var(--admin-space-1);
  width: fit-content;
  max-width: 100%;
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-1);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-subtle);
}

.works-tabs__item {
  min-height: var(--admin-control-height);
  display: inline-flex;
  align-items: center;
  padding: 0 var(--admin-space-4);
  border: 1px solid transparent;
  border-radius: var(--admin-radius-sm);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  font-weight: 600;
  text-decoration: none;
}

.works-tabs__item[aria-current='page'] {
  border-color: var(--admin-border-secondary);
  background: var(--admin-bg-primary);
  color: var(--admin-accent-primary);
}

.works-tabs__item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--admin-focus-width) var(--admin-focus-ring);
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

.works-page__reset {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.works-page__reset:hover {
  background: var(--admin-bg-subtle);
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

/* 空态里的按钮居中，不沿用页头那条靠右的 margin-left: auto。 */
.works-page__empty .admin-list-page__create {
  margin-left: 0;
}

/* 表格本体样式来自 .admin-list-table；这里只控制窄屏改用卡片列表。 */
.works-table {
  display: none;
}

.works-table__work {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
}

.works-table__thumb {
  flex: none;
  width: 3rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-subtle);
  color: var(--admin-text-tertiary);
  font-size: 0.625rem;
}

.works-table__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  display: block;
  white-space: nowrap;
  color: var(--admin-text-secondary);
}

.works-table__media-links {
  display: flex;
  gap: var(--admin-space-2);
  margin-top: var(--admin-space-1);
  font-size: var(--admin-font-xs);
}

.works-table__blockers {
  display: block;
  max-width: 18rem;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
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

.works-card__thumb {
  flex: none;
  width: 4rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-subtle);
  color: var(--admin-text-tertiary);
  font-size: 0.625rem;
}

.works-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.works-card__quick-links a {
  color: var(--admin-accent-primary);
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

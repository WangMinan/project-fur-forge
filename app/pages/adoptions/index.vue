<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicAdoptionListResponseSchema } from '~~/shared/schemas/public-content'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

useSeoMeta({
  title: `设定领养 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}当前公开的常规领养与展会掉落角色，查看完整横版设定图、状态、属性与人民币价格。`,
  ogTitle: `设定领养 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}当前公开的常规领养与展会掉落角色。`,
})

const route = useRoute()
const requestedPage = computed(() => publicPageFromQuery(route.query.page))
const search = computed(() => publicSearchFromQuery(route.query.q))

/** 筛选参数原样透传（含非法值），由服务端判定 filter.valid。 */
const filterQuery = computed(() => {
  const raw = Array.isArray(route.query.method)
    ? route.query.method[0]
    : route.query.method
  return {
    ...(typeof raw === 'string' && raw !== '' ? { method: raw } : {}),
    page: requestedPage.value,
    q: route.query.q,
  }
})

const { data: list, error: listError } = await useFetch('/api/public/v1/adoptions', {
  key: 'public-adoptions-list',
  headers: useRequestHeaders(['host']),
  query: filterQuery,
  transform: raw => publicAdoptionListResponseSchema.parse(raw).data,
})

const { data: site, error: siteError } = await useFetch('/api/public/v1/site-content', {
  key: 'public-adoptions-site-content',
  headers: useRequestHeaders(['host']),
  transform: raw => publicSiteContentResponseSchema.parse(raw).data,
})

if (listError.value || siteError.value) {
  throw createError({ statusCode: 500, statusMessage: '设定领养暂时无法显示' })
}

const items = computed(() => list.value?.items ?? [])
const resultCount = computed(() => list.value?.resultCount ?? 0)
const page = computed(() => list.value?.page ?? requestedPage.value)
const pageCount = computed(() => list.value?.pageCount ?? 0)
const status = computed(() => site.value?.statuses.adoption ?? null)
const filter = computed(
  () => list.value?.filter ?? { method: 'all' as const, valid: true },
)

/** 三个筛选都是普通链接：SSR 直出、无 JavaScript 时可用。 */
const FILTER_OPTIONS = computed(() => [
  { key: 'all', label: '全部', to: publicPageHref('/adoptions', { q: search.value.query || null }, 1) },
  { key: 'regular', label: '常规领养', to: publicPageHref('/adoptions', { method: 'regular', q: search.value.query || null }, 1) },
  { key: 'event_drop', label: '展会掉落', to: publicPageHref('/adoptions', { method: 'event_drop', q: search.value.query || null }, 1) },
])

const clearSearchHref = computed(() => publicPageHref('/adoptions', {
  method: filter.value.method === 'all' ? null : filter.value.method,
}, 1))

/** 空态只表达真实数据，不编造“即将更新”。 */
const emptyText = computed(() => {
  if (!search.value.valid) {
    return { description: '', title: '搜索条件无效' }
  }
  if (search.value.active) {
    return { description: '', title: '没有找到这个设定' }
  }
  if (!filter.value.valid) {
    return {
      description: '筛选参数无法识别，已显示全部领养。',
      title: '筛选条件无效',
    }
  }
  if (filter.value.method === 'regular') {
    return { description: '可以切换到展会掉落。', title: '当前没有常规领养' }
  }
  if (filter.value.method === 'event_drop') {
    return { description: '可以切换到常规领养。', title: '当前没有展会掉落' }
  }
  return { description: '', title: '当前没有可领养的角色' }
})

const isOutOfRange = computed(() => (
  items.value.length === 0
  && resultCount.value > 0
  && page.value > pageCount.value
))

function hrefFor(target: number) {
  return publicPageHref('/adoptions', {
    method: filter.value.method === 'all' ? null : filter.value.method,
    q: search.value.query || null,
  }, target)
}
</script>

<template>
  <div class="adoptions-page">
    <PublicPageIntro title="设定领养" />

    <div
      v-if="status"
      class="adoptions-page__status-wrap"
    >
      <section
        class="adoptions-page__status"
        aria-label="当前领养营业状态"
        data-testid="adoption-status"
      >
        <PublicBusinessStatus :status="status" />
      </section>
    </div>

    <div class="adoptions-page__filters-wrap">
      <PublicCatalogSearch
        action="/adoptions"
        :clear-to="clearSearchHref"
        :hidden-fields="{
          method: filter.method === 'all' ? null : filter.method,
        }"
        :query="search.query"
        :show-clear="search.active"
      />
      <PublicFilterChips
        label="领养方式筛选"
        :options="FILTER_OPTIONS"
        :selected="filter.method"
      />
    </div>

    <div v-if="items.length > 0" class="adoptions-page__content">
      <ul class="adoptions-page__grid" role="list">
        <li v-for="adoption in items" :key="adoption.work.id">
          <AdoptionCard :adoption="adoption" />
        </li>
      </ul>
      <PublicPagination
        :page="page"
        :page-count="pageCount"
        :href-for="hrefFor"
        label="设定领养分页"
      />
    </div>

    <PublicEmptyState
      v-else-if="isOutOfRange"
      title="这一页没有可领养角色"
      description="可以回到当前筛选的第一页继续浏览。"
    >
      <NuxtLink :to="hrefFor(1)">回到第一页</NuxtLink>
    </PublicEmptyState>

    <PublicEmptyState
      v-else
      :title="emptyText.title"
      :description="emptyText.description"
    >
      <NuxtLink v-if="search.active" :to="clearSearchHref">清除搜索</NuxtLink>
      <NuxtLink v-else to="/works">浏览作品展示</NuxtLink>
    </PublicEmptyState>
  </div>
</template>

<style scoped>
.adoptions-page {
  min-height: 60vh;
}

.adoptions-page__content {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-7);
}

.adoptions-page__status-wrap {
  max-width: var(--public-content-wide);
  margin: 0 auto var(--space-6);
  padding: 0 var(--public-page-padding);
}

.adoptions-page__status {
  padding: var(--space-4) var(--space-5);
  background: var(--public-bg-secondary);
  border-radius: var(--radius-md);
}

.adoptions-page__filters-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4) var(--space-6);
  max-width: var(--public-content-wide);
  margin: 0 auto var(--space-6);
  padding: 0 var(--public-page-padding);
}

.adoptions-page__filters-wrap > :deep(.catalog-search) {
  flex: 1 1 22rem;
}

.adoptions-page__grid {
  display: grid;
  gap: var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 768px) {
  .adoptions-page__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    /* 并排卡片顶端对齐；设定图框已固定比例，文字区不会互相错位。 */
    align-items: start;
  }
}
</style>

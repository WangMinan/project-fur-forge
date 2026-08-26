<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import {
  PUBLIC_ADOPTIONS_PAGE_SIZE,
  publicAdoptionListResponseSchema,
} from '~~/shared/schemas/public-content'

useSeoMeta({
  title: `设定领养 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}当前公开的领养角色，查看完整设定图、状态与人民币价格。`,
  ogTitle: `设定领养 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}当前公开的领养角色。`,
})

const route = useRoute()
const requestedPage = computed(() => publicPageFromQuery(route.query.page))
const search = computed(() => publicSearchFromQuery(route.query.q))

const listQuery = computed(() => ({
  page: requestedPage.value,
  q: route.query.q,
}))

const { data: list, error: listError } = await useFetch('/api/public/v1/adoptions', {
  key: 'public-adoptions-list',
  headers: useRequestHeaders(['host']),
  query: listQuery,
  transform: raw => publicAdoptionListResponseSchema.parse(raw).data,
})

if (listError.value) {
  throw createError({ statusCode: 500, statusMessage: '设定领养暂时无法显示' })
}

const items = computed(() => list.value?.items ?? [])
const resultCount = computed(() => list.value?.resultCount ?? 0)
const page = computed(() => list.value?.page ?? requestedPage.value)
const pageSize = computed(() => list.value?.pageSize ?? PUBLIC_ADOPTIONS_PAGE_SIZE)
const pageCount = computed(() => list.value?.pageCount ?? 0)
const filter = computed(
  () => list.value?.filter ?? { valid: true },
)

const clearSearchHref = '/adoptions'

/** 空态只表达真实数据，不编造“即将更新”。 */
const emptyText = computed(() => {
  if (!search.value.valid) {
    return { description: '', title: '搜索条件无效' }
  }
  if (search.value.active) {
    return { description: '', title: '没有找到这个设定' }
  }
  if (!filter.value.valid) {
    return { description: '', title: '搜索条件无效' }
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
    q: search.value.query || null,
  }, target)
}

</script>

<template>
  <main class="adoptions-page" aria-labelledby="adoptions-page-title">
    <AdoptionArchiveHeader />

    <section class="adoptions-page__tools" aria-label="搜索领养角色">
      <div class="adoptions-page__tools-panel">
        <div class="adoptions-page__tools-meta">
          <span>搜索角色</span>
          <span v-if="search.active">{{ String(resultCount).padStart(2, '0') }} 项结果</span>
        </div>
        <div class="adoptions-page__filters-wrap">
          <PublicCatalogSearch
            action="/adoptions"
            :clear-to="clearSearchHref"
            :query="search.query"
            :show-clear="search.active"
          />
          <PublicAction
            variant="primary"
            class="adoptions-page__contact-action"
            to="/about#contact"
            data-testid="adoption-contact-action"
          >联系我们申请领养</PublicAction>
        </div>
      </div>
    </section>

    <div v-if="items.length > 0" class="adoptions-page__content">
      <ol class="adoptions-page__grid">
        <li v-for="(adoption, index) in items" :key="adoption.work.id">
          <AdoptionCard
            :adoption="adoption"
            :folio="(page - 1) * pageSize + index + 1"
          />
        </li>
      </ol>
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
      <PublicAction :to="hrefFor(1)" variant="secondary">回到第一页</PublicAction>
    </PublicEmptyState>

    <PublicEmptyState
      v-else
      :title="emptyText.title"
      :description="emptyText.description"
    >
      <PublicAction v-if="search.active" :to="clearSearchHref" variant="secondary">清除搜索</PublicAction>
      <PublicAction v-else to="/works" variant="secondary">浏览作品展示</PublicAction>
    </PublicEmptyState>
  </main>
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

.adoptions-page__tools {
  max-width: var(--public-content-wide);
  margin: 0 auto var(--space-3);
  padding: var(--space-2) var(--public-page-padding);
}

.adoptions-page__tools-panel {
  width: min(100%, 39rem);
  margin-left: auto;
}

.adoptions-page__tools-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
  color: var(--public-text-secondary);
  font-family: var(--font-role-metadata);
  font-size: var(--type-metadata-size);
  font-weight: var(--type-metadata-weight);
  line-height: var(--type-metadata-line-height);
}

.adoptions-page__filters-wrap {
  display: grid;
  grid-template-columns: minmax(18rem, 1fr) auto;
  align-items: start;
  gap: var(--space-3);
}

.adoptions-page__filters-wrap > :deep(.catalog-search) {
  width: 100%;
}

.adoptions-page__contact-action {
  flex: none;
}

.adoptions-page__grid {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.adoptions-page__grid > li {
  min-width: 0;
}

@media (min-width: 1024px) {
  .adoptions-page__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: clamp(2.5rem, 5vw, 5rem);
  }
}

@media (max-width: 767px) {
  .adoptions-page__tools {
    margin-bottom: var(--space-3);
  }

  .adoptions-page__filters-wrap {
    display: grid;
    gap: var(--space-2);
    grid-template-columns: 1fr;
  }

  .adoptions-page__filters-wrap > :deep(.catalog-search) {
    width: 100%;
  }

  .adoptions-page__contact-action {
    justify-self: start;
  }
}
</style>

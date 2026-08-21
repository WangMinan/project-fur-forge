<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicAdoptionListResponseSchema } from '~~/shared/schemas/public-content'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

useSeoMeta({
  title: `设定领养 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}当前公开的领养角色，查看横版封面、状态与人民币价格。`,
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
        :query="search.query"
        :show-clear="search.active"
      />
      <!--
        领养需要人工沟通，所以在搜索条右侧直接给出联系入口，
        高度与搜索输入框/搜索按钮一致，视觉上同属一条操作带。
      -->
      <PublicAction
        variant="secondary"
        class="adoptions-page__contact-action"
        to="/about#contact"
        data-testid="adoption-contact-action"
      >联系我们申请领养</PublicAction>
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
  /* 搜索条与联系按钮同属一条操作带：底部对齐保证两者高度一致地并排。 */
  align-items: flex-start;
  gap: var(--space-3) var(--space-4);
  max-width: var(--public-content-wide);
  margin: 0 auto var(--space-6);
  padding: 0 var(--public-page-padding);
}

/*
 * 搜索条收窄，把右侧空间让给联系按钮；两者共用 2.75rem 行高，
 * 与 .catalog-search__input / __submit 一致。
 */
.adoptions-page__filters-wrap > :deep(.catalog-search) {
  flex: 0 1 26rem;
  width: auto;
}

.adoptions-page__contact-action {
  flex: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
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

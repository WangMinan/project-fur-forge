<script setup lang="ts">
import { publicWorkListResponseSchema } from '~~/shared/schemas/public-content'
import { PROJECT_NAME } from '~~/shared/constants/project'

/**
 * T20 作品列表：SSR 消费 /api/public/v1/works。
 * 筛选参数原样透传（含非法值），由服务端判定 filter.valid；
 * 空态区分「尚未发布」「无匹配」「参数非法」。
 */
useSeoMeta({
  title: `作品展示 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}的兽装作品展示，按用途与装型浏览。`,
  ogTitle: `作品展示 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}的兽装作品展示，按用途与装型浏览。`,
})

const route = useRoute()

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined
  }
  return undefined
}

const requestedPage = computed(() => publicPageFromQuery(route.query.page))
const search = computed(() => publicSearchFromQuery(route.query.q))

const filterQuery = computed(() => ({
  page: requestedPage.value,
  purpose: firstQueryValue(route.query.purpose),
  q: route.query.q,
  suitType: firstQueryValue(route.query.suitType),
}))

const { data: list, error: listError } = await useFetch('/api/public/v1/works', {
  key: 'public-works-list',
  headers: useRequestHeaders(['host']),
  query: filterQuery,
  transform: raw => publicWorkListResponseSchema.parse(raw).data,
})

if (listError.value) {
  throw createError({ statusCode: 500, statusMessage: '作品列表暂时无法显示' })
}

const items = computed(() => list.value?.items ?? [])
const filter = computed(() => list.value?.filter ?? { purpose: null, suitType: null, valid: true as const })
const resultCount = computed(() => list.value?.resultCount ?? 0)
const page = computed(() => list.value?.page ?? requestedPage.value)
const pageCount = computed(() => list.value?.pageCount ?? 0)

const hasActiveFilter = computed(
  () => filter.value.purpose !== null || filter.value.suitType !== null,
)
const clearSearchHref = computed(() => publicPageHref('/works', {
  purpose: filter.value.purpose,
  suitType: filter.value.suitType,
}, 1))

/**
 * 空态区分尚无作品、筛选无匹配与越界页码。
 * 非法筛选对访客与「无匹配」是同一件事，不单独措辞。
 */
type EmptyKind = 'invalid-search' | 'no-works' | 'no-match' | 'out-of-range' | 'search-no-match'
const emptyKind = computed<EmptyKind | null>(() => {
  if (items.value.length > 0) {
    return null
  }
  if (filter.value.valid && resultCount.value > 0 && page.value > pageCount.value) {
    return 'out-of-range'
  }
  if (!search.value.valid) {
    return 'invalid-search'
  }
  if (search.value.active) {
    return 'search-no-match'
  }
  return hasActiveFilter.value || !filter.value.valid ? 'no-match' : 'no-works'
})

function hrefFor(target: number) {
  return publicPageHref('/works', {
    purpose: filter.value.purpose,
    q: search.value.query || null,
    suitType: filter.value.suitType,
  }, target)
}
</script>

<template>
  <div class="public-page">
    <PublicPageIntro title="作品展示" />

    <div class="public-container works-page">
      <PublicCatalogSearch
        action="/works"
        :clear-to="clearSearchHref"
        :hidden-fields="{
          purpose: filter.purpose,
          suitType: filter.suitType,
        }"
        :query="search.query"
        :show-clear="search.active"
      />

      <WorkFilterBar
        :filter="filter"
        :query="search.query"
        :result-count="resultCount"
      />

      <template v-if="items.length > 0">
        <ul class="works-grid">
          <li v-for="work in items" :key="work.work.id">
            <WorkCard
              :work="work"
              sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
            />
          </li>
        </ul>
        <PublicPagination
          :page="page"
          :page-count="pageCount"
          :href-for="hrefFor"
          label="作品展示分页"
        />
      </template>

      <div v-else-if="emptyKind === 'out-of-range'" class="works-empty">
        <p class="works-empty__title">这一页没有作品</p>
        <NuxtLink :to="hrefFor(1)" class="works-empty__reset">
          回到第一页
        </NuxtLink>
      </div>

      <div v-else-if="emptyKind === 'no-works'" class="works-empty">
        <p class="works-empty__title">作品正在整理中。</p>
      </div>

      <div v-else-if="emptyKind === 'invalid-search'" class="works-empty">
        <p class="works-empty__title">搜索条件无效</p>
        <NuxtLink :to="clearSearchHref" class="works-empty__reset">
          清除搜索
        </NuxtLink>
      </div>

      <div v-else-if="emptyKind === 'search-no-match'" class="works-empty">
        <p class="works-empty__title">没有找到这个设定</p>
        <NuxtLink :to="clearSearchHref" class="works-empty__reset">
          清除搜索
        </NuxtLink>
      </div>

      <!-- 无匹配与参数非法对访客是同一件事：这套条件下没有作品。 -->
      <div v-else class="works-empty">
        <p class="works-empty__title">没有符合条件的作品</p>
        <NuxtLink to="/works" class="works-empty__reset">
          清除筛选
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.works-page {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding-top: 0;
  padding-right: var(--public-page-padding);
  padding-bottom: var(--space-7);
  padding-left: var(--public-page-padding);
}

.works-grid {
  display: grid;
  gap: var(--space-8) var(--space-6);
  margin-top: var(--space-8);
  /* 作品网格是语义列表，但不显示项目符号与列表缩进：
     缺少这条重置时浏览器默认 marker 会出现在角色名左侧。 */
  padding: 0;
  list-style: none;
}

.works-page > :deep(.catalog-search) {
  margin-bottom: var(--space-6);
}

@media (min-width: 768px) {
  .works-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .works-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.works-empty {
  margin-top: var(--space-8);
  padding: var(--space-10) var(--space-6);
  text-align: center;
  background: var(--public-bg-secondary);
  border-radius: var(--radius-md);
}

.works-empty__title {
  font-size: var(--font-size-md);
}

.works-empty__description {
  margin-top: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.works-empty__reset {
  display: inline-block;
  margin-top: var(--space-4);
  padding: var(--space-2) var(--space-5);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.works-empty__reset:hover {
  background: var(--public-bg-inverse);
  color: var(--public-text-inverse);
}
</style>

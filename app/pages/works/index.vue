<script setup lang="ts">
import { publicWorkListResponseSchema } from '~~/shared/schemas/public-content'
import { PROJECT_NAME } from '~~/shared/constants/project'

/**
 * T20 作品列表：SSR 消费 /api/public/v1/works。
 * 公开端只按名称搜索并分页，作品用途等内部字段不进入查询或 DTO。
 */
useSeoMeta({
  title: `作品展示 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}的兽装作品展示。`,
  ogTitle: `作品展示 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}的兽装作品展示。`,
})

const route = useRoute()

const requestedPage = computed(() => publicPageFromQuery(route.query.page))
const search = computed(() => publicSearchFromQuery(route.query.q))

const listQuery = computed(() => ({
  page: requestedPage.value,
  q: route.query.q,
}))

const { data: list, error: listError } = await useFetch('/api/public/v1/works', {
  key: 'public-works-list',
  headers: useRequestHeaders(['host']),
  query: listQuery,
  transform: raw => publicWorkListResponseSchema.parse(raw).data,
})

if (listError.value) {
  throw createError({ statusCode: 500, statusMessage: '作品列表暂时无法显示' })
}

const items = computed(() => list.value?.items ?? [])
const filter = computed(() => list.value?.filter ?? { valid: true as const })
const resultCount = computed(() => list.value?.resultCount ?? 0)
const page = computed(() => list.value?.page ?? requestedPage.value)
const pageCount = computed(() => list.value?.pageCount ?? 0)

const clearSearchHref = '/works'

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
  return !filter.value.valid ? 'no-match' : 'no-works'
})

function hrefFor(target: number) {
  return publicPageHref('/works', {
    q: search.value.query || null,
  }, target)
}
</script>

<template>
  <main class="works-page">
    <header class="works-page__intro">
      <span class="works-page__background-type" aria-hidden="true">WORKS</span>
      <img
        class="works-page__mark"
        src="/brand/logo-mark.png"
        alt=""
        aria-hidden="true"
        width="1600"
        height="1600"
      >
      <div class="works-page__identity">
        <h1>作品展示</h1>
        <p>查看工作室已公开的角色作品与设定。</p>
      </div>

      <div class="works-page__toolbar">
        <span v-if="search.active" class="works-page__result-count">
          {{ String(resultCount).padStart(2, '0') }} 项结果
        </span>
        <PublicCatalogSearch
          action="/works"
          :clear-to="clearSearchHref"
          :query="search.query"
          :show-clear="search.active"
        />
      </div>
    </header>

    <div class="works-page__content">
      <template v-if="items.length > 0">
        <ul class="works-grid">
          <li
            v-for="work in items"
            :key="work.work.id"
            class="works-grid__item"
          >
            <WorkCard
              :work="work"
              sizes="(min-width: 1024px) 23vw, (min-width: 768px) 31vw, 48vw"
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

      <PublicEmptyState v-else-if="emptyKind === 'out-of-range'" title="这一页没有作品">
        <PublicAction :to="hrefFor(1)" variant="secondary">
          回到第一页
        </PublicAction>
      </PublicEmptyState>

      <PublicEmptyState v-else-if="emptyKind === 'no-works'" title="作品正在整理中。" />

      <PublicEmptyState v-else-if="emptyKind === 'invalid-search'" title="搜索条件无效">
        <PublicAction :to="clearSearchHref" variant="secondary">
          清除搜索
        </PublicAction>
      </PublicEmptyState>

      <PublicEmptyState v-else-if="emptyKind === 'search-no-match'" title="没有找到这个设定">
        <PublicAction :to="clearSearchHref" variant="secondary">
          清除搜索
        </PublicAction>
      </PublicEmptyState>

      <!-- 无匹配与参数非法对访客是同一件事：这套条件下没有作品。 -->
      <PublicEmptyState v-else title="没有符合条件的作品">
        <PublicAction to="/works" variant="secondary">
          清除筛选
        </PublicAction>
      </PublicEmptyState>
    </div>
  </main>
</template>

<style scoped>
.works-page {
  min-height: 60svh;
}

.works-page__intro,
.works-page__content {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding-inline: var(--public-page-padding);
}

.works-page__intro {
  position: relative;
  isolation: isolate;
  display: grid;
  gap: var(--space-6);
  padding-top: var(--space-7);
  padding-bottom: var(--space-6);
  overflow: hidden;
}

.works-page__background-type {
  position: absolute;
  z-index: -1;
  inset: clamp(0.75rem, 2vw, 2rem) auto auto var(--public-page-padding);
  color: var(--public-background-type);
  font-family: var(--font-role-display-sans);
  font-size: clamp(5.75rem, 15vw, 13rem);
  font-weight: 700;
  line-height: 0.8;
  pointer-events: none;
  user-select: none;
}

.works-page__mark {
  position: absolute;
  inset: clamp(-1.5rem, -1.2vw, -0.75rem) clamp(0.5rem, 3vw, 3rem) auto auto;
  z-index: -1;
  width: clamp(13rem, 18vw, 17rem);
  height: auto;
  object-fit: contain;
  opacity: 0.055;
  filter: grayscale(1);
  transform: translate(8%, -8%) rotate(12deg);
  transform-origin: center;
  pointer-events: none;
  user-select: none;
}

.works-page__identity {
  align-self: end;
  padding-top: clamp(5rem, 10vw, 8rem);
}

.works-page__identity h1 {
  font-family: var(--font-role-display);
  font-size: clamp(2.75rem, 5vw, 5rem);
  font-weight: var(--type-display-weight);
  line-height: 1;
  letter-spacing: var(--type-display-letter-spacing);
}

.works-page__identity p {
  max-width: 28rem;
  margin-top: var(--space-4);
  color: var(--public-text-secondary);
}

.works-page__content {
  padding-bottom: var(--space-7);
}

.works-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.works-grid__item {
  min-width: 0;
}

.works-page__toolbar {
  display: grid;
  align-content: end;
  gap: var(--space-2);
}

.works-page__toolbar > :deep(.catalog-search) {
  width: 100%;
}

.works-page__result-count {
  color: var(--public-text-secondary);
  font-family: var(--font-role-metadata);
  font-size: var(--type-metadata-size);
  font-weight: var(--type-metadata-weight);
  line-height: var(--type-metadata-line-height);
}

@media (min-width: 768px) {
  .works-page__intro {
    grid-template-columns: minmax(0, 0.9fr) minmax(22rem, 1.1fr);
    align-items: end;
    min-height: 20rem;
  }

  .works-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-5);
  }
}

@media (max-width: 767px) {
  .works-page__background-type {
    font-size: clamp(3.25rem, 14.8vw, 4.75rem);
  }

  .works-page__mark {
    inset: 0.5rem -1rem auto auto;
    width: 7.5rem;
    opacity: 0.045;
    transform: rotate(12deg);
  }
}

@media (min-width: 1024px) {
  .works-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-6);
  }
}

</style>

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
  <div class="public-page">
    <PublicPageIntro title="作品展示" />

    <div class="public-container works-page">
      <div class="works-page__toolbar">
        <PublicCatalogSearch
          action="/works"
          :clear-to="clearSearchHref"
          :query="search.query"
          :show-clear="search.active"
        />
      </div>

      <template v-if="items.length > 0">
        <ul class="works-grid">
          <li
            v-for="work in items"
            :key="work.work.id"
            :class="`works-grid__item works-grid__item--${work.cardOrientation}`"
          >
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
        <PublicAction :to="hrefFor(1)" variant="secondary" class="works-empty__reset">
          回到第一页
        </PublicAction>
      </div>

      <div v-else-if="emptyKind === 'no-works'" class="works-empty">
        <p class="works-empty__title">作品正在整理中。</p>
      </div>

      <div v-else-if="emptyKind === 'invalid-search'" class="works-empty">
        <p class="works-empty__title">搜索条件无效</p>
        <PublicAction :to="clearSearchHref" variant="secondary" class="works-empty__reset">
          清除搜索
        </PublicAction>
      </div>

      <div v-else-if="emptyKind === 'search-no-match'" class="works-empty">
        <p class="works-empty__title">没有找到这个设定</p>
        <PublicAction :to="clearSearchHref" variant="secondary" class="works-empty__reset">
          清除搜索
        </PublicAction>
      </div>

      <!-- 无匹配与参数非法对访客是同一件事：这套条件下没有作品。 -->
      <div v-else class="works-empty">
        <p class="works-empty__title">没有符合条件的作品</p>
        <PublicAction to="/works" variant="secondary" class="works-empty__reset">
          清除筛选
        </PublicAction>
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

/*
 * 等高铺满：竖版出厂照（3:4）与横版领养封面（16:9）混排时，同一行内所有卡片
 * 高度一致、宽度按自身比例伸展、行宽铺满，右边缘对齐，不留大面积空白。
 *
 * 原理：`flex-basis` 与 `flex-grow` 都正比于 `--card-ratio`，因此 flex 分配剩余
 * 空间时同一行内每张卡的放大系数相同 → 宽度比恒等于比例比 → 高度必然相等。
 * 框比例等于公开变体比例，所以铺满不产生裁切。
 */
.works-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8) var(--space-6);
  margin-top: var(--space-6);
  /* 作品网格是语义列表，但不显示项目符号与列表缩进：
     缺少这条重置时浏览器默认 marker 会出现在角色名左侧。 */
  padding: 0;
  list-style: none;
}

.works-grid__item {
  flex-grow: var(--card-ratio);
  flex-basis: calc(var(--card-ratio) * var(--works-row-height));
  /*
   * 末行未填满时孤卡不被拉高：上限贴近行高本身，只留一点伸展余量，
   * 因此末行卡片高度与前面几行基本一致，不会突然变成巨图。
   */
  max-width: calc(var(--card-ratio) * var(--works-row-height) * 1.25);
  min-width: 0;
}

/* 移动端单列：不做 justified，避免横版卡被压得过矮。 */
@media (max-width: 767px) {
  .works-grid__item {
    flex-basis: 100%;
    max-width: 100%;
  }
}

.works-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4) var(--space-6);
}

.works-page__toolbar > :deep(.catalog-search) {
  flex: 1 1 22rem;
}

/* 只调行高：列数由行宽与各卡比例自然决定，不再固定列数。 */
@media (min-width: 768px) {
  .works-grid {
    --works-row-height: 16rem;
  }
}

@media (min-width: 1024px) {
  .works-grid {
    --works-row-height: 19rem;
  }
}

@media (min-width: 1280px) {
  .works-grid {
    --works-row-height: 21rem;
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
  margin-top: var(--space-4);
}
</style>

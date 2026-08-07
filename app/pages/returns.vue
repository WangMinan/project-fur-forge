<script setup lang="ts">
import { publicReturnWallResponseSchema } from '~~/shared/schemas/return-photo'
import { PROJECT_NAME } from '~~/shared/constants/project'

/**
 * T36 返图墙：一级导航独立页面，不是作品详情内的 Tab。
 *
 * 页面结构固定为紧凑页头 → 原比例无水印瀑布流 → 底部编号分页。
 * 不设置大 Hero、搜索、筛选、统计、热门区或业务状态面板；
 * 不建设返图详情页、返图者主页、点赞、评论或公开投稿。
 */
const DESCRIPTION = '收到的真实穿着返图，来自作品交付之后的日常和展会现场。'

useSeoMeta({
  title: `返图 · ${PROJECT_NAME}`,
  description: DESCRIPTION,
  ogTitle: `返图 · ${PROJECT_NAME}`,
  ogDescription: DESCRIPTION,
})

const route = useRoute()

// canonical 与 og:url 由 layouts/default.vue 按当前路由统一输出，
// 因此 /returns 的 canonical 不带 page 查询参数。

/** 非法页码收敛为第 1 页，不抛 500，也不显示内部信息。 */
const requestedPage = computed(() => {
  const raw = Array.isArray(route.query.page)
    ? route.query.page[0]
    : route.query.page
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
})

const { data: wall, error: wallError } = await useFetch(
  '/api/public/v1/returns',
  {
    key: 'public-return-wall',
    headers: useRequestHeaders(['host']),
    query: computed(() => ({ page: requestedPage.value })),
    transform: raw => publicReturnWallResponseSchema.parse(raw).data,
  },
)

const items = computed(() => wall.value?.items ?? [])
const page = computed(() => wall.value?.page ?? requestedPage.value)
const pageCount = computed(() => wall.value?.pageCount ?? 0)

function hrefFor(target: number) {
  return target <= 1 ? '/returns' : `/returns?page=${target}`
}
</script>

<template>
  <div class="public-page">
    <PublicPageIntro title="返图" :description="DESCRIPTION" />

    <div class="public-container returns-page">
      <!-- 分页请求失败：保留页面骨架与导航，提供普通链接重试。 -->
      <PublicEmptyState
        v-if="wallError"
        title="返图暂时无法显示"
        description="请稍后重试，或先浏览作品展示。"
      >
        <NuxtLink class="returns-page__retry" :to="hrefFor(page)">
          重新加载这一页
        </NuxtLink>
      </PublicEmptyState>

      <PublicEmptyState
        v-else-if="items.length === 0 && page > 1"
        title="这一页没有返图"
        description="返图数量可能刚刚变化，可以回到第一页继续浏览。"
      >
        <NuxtLink class="returns-page__retry" to="/returns">
          回到第一页
        </NuxtLink>
      </PublicEmptyState>

      <PublicEmptyState
        v-else-if="items.length === 0"
        title="还没有公开的返图"
        description="返图会在收到并确认之后陆续展示。"
      />

      <template v-else>
        <ReturnMasonry :items="items" />
        <PublicPagination
          :page="page"
          :page-count="pageCount"
          :href-for="hrefFor"
          label="返图分页"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.returns-page {
  padding-bottom: var(--space-9);
}

.returns-page__retry {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  color: var(--public-text-link);
  font-size: var(--font-size-sm);
}
</style>

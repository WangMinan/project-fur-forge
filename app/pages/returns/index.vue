<script setup lang="ts">
import {
  publicReturnWallResponseSchema,
  returnWallSeedSchema,
} from '~~/shared/schemas/return-photo'
import { PROJECT_NAME } from '~~/shared/constants/project'

/**
 * T36/T35-F1 返图墙：一级导航独立页面。
 *
 * 每一项是一张返图照片，同一个设定的多张都会出现；顺序每次随机打乱。
 * 点击进入该设定的返图页，不跳作品详情。
 */
// 只给搜索引擎用：页面上不再重复一句自我介绍。
const SEO_DESCRIPTION = '收到的真实穿着返图。'

useSeoMeta({
  title: `返图墙 · ${PROJECT_NAME}`,
  description: SEO_DESCRIPTION,
  ogTitle: `返图墙 · ${PROJECT_NAME}`,
  ogDescription: SEO_DESCRIPTION,
})

const route = useRoute()

// canonical 与 og:url 由 layouts/default.vue 按当前路由统一输出，
// 因此 /returns 的 canonical 不带 page 查询参数。

/** 非法页码收敛为第 1 页，不抛 500，也不显示内部信息。 */
const requestedPage = computed(() => publicPageFromQuery(route.query.page))
const requestedSeed = computed(() => {
  const raw = Array.isArray(route.query.seed)
    ? route.query.seed[0]
    : route.query.seed
  const parsed = returnWallSeedSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
})

const { data: wall, error: wallError } = await useFetch(
  '/api/public/v1/returns',
  {
    key: 'public-return-wall',
    headers: useRequestHeaders(['host']),
    query: computed(() => ({
      page: requestedPage.value,
      seed: requestedSeed.value,
    })),
    transform: raw => publicReturnWallResponseSchema.parse(raw).data,
  },
)

const items = computed(() => wall.value?.items ?? [])
const page = computed(() => wall.value?.page ?? requestedPage.value)
const pageCount = computed(() => wall.value?.pageCount ?? 0)
const activeSeed = computed(() => wall.value?.seed ?? requestedSeed.value)

function hrefFor(target: number) {
  return publicPageHref('/returns', { seed: activeSeed.value }, target)
}
</script>

<template>
  <div class="public-page">
    <PublicPageIntro title="返图墙" />

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
        description="可以回到第一页继续浏览。"
      >
        <NuxtLink class="returns-page__retry" to="/returns">
          回到第一页
        </NuxtLink>
      </PublicEmptyState>

      <PublicEmptyState
        v-else-if="items.length === 0"
        title="还没有公开的返图"
      />

      <template v-else>
        <ReturnMasonry :items="items" />
        <PublicPagination
          :page="page"
          :page-count="pageCount"
          :href-for="hrefFor"
          label="返图墙分页"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 与 /works 一致的内容宽度与页边距；`.public-container` 只是语义标记。 */
.returns-page {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding-right: var(--public-page-padding);
  padding-bottom: var(--space-7);
  padding-left: var(--public-page-padding);
}

.returns-page__retry {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  color: var(--public-text-link);
  font-size: var(--font-size-sm);
}
</style>

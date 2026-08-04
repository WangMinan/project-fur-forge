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

const filterQuery = computed(() => ({
  purpose: firstQueryValue(route.query.purpose),
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

const hasActiveFilter = computed(
  () => filter.value.purpose !== null || filter.value.suitType !== null,
)

type EmptyKind = 'no-works' | 'no-match' | 'invalid'
const emptyKind = computed<EmptyKind | null>(() => {
  if (items.value.length > 0) {
    return null
  }
  if (!filter.value.valid) {
    return 'invalid'
  }
  return hasActiveFilter.value ? 'no-match' : 'no-works'
})
</script>

<template>
  <div class="public-page">
    <PublicPageIntro
      title="作品展示"
      description="每一套兽装都是独一无二的作品。"
    />

    <div class="public-container works-page">
      <WorkFilterBar
        :filter="filter"
        :result-count="resultCount"
      />

      <ul v-if="items.length > 0" class="works-grid">
        <li v-for="work in items" :key="work.work.id">
          <WorkCard
            :work="work"
            sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
          />
        </li>
      </ul>

      <div v-else-if="emptyKind === 'no-works'" class="works-empty">
        <p class="works-empty__title">
          作品正在整理中，请稍后再来。
        </p>
      </div>

      <div v-else-if="emptyKind === 'no-match'" class="works-empty">
        <p class="works-empty__title">
          没有符合条件的作品
        </p>
        <p class="works-empty__description">
          试试调整筛选条件，或浏览全部作品。
        </p>
        <NuxtLink to="/works" class="works-empty__reset">
          清除筛选
        </NuxtLink>
      </div>

      <div v-else class="works-empty">
        <p class="works-empty__title">
          没有符合条件的作品
        </p>
        <p class="works-empty__description">
          当前筛选条件无效，清除筛选后浏览全部作品。
        </p>
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
  padding-bottom: var(--space-10);
  padding-left: var(--public-page-padding);
}

.works-grid {
  display: grid;
  gap: var(--space-8) var(--space-6);
  margin-top: var(--space-8);
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

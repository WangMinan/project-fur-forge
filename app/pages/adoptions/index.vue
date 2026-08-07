<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicAdoptionListResponseSchema } from '~~/shared/schemas/public-content'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

useSeoMeta({
  title: `角色领养 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}当前公开的常规领养与展会掉落角色，查看完整横版设定图、状态、属性与人民币价格。`,
  ogTitle: `角色领养 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}当前公开的常规领养与展会掉落角色。`,
})

const route = useRoute()

/** 筛选参数原样透传（含非法值），由服务端判定 filter.valid。 */
const filterQuery = computed(() => {
  const raw = Array.isArray(route.query.method)
    ? route.query.method[0]
    : route.query.method
  return typeof raw === 'string' && raw !== '' ? { method: raw } : {}
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
  throw createError({ statusCode: 500, statusMessage: '角色领养暂时无法显示' })
}

const items = computed(() => list.value?.items ?? [])
const status = computed(() => site.value?.statuses.adoption ?? null)
const filter = computed(
  () => list.value?.filter ?? { method: 'all' as const, valid: true },
)
const counts = computed(
  () => list.value?.counts ?? { all: 0, event_drop: 0, regular: 0 },
)

/** 三个筛选都是普通链接：SSR 直出、无 JavaScript 时可用。 */
const FILTERS = [
  { href: '/adoptions', key: 'all' as const, label: '全部' },
  { href: '/adoptions?method=regular', key: 'regular' as const, label: '常规领养' },
  { href: '/adoptions?method=event_drop', key: 'event_drop' as const, label: '展会掉落' },
]

/** 空态只表达真实数据，不编造“即将更新”。 */
const emptyText = computed(() => {
  if (!filter.value.valid) {
    return {
      description: '筛选参数无法识别，已显示全部领养。',
      title: '筛选条件无效',
    }
  }
  if (filter.value.method === 'regular') {
    return {
      description: '目前没有已发布的常规领养角色。可以切换到展会掉落或浏览作品。',
      title: '当前没有已发布的常规领养',
    }
  }
  if (filter.value.method === 'event_drop') {
    return {
      description: '目前没有已发布的展会掉落角色。可以切换到常规领养或浏览作品。',
      title: '当前没有已发布的展会掉落',
    }
  }
  return {
    description: '这里只展示已经完成设定图、状态与公开资料的真实角色。你仍可先浏览工作室作品。',
    title: '当前没有已发布的领养角色',
  }
})
</script>

<template>
  <div class="adoptions-page">
    <PublicPageIntro
      title="角色领养"
      description="完整查看角色设定与公开状态；后续沟通通过工作室公开联系方式在线下完成。"
    />

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
      <nav class="adoptions-page__filters" aria-label="领养方式筛选">
        <NuxtLink
          v-for="entry in FILTERS"
          :key="entry.key"
          class="adoptions-page__filter"
          :to="entry.href"
          :aria-current="filter.method === entry.key ? 'page' : undefined"
        >
          {{ entry.label }}
          <span class="adoptions-page__filter-count">{{ counts[entry.key] }}</span>
        </NuxtLink>
      </nav>
    </div>

    <div v-if="items.length > 0" class="adoptions-page__content">
      <p class="adoptions-page__count" role="status">共 {{ items.length }} 个可浏览角色</p>
      <ul class="adoptions-page__grid" role="list">
        <li v-for="adoption in items" :key="adoption.work.id">
          <AdoptionCard :adoption="adoption" />
        </li>
      </ul>
    </div>

    <PublicEmptyState
      v-else
      :title="emptyText.title"
      :description="emptyText.description"
    >
      <NuxtLink to="/works">浏览作品展示</NuxtLink>
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
  padding: 0 var(--public-page-padding) var(--space-10);
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

.adoptions-page__count {
  margin-bottom: var(--space-5);
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
}

.adoptions-page__filters-wrap {
  max-width: var(--public-content-wide);
  margin: 0 auto var(--space-6);
  padding: 0 var(--public-page-padding);
}

.adoptions-page__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.adoptions-page__filter {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  padding: 0 var(--space-5);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-full);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.adoptions-page__filter:hover {
  border-color: var(--public-accent-primary);
  color: var(--public-accent-primary);
}

/* 选中态同时用文字权重、边框与底色表达，不只依赖颜色。 */
.adoptions-page__filter[aria-current='page'] {
  border-color: var(--public-accent-primary);
  background: var(--public-accent-primary);
  color: var(--public-text-inverse);
  font-weight: 600;
}

.adoptions-page__filter-count {
  font-size: var(--font-size-xs);
  opacity: 0.75;
}

.adoptions-page__grid {
  display: grid;
  gap: var(--space-8) var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 768px) {
  .adoptions-page__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

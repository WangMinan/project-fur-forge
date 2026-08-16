<script setup lang="ts">
import { publicWorkDetailResponseSchema } from '~~/shared/schemas/public-content'
import { PROJECT_NAME } from '~~/shared/constants/project'

/**
 * T19 真实作品详情：SSR 消费 GET /api/public/v1/works/{slug}。
 * 只渲染公开 DTO；404/500 走 Nuxt 原生 HTML 错误页（error.vue）。
 * 响应式 slug：同组件实例内切换（继续浏览直达另一详情）时重新拉取。
 */
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

// 不提供显式 key：Nuxt 4 中静态 key 会让重挂载的详情页复用旧 slug 的缓存
// （status === 'success' 时跳过 initialFetch）。自动 key 含 URL，slug 变化即
// 生成新 key 并重新拉取，组件复用与重挂载两种路径都覆盖。
const { data: detail, error } = await useFetch(
  () => `/api/public/v1/works/${slug.value}`,
  {
    headers: useRequestHeaders(['host']),
    transform: raw => publicWorkDetailResponseSchema.parse(raw).data,
  },
)

// useFetch 的错误可能是 FetchError（statusCode 为原型 getter，序列化后丢失）、
// H3Error 或普通对象，这里对三种表示做防御性提取。
function resolveErrorStatus(err: unknown): number {
  if (!err || typeof err !== 'object') {
    return 500
  }
  const record = err as Record<string, unknown>
  for (const key of ['statusCode', 'status'] as const) {
    if (typeof record[key] === 'number') {
      return record[key]
    }
  }
  const response = record.response as { status?: number } | undefined
  return typeof response?.status === 'number' ? response.status : 500
}

function toPageError(err: unknown) {
  const statusCode = resolveErrorStatus(err) === 404 ? 404 : 500
  return createError({
    statusCode,
    statusMessage: statusCode === 404 ? '作品不存在或尚未发布' : '作品暂时无法打开',
    fatal: true,
  })
}

// 首次直达（SSR）：API 404/500 立即抛出 fatal 错误，由 HTML 错误页处理；
// 客户端同组件内切换 slug 失败时由下方 watch 经 showError 进入同一错误页。
if (error.value) {
  throw toPageError(error.value)
}

watch(error, (err) => {
  if (err) {
    showError(toPageError(err))
  }
})

const dto = computed(() => detail.value?.work)
const designSheet = computed(() => detail.value?.media.designSheet)
const studioPhotos = computed(() => detail.value?.media.gallery ?? [])
const relatedWorks = computed(() => detail.value?.related ?? [])
const navigation = computed(() => detail.value?.navigation ?? {
  previous: null,
  next: null,
})

useSeoMeta({
  title: computed(() => (dto.value
    ? `${dto.value.characterName} · 作品展示 · ${PROJECT_NAME}`
    : `作品展示 · ${PROJECT_NAME}`)),
  description: computed(() => (dto.value
    ? `${dto.value.characterName}：${dto.value.species}。有点小狗工作室兽装作品档案。`
    : '有点小狗工作室兽装作品档案。')),
  ogTitle: computed(() => (dto.value
    ? `${dto.value.characterName} · ${PROJECT_NAME}`
    : `作品展示 · ${PROJECT_NAME}`)),
  ogDescription: computed(() => (dto.value
    ? `${dto.value.species} · 兽装作品档案`
    : '有点小狗工作室兽装作品档案。')),
  ogType: 'article',
})

useHead(() => ({
  script: dto.value && detail.value
    ? [{
        key: 'work-json-ld',
        type: 'application/ld+json',
        textContent: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: dto.value.characterName,
          description: dto.value.species,
          image: detail.value.media.card.sources.fallback.at(-1)?.src,
          creator: {
            '@type': 'Organization',
            name: PROJECT_NAME,
          },
        }),
      }]
    : [],
}))

const RELATED_SIZES = '(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw'
</script>

<template>
  <article
    v-if="dto"
    class="work-detail"
    data-testid="work-detail"
    data-analytics-entity-type="work"
    :data-analytics-entity-id="dto.id"
    :data-work-slug="dto.slug"
  >
    <nav class="work-detail__back" aria-label="返回">
      <NuxtLink to="/works" class="work-detail__back-link">
        <span aria-hidden="true">←</span> 返回作品展示
      </NuxtLink>
    </nav>

    <header class="work-detail__header">
      <h1 class="work-detail__name">
        {{ dto.characterName }}
      </h1>
      <p class="work-detail__meta">
        {{ dto.species }}
      </p>
    </header>

    <div class="work-detail__layout">
      <div class="work-detail__media">
        <section
          v-if="designSheet"
          class="work-detail__media-section"
          aria-labelledby="design-sheet-title"
        >
          <h2 id="design-sheet-title" class="work-detail__media-title">设定图</h2>
          <AdoptionDesignSheet :design-sheet="designSheet" />
        </section>

        <section v-if="studioPhotos.length > 0" class="work-detail__media-section" aria-label="作品图集">
          <h2 id="studio-photos-title" class="work-detail__media-title">出厂照 / 作品图集</h2>
          <WorkDetailGallery :gallery="studioPhotos" :work-name="dto.characterName" />
        </section>
      </div>
    </div>

    <nav
      v-if="navigation.previous || navigation.next"
      class="work-detail__navigation"
      aria-label="前后浏览作品"
      data-testid="work-detail-navigation"
    >
      <NuxtLink
        v-if="navigation.previous"
        :to="navigation.previous.href"
        class="work-detail__navigation-link"
      >
        <span class="work-detail__navigation-direction"><span aria-hidden="true">←</span> 上一件</span>
        <span>{{ navigation.previous.characterName }}</span>
      </NuxtLink>
      <NuxtLink
        v-if="navigation.next"
        :to="navigation.next.href"
        class="work-detail__navigation-link work-detail__navigation-link--next"
      >
        <span class="work-detail__navigation-direction">下一件 <span aria-hidden="true">→</span></span>
        <span>{{ navigation.next.characterName }}</span>
      </NuxtLink>
    </nav>

    <section
      v-if="relatedWorks.length > 0"
      class="work-detail__related"
      aria-labelledby="work-related-title"
    >
      <div class="work-detail__related-header">
        <h2 id="work-related-title" class="work-detail__section-title">
          继续浏览
        </h2>
        <NuxtLink to="/works" class="work-detail__related-more">
          查看全部作品 <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>
      <div class="work-detail__related-grid">
        <WorkCard
          v-for="entry in relatedWorks"
          :key="entry.work.id"
          :work="entry"
          :sizes="RELATED_SIZES"
        />
      </div>
    </section>
  </article>
</template>

<style scoped>
/* 详情页自己提供收尾留白；页脚只留一段小间距。 */
.work-detail {
  padding-bottom: var(--space-7);
}

.work-detail__back {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-5) var(--public-page-padding) 0;
}

.work-detail__back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.work-detail__back-link:hover {
  color: var(--public-accent-primary);
}

.work-detail__header {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-6);
}

.work-detail__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.work-detail__meta {
  margin-top: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.work-detail__layout {
  display: grid;
  gap: var(--space-6);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0 var(--public-page-padding);
}

.work-detail__media {
  display: grid;
  gap: var(--space-8);
  min-width: 0;
  align-content: start;
}

.work-detail__media-section {
  min-width: 0;
}

.work-detail__media-title {
  margin: 0 0 var(--space-3);
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: 400;
  letter-spacing: var(--letter-spacing-label);
}

.work-detail__section-title {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: 400;
  letter-spacing: var(--letter-spacing-label);
}

.work-detail__related {
  max-width: var(--public-content-wide);
  margin: var(--space-9) auto 0;
  padding: 0 var(--public-page-padding);
}

.work-detail__navigation {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  max-width: var(--public-content-wide);
  margin: var(--space-9) auto 0;
  padding: 0 var(--public-page-padding);
}

.work-detail__navigation-link {
  display: grid;
  gap: var(--space-1);
  min-height: 4.5rem;
  padding: var(--space-4) var(--space-5);
  color: var(--public-text-primary);
  background: var(--public-bg-secondary);
  border-radius: var(--radius-md);
}

.work-detail__navigation-link--next {
  grid-column: 2;
  text-align: right;
}

.work-detail__navigation-link:hover {
  color: var(--public-accent-primary);
}

.work-detail__navigation-direction {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
}

.work-detail__related-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.work-detail__related-header .work-detail__section-title {
  color: var(--public-text-primary);
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  letter-spacing: var(--letter-spacing-normal);
}

.work-detail__related-more {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
}

.work-detail__related-more:hover {
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

.work-detail__related-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5) var(--space-4);
}

@media (min-width: 768px) {
  .work-detail__related-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-6) var(--space-5);
  }
}

</style>

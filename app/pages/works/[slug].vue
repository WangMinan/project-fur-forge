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
const studioPhotos = computed(() => detail.value?.media.studioPhotos ?? [])
const relatedWorks = computed(() => detail.value?.related ?? [])

useSeoMeta({
  title: computed(() => (dto.value
    ? `${dto.value.characterName} · 作品展示 · ${PROJECT_NAME}`
    : `作品展示 · ${PROJECT_NAME}`)),
  description: computed(() => (dto.value
    ? `${dto.value.characterName}：${dto.value.species}，${SUIT_TYPE_LABELS[dto.value.suitType]}。有点小狗工作室兽装作品档案。`
    : '有点小狗工作室兽装作品档案。')),
  ogTitle: computed(() => (dto.value
    ? `${dto.value.characterName} · ${PROJECT_NAME}`
    : `作品展示 · ${PROJECT_NAME}`)),
  ogDescription: computed(() => (dto.value
    ? `${dto.value.species} · ${SUIT_TYPE_LABELS[dto.value.suitType]} · 兽装作品档案`
    : '有点小狗工作室兽装作品档案。')),
  ogType: 'article',
})

const priceLabel = computed(() => {
  if (dto.value?.purpose !== 'adoption') {
    return ''
  }
  return dto.value.adoptionMethod === 'event_drop' ? '掉落价格' : '领养价格'
})

const priceText = computed(() => {
  if (dto.value?.purpose !== 'adoption' || !dto.value.price) {
    return null
  }
  return formatCnyMinorUnits(dto.value.price.minorUnits)
})

const RELATED_SIZES = '(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw'
</script>

<template>
  <article v-if="dto" class="work-detail" data-testid="work-detail" :data-work-slug="dto.slug">
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
        {{ dto.species }} · {{ SUIT_TYPE_LABELS[dto.suitType] }} · {{ WORK_PURPOSE_LABELS[dto.purpose] }}
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

        <section
          v-if="dto.purpose === 'adoption' && studioPhotos.length > 0"
          class="work-detail__media-section"
          aria-label="出厂照"
        >
          <h2 id="studio-photos-title" class="work-detail__media-title">出厂照 / 作品图集</h2>
          <WorkDetailGallery :gallery="studioPhotos" :work-name="dto.characterName" />
        </section>

        <WorkDetailGallery
          v-else-if="dto.purpose !== 'adoption'"
          :gallery="studioPhotos"
          :work-name="dto.characterName"
        />
      </div>

      <div class="work-detail__aside">
        <WorkFacts :dto="dto" />

        <section
          v-if="dto.featureTags.length > 0"
          class="work-detail__tags"
          aria-label="作品属性"
        >
          <h2 class="work-detail__section-title">
            作品属性
          </h2>
          <ul class="work-detail__tag-list">
            <li
              v-for="tag in dto.featureTags"
              :key="tag"
              class="work-detail__tag"
            >
              {{ tag }}
            </li>
          </ul>
        </section>

        <section
          v-if="priceText"
          class="work-detail__price"
          aria-label="公开人民币价格"
          data-testid="work-price"
        >
          <h2 class="work-detail__section-title">
            {{ priceLabel }}
          </h2>
          <p class="work-detail__price-value">
            {{ priceText }}
          </p>
          <p class="work-detail__price-note">
            如需领养，请访问"关于我们"获取联系方式，网站不接受登记、定金或付款。
          </p>
        </section>
      </div>
    </div>

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

.work-detail__aside {
  display: grid;
  gap: var(--space-6);
  align-content: start;
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

.work-detail__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.work-detail__tag {
  padding: var(--space-1) var(--space-3);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-full);
}

.work-detail__price-value {
  margin-top: var(--space-2);
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
}

.work-detail__price-note {
  margin-top: var(--space-2);
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.work-detail__related {
  max-width: var(--public-content-wide);
  margin: var(--space-9) auto 0;
  padding: 0 var(--public-page-padding);
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

@media (min-width: 1024px) {
  .work-detail__layout {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    gap: var(--space-7);
  }
}
</style>

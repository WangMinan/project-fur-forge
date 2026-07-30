<script setup lang="ts">
import { findWorkBySlug, workCatalog } from '~~/shared/fixtures/visual-works'
import { PROJECT_NAME } from '~~/shared/constants/project'

const route = useRoute()
// 响应式派生：同组件实例内 slug 变化（继续浏览直达另一详情）时，
// 作品选择、图集、价格、SEO 与 related works 全部随之更新。
const slug = computed(() => String(route.params.slug ?? ''))
const work = computed(() => findWorkBySlug(slug.value))

// 首次直达（SSR）：不存在立即抛出 fatal 404，由 HTML 错误页处理（契约不变）；
// 客户端同组件内切换到不存在 slug 时由下方 watch 经 showError 进入同一错误页。
if (!work.value) {
  throw createError({
    statusCode: 404,
    statusMessage: '作品不存在或尚未发布',
    fatal: true,
  })
}

watch(work, (entry) => {
  if (!entry) {
    showError({
      statusCode: 404,
      statusMessage: '作品不存在或尚未发布',
      fatal: true,
    })
  }
})

const dto = computed(() => work.value!.dto)

useSeoMeta({
  title: computed(() => `${dto.value.characterName} · 作品展示 · ${PROJECT_NAME}`),
  description: computed(() => `${dto.value.characterName}：${dto.value.species}，${SUIT_TYPE_LABELS[dto.value.suitType]}。有点小狗工作室兽装作品档案。`),
  ogTitle: computed(() => `${dto.value.characterName} · ${PROJECT_NAME}`),
  ogDescription: computed(() => `${dto.value.species} · ${SUIT_TYPE_LABELS[dto.value.suitType]} · 兽装作品档案`),
  ogType: 'article',
})

const priceLabel = computed(() => {
  if (dto.value.purpose !== 'adoption') {
    return ''
  }
  return dto.value.adoptionMethod === 'event_drop' ? '掉落价格' : '领养价格'
})

const priceText = computed(() => {
  if (dto.value.purpose !== 'adoption' || !dto.value.price) {
    return null
  }
  return formatCnyMinorUnits(dto.value.price.minorUnits)
})

const relatedWorks = computed(() =>
  workCatalog.filter(entry => entry.dto.slug !== dto.value.slug).slice(0, 4),
)

const RELATED_SIZES = '(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw'
</script>

<template>
  <article v-if="work" class="work-detail" data-testid="work-detail" :data-work-slug="dto.slug">
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
      <WorkDetailGallery :gallery="work.gallery" :work-name="dto.characterName" />

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
            公开人民币价格；后续沟通通过邮件或线下完成，网站不接受登记、定金或付款。
          </p>
        </section>
      </div>
    </div>

    <section class="work-detail__related" aria-labelledby="work-related-title">
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
          :key="entry.dto.id"
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
  padding: var(--space-4) var(--public-page-padding) var(--space-6);
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
    grid-template-columns: repeat(4, minmax(0, 1fr));
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

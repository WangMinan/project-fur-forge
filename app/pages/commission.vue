<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicCommissionHeroResponseSchema } from '~~/shared/schemas/home'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

/**
 * T26 自设委托页：SSR 消费 /api/public/v1/site-content（固定内容 + 委托营业状态）
 * 与 /api/public/v1/commission-hero（委托页独立代表作品宽图）。自由文案为 null 时整区隐藏；
 * 制作范围、人工逐单估价机制与邮件行动为已确认结构性事实，不编造业务文案。
 */
useSeoMeta({
  title: `自设委托 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}的自设委托：全装与半装制作范围、当前营业状态、邮件人工逐单估价与已确认常见问题。`,
  ogTitle: `自设委托 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}的自设委托：制作范围、营业状态与邮件人工逐单估价。`,
})

const { data: site, error: siteError } = await useFetch('/api/public/v1/site-content', {
  key: 'public-site-content',
  headers: useRequestHeaders(['host']),
  transform: raw => publicSiteContentResponseSchema.parse(raw).data,
})

if (siteError.value) {
  throw createError({ statusCode: 500, statusMessage: '自设委托暂时无法显示' })
}

const { data: hero, error: heroError } = await useFetch('/api/public/v1/commission-hero', {
  key: 'public-commission-hero',
  headers: useRequestHeaders(['host']),
  transform: raw => publicCommissionHeroResponseSchema.parse(raw).data,
})

if (heroError.value) {
  throw createError({ statusCode: 500, statusMessage: '自设委托暂时无法显示' })
}

const commission = computed(() => site.value?.commission ?? null)
const status = computed(() => site.value?.statuses.commission ?? null)
const heroSlide = computed(() => hero.value?.slide ?? null)
const faqs = computed(() => commission.value?.faqs ?? [])

function paragraphs(value: string | null | undefined) {
  return value ? splitPlainTextParagraphs(value) : []
}

const introText = computed(() => commission.value?.intro ?? undefined)
const estimateParagraphs = computed(() => paragraphs(commission.value?.estimateNote))
const emailActionParagraphs = computed(() => paragraphs(commission.value?.emailAction))
</script>

<template>
  <div class="commission-page" data-testid="commission-page">
    <PublicPageIntro
      title="自设委托"
      :description="heroSlide ? undefined : introText"
    />

    <div class="commission-page__body">
      <section
        v-if="status && !heroSlide"
        class="commission-page__status"
        aria-label="当前委托营业状态"
        data-testid="commission-status"
      >
        <PublicBusinessStatus :status="status" />
      </section>

      <CommissionLead
        v-if="heroSlide"
        :slide="heroSlide"
        :status="status"
        :email="commission?.email"
        :description="introText"
        data-testid="commission-hero"
      />

      <section
        id="commission-details"
        class="commission-page__section"
        aria-labelledby="commission-scope-title"
      >
        <h2 id="commission-scope-title" class="commission-page__section-title">制作范围</h2>
        <ul class="commission-page__scope" role="list">
          <li class="commission-page__scope-item">
            <h3 class="commission-page__scope-name">全装</h3>
            <p class="commission-page__scope-detail">完整兽装制作。</p>
          </li>
          <li class="commission-page__scope-item">
            <h3 class="commission-page__scope-name">半装</h3>
            <p class="commission-page__scope-detail">由头、爪、尾巴组成。</p>
          </li>
        </ul>
      </section>

      <section class="commission-page__section" aria-labelledby="commission-estimate-title">
        <h2 id="commission-estimate-title" class="commission-page__section-title">估价与联系</h2>
        <p class="commission-page__mechanism">
          委托价格由工作室按设定与需求人工逐单估价，本站不提供自动报价或固定价目。
        </p>
        <p
          v-for="(paragraph, index) in estimateParagraphs"
          :key="index"
          class="commission-page__text"
        >
          {{ paragraph }}
        </p>

        <div v-if="commission" class="commission-page__actions">
          <ContactEmailActions
            :email="commission.email"
            subject="自设委托估价咨询"
          />
          <p
            v-for="(paragraph, index) in emailActionParagraphs"
            :key="index"
            class="commission-page__text commission-page__text--muted"
          >
            {{ paragraph }}
          </p>
        </div>

        <p class="commission-page__more-contact">
          邮箱之外的联系方式见
          <NuxtLink to="/contact" class="commission-page__inline-link">联系页</NuxtLink>。
        </p>
      </section>

      <section
        v-if="faqs.length > 0"
        class="commission-page__section"
        aria-labelledby="commission-faq-title"
        data-testid="commission-faq"
      >
        <h2 id="commission-faq-title" class="commission-page__section-title">常见问题</h2>
        <ul class="commission-page__faq" role="list">
          <li v-for="faq in faqs" :key="faq.question" class="commission-page__faq-item">
            <h3 class="commission-page__faq-question">{{ faq.question }}</h3>
            <p class="commission-page__faq-answer">{{ faq.answer }}</p>
          </li>
        </ul>
      </section>

      <p v-if="commission" class="commission-page__terms">
        <NuxtLink :to="commission.termsHref" class="commission-page__terms-link">
          查看基本约定 <span aria-hidden="true">→</span>
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.commission-page__body {
  display: grid;
  gap: var(--space-8);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-9);
}

.commission-page__status {
  padding: var(--space-4) var(--space-5);
  background: var(--public-bg-secondary);
  border-radius: var(--radius-md);
}

.commission-page__section {
  display: grid;
  gap: var(--space-4);
  max-width: var(--public-content-reading);
}

#commission-details {
  scroll-margin-top: calc(var(--space-8) + var(--space-4));
}

.commission-page__section-title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

.commission-page__scope {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 768px) {
  .commission-page__scope {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.commission-page__scope-item {
  padding: var(--space-4) var(--space-5);
  background: var(--public-bg-secondary);
  border-radius: var(--radius-md);
}

.commission-page__scope-name {
  margin: 0;
  font-size: var(--font-size-md);
}

.commission-page__scope-detail {
  margin-top: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.commission-page__mechanism {
  line-height: var(--line-height-relaxed);
}

.commission-page__text {
  line-height: var(--line-height-relaxed);
  white-space: pre-line;
}

.commission-page__text--muted {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.commission-page__actions {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-2);
}

.commission-page__more-contact {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.commission-page__inline-link:hover {
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

.commission-page__faq {
  display: grid;
  gap: var(--space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.commission-page__faq-question {
  margin: 0;
  font-size: var(--font-size-base);
}

.commission-page__faq-answer {
  margin-top: var(--space-2);
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
  white-space: pre-line;
}

.commission-page__terms-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.commission-page__terms-link:hover {
  text-decoration: underline;
  text-underline-offset: 0.3em;
}
</style>

<script setup lang="ts">
import { localizedSiteCopy } from '~~/shared/utils/site-copy'
import { publicCommissionHeroResponseSchema } from '~~/shared/schemas/home'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'
const { t, contactOnly, language } = usePublicI18n()

/**
 * 自设委托页：SSR 消费固定内容、委托营业状态和独立横/竖 Hero。
 * 视觉组合只重排既有投影；制作范围、人工逐单估价与站内提交保持既有契约。
 */
usePublicSeo('commissions')

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

const commission = computed(() => localizedSiteCopy(site.value?.copy, language.value, 'commission'))
const contact = computed(() => site.value?.contact ?? null)
const status = computed(() => site.value?.statuses.commission ?? null)
function paragraphs(value: string | null | undefined) {
  return value ? splitPlainTextParagraphs(value) : []
}

const introText = computed(() => commission.value.intro ?? undefined)
const estimateParagraphs = computed(() => paragraphs(commission.value.estimateNote))
const estimateLead = computed(() => estimateParagraphs.value[0])
const estimateDetails = computed(() => estimateParagraphs.value.slice(1))
const emailActionParagraphs = computed(() => paragraphs(commission.value.emailAction))
</script>

<template>
  <div class="commission-page" data-testid="commission-page">
    <div class="commission-page__body">
      <CommissionLead
        v-if="hero"
        :x-contact-url="site?.contact.xContactUrl"
        :hero="hero"
        :status="status"
        :copy="site?.copy"
        :description="introText"
        data-testid="commission-hero"
      />

      <div id="commission-details" class="commission-page__grid">
        <section
          class="commission-page__section commission-page__section--scope"
          aria-labelledby="commission-scope-title"
        >
          <h2 id="commission-scope-title" class="commission-page__section-title">{{ t('ui.scope') }}</h2>
          <dl class="commission-page__scope">
            <div class="commission-page__scope-row">
              <span class="commission-page__scope-index" aria-hidden="true">01</span>
              <div>
                <dt class="commission-page__scope-name">
                  {{ t('ui.fullsuit') }}
                </dt>
                <dd class="commission-page__scope-detail">{{ t('ui.fullsuitDetail') }}</dd>
              </div>
            </div>
            <div class="commission-page__scope-row">
              <span class="commission-page__scope-index" aria-hidden="true">02</span>
              <div>
                <dt class="commission-page__scope-name">
                  {{ t('ui.partial') }}
                </dt>
                <dd class="commission-page__scope-detail">{{ t('ui.partialDetail') }}</dd>
              </div>
            </div>
          </dl>
        </section>

        <section class="commission-page__section" aria-labelledby="commission-estimate-title">
          <h2 id="commission-estimate-title" class="commission-page__section-title">{{ t('ui.estimateContact') }}</h2>
          <p v-if="estimateLead" class="commission-page__mechanism">
            {{ estimateLead }}
          </p>
          <p
            v-for="(paragraph, index) in estimateDetails"
            :key="index"
            class="commission-page__text"
          >
            {{ paragraph }}
          </p>

          <p
            v-for="(paragraph, index) in emailActionParagraphs"
            :key="index"
            class="commission-page__text commission-page__text--muted"
          >
            {{ paragraph }}
          </p>

          <ContactChannelList
            v-if="contact && commission"
            :x-contact-url="site?.contact.xContactUrl"
            :channels="contact.officialChannels"
            :email="site!.commission.email"
            :email-subject="contactOnly ? undefined : '自设委托估价咨询'"
          />

          <div class="commission-page__links">
            <PublicAction v-if="commission" variant="text" :to="site!.commission.termsHref">
              {{ t('ui.terms') }}
            </PublicAction>
            <PublicAction variant="text" to="/about#contact">
              {{ t('ui.fullContact') }}
            </PublicAction>
          </div>
        </section>
      </div>

      <p v-if="!contactOnly"><a :href="site?.contact.xContactUrl">{{ t('contact.international') }}</a></p>
      <PublicAction
        variant="text"
        class="commission-page__wayfinding"
        :to="contactOnly ? undefined : '/commission/apply'" :href="contactOnly ? site?.contact.xContactUrl : undefined"
        :aria-label="t('ui.enterApplication')"
      >
        <span>{{ t('ui.startApplication') }}</span>
        <span class="commission-page__wayfinding-rule" />
        <span>{{ t('ui.fillForm') }}</span>
      </PublicAction>
    </div>
  </div>
</template>

<style scoped>
.commission-page__body {
  display: grid;
  gap: clamp(3rem, 7vw, 6rem);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 1.25rem var(--public-page-padding) 3rem;
}

.commission-page__grid {
  display: grid;
  gap: 3.5rem;
  width: 100%;
}

.commission-page__section {
  display: grid;
  align-content: start;
  gap: var(--space-4);
  min-width: 0;
}

.commission-page__section:not(.commission-page__section--scope) {
  padding-top: 3.5rem;
  border-top: 1px solid var(--public-border-secondary);
}

#commission-details {
  scroll-margin-top: calc(var(--space-8) + var(--space-4));
}

.commission-page__section-title {
  font-family: var(--font-role-display);
  font-size: clamp(2rem, 4vw, 3.75rem);
  font-weight: 600;
  line-height: 1;
}

.commission-page__scope {
  margin: 0;
  border-top: 1px solid var(--public-text-primary);
}

.commission-page__scope-row {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: 1.25rem;
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--public-border-primary);
}

.commission-page__scope-index {
  color: var(--public-text-secondary);
  font-family: var(--font-role-metadata);
  font-size: 0.6875rem;
}

.commission-page__scope-name {
  font-family: var(--font-role-display);
  font-size: 1.75rem;
  line-height: 1;
}

.commission-page__scope-detail {
  margin: 0.65rem 0 0;
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}

.commission-page__mechanism {
  width: 100%;
  max-width: none;
  font-family: var(--font-role-display);
  font-size: clamp(1.125rem, 1.5vw, 1.5rem);
  line-height: 1.6;
}

.commission-page__text {
  line-height: var(--line-height-relaxed);
  white-space: pre-line;
}

.commission-page__text--muted {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.commission-page__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  padding-top: var(--space-3);
  border-top: 1px solid var(--public-border-secondary);
}

.commission-page__wayfinding {
  display: grid;
  grid-template-columns: auto minmax(2rem, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.75rem;
  color: var(--public-text-secondary);
  font-family: var(--font-role-metadata);
  font-size: 0.6875rem;
  line-height: 1.2;
  text-decoration: none;
}

.commission-page__wayfinding-rule {
  height: 1px;
  background: var(--public-border-primary);
}

.commission-page__wayfinding:hover {
  color: var(--public-text-primary);
}

.commission-page__wayfinding:focus-visible {
  outline: 1px solid currentcolor;
  outline-offset: 4px;
}

@media (min-width: 1024px) {
  .commission-page__grid {
    grid-template-columns: minmax(0, 3fr) minmax(0, 7fr);
    align-items: start;
    column-gap: 1.5rem;
  }

  .commission-page__section--scope {
    grid-column: 1;
  }

  .commission-page__section:not(.commission-page__section--scope) {
    grid-column: 2;
    padding-top: 0;
    padding-left: 1.5rem;
    border-top: 0;
    border-left: 1px solid var(--public-border-secondary);
  }
}
</style>

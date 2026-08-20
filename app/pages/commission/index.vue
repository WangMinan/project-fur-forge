<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicCommissionHeroResponseSchema } from '~~/shared/schemas/home'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

/**
 * 自设委托页：SSR 消费 /api/public/v1/site-content（固定内容 + 委托营业状态）
 * 与 /api/public/v1/commission-hero（委托页独立代表作品宽图）。自由文案为 null 时整区隐藏；
 * 制作范围、人工逐单估价机制与站内提交为已确认结构性事实，不编造业务文案。
 */
useSeoMeta({
  title: `自设委托 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}的自设委托：全装与半装制作范围、当前营业状态与站内申请。`,
  ogTitle: `自设委托 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}的自设委托：制作范围、营业状态与站内申请。`,
})

const route = useRoute()

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
const contact = computed(() => site.value?.contact ?? null)
const status = computed(() => site.value?.statuses.commission ?? null)
const sharedViewTransitionName = computed(() => (
  route.query.view === 'home-commission' ? 'home-commission-media' : undefined
))
const heroReady = computed(() => Boolean(
  hero.value?.landscape[0] && hero.value?.portrait[0],
))

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
      :description="heroReady ? undefined : introText"
    />

    <div class="commission-page__body">
      <section
        v-if="status && !heroReady"
        class="commission-page__status"
        aria-label="当前委托营业状态"
        data-testid="commission-status"
      >
        <PublicBusinessStatus :status="status" />
      </section>

      <CommissionLead
        v-if="heroReady && hero"
        :hero="hero"
        :status="status"
        :description="introText"
        :view-transition-name="sharedViewTransitionName"
        data-testid="commission-hero"
      />

      <!--
        大图之后不再是一条细长的左对齐文字带：制作范围与估价联系并列成两栏，
        窄屏回落为上下堆叠。两个「查看…」尾链接收进同一条带分隔线的页脚行，
        不再单独悬在左下角。
      -->
      <div id="commission-details" class="commission-page__grid">
        <section
          class="commission-page__section commission-page__section--scope"
          aria-labelledby="commission-scope-title"
        >
          <h2 id="commission-scope-title" class="commission-page__section-title">制作范围</h2>
          <!--
            两个并列选项，各只有一句说明。用术语表而不是卡片：
            一句话撑不起一个灰底方块，反而显得空。
          -->
          <dl class="commission-page__scope">
            <div class="commission-page__scope-row">
              <dt class="commission-page__scope-name">全装</dt>
              <dd class="commission-page__scope-detail">完整兽装制作</dd>
            </div>
            <div class="commission-page__scope-row">
              <dt class="commission-page__scope-name">半装</dt>
              <dd class="commission-page__scope-detail">头、爪</dd>
            </div>
          </dl>
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

          <!-- 三个行动同一行：站内申请是主行动，邮件两个按钮跟在后面。 -->
          <div class="commission-page__actions">
            <PublicAction to="/commission/apply">
              提交委托申请
            </PublicAction>
            <ContactEmailActions
              v-if="commission"
              :email="commission.email"
              subject="自设委托估价咨询"
            />
          </div>

          <p class="commission-page__text commission-page__text--muted">
            邮箱是备用联系渠道；申请请优先使用站内表单。
          </p>
          <p
            v-for="(paragraph, index) in emailActionParagraphs"
            :key="index"
            class="commission-page__text commission-page__text--muted"
          >
            {{ paragraph }}
          </p>

          <ContactChannelGrid
            v-if="contact"
            :channels="contact.officialChannels"
          />

          <!-- 两个延伸阅读入口跟在正文后面成一组次级按钮：
               原来是页面最底一条分隔线、两个链接分列左右，和上文断开，很突兀。 -->
          <div class="commission-page__links">
            <PublicAction v-if="commission" variant="secondary" :to="commission.termsHref">
              服务条款
            </PublicAction>
            <PublicAction variant="secondary" to="/about#contact">
              完整联系说明
            </PublicAction>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.commission-page__body {
  display: grid;
  gap: var(--space-8);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-7);
}

.commission-page__status {
  padding: var(--space-4) var(--space-5);
  background: var(--public-bg-secondary);
  border-radius: var(--radius-md);
}

/**
 * 制作范围（窄）与估价联系（阅读宽度）并列，整组在 90rem 页宽里居中。
 * 单栏时正文仍限制在易读宽度，不会被拉成满页宽的长行。
 */
.commission-page__grid {
  display: grid;
  gap: var(--space-8);
  width: 100%;
  max-width: var(--public-content-reading);
  margin-inline: auto;
}

@media (min-width: 1024px) {
  .commission-page__grid {
    grid-template-columns: minmax(0, 16rem) minmax(0, var(--public-content-reading));
    justify-content: center;
    align-items: start;
    column-gap: clamp(var(--space-6), 4vw, var(--space-8));
    max-width: var(--public-content-wide);
  }
}

.commission-page__section {
  display: grid;
  align-content: start;
  gap: var(--space-4);
  min-width: 0;
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

/**
 * 制作范围：术语表式的两行，靠细分隔线区分，不用灰底卡片。
 * 名称与说明同一行基线对齐，因此一句话的内容看起来是「一条事实」，
 * 而不是一个填不满的方块。
 */
.commission-page__scope {
  margin: 0;
  border-top: 1px solid var(--public-border-secondary);
}

.commission-page__scope-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--public-border-secondary);
}

.commission-page__scope-name {
  flex: none;
  min-width: 4rem;
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
}

.commission-page__scope-detail {
  margin: 0;
  color: var(--public-text-secondary);
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
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

/* 延伸阅读做成一组次级胶囊按钮，跟正文同一栏、同一左边线。 */
.commission-page__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

</style>

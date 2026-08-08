<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

/**
 * T27 关于页：SSR 消费 /api/public/v1/site-content。
 * 工作室事实、制作范围与联系区均来自公开安全投影；
 * 联系区合并原 /contact 页面，不虚构品牌故事或联系方式。
 */
useSeoMeta({
  title: `关于我们 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}的工作室事实、制作范围与官方联系方式。`,
  ogTitle: `关于我们 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}的工作室事实、制作范围与官方联系方式。`,
})

const { data: site, error } = await useFetch('/api/public/v1/site-content', {
  key: 'public-site-content',
  headers: useRequestHeaders(['host']),
  transform: raw => publicSiteContentResponseSchema.parse(raw).data,
})

if (error.value) {
  throw createError({ statusCode: 500, statusMessage: '关于我们暂时无法显示' })
}

const about = computed(() => site.value?.about ?? null)
const contact = computed(() => site.value?.contact ?? null)

function paragraphs(value: string | null | undefined) {
  return value ? splitPlainTextParagraphs(value) : []
}

const factParagraphs = computed(() => paragraphs(about.value?.studioFacts))
const scopeParagraphs = computed(() => paragraphs(about.value?.makingScope))
const antiScamParagraphs = computed(() => paragraphs(contact.value?.antiScam))
</script>

<template>
  <div class="about-page" data-testid="about-page">
    <PublicPageIntro title="关于我们" description="了解工作室、制作范围与官方联系方式。" />

    <div class="about-page__body">
      <section
        v-if="factParagraphs.length > 0"
        class="about-page__section"
        aria-labelledby="about-facts-title"
        data-testid="about-facts"
      >
        <h2 id="about-facts-title" class="about-page__section-title">工作室</h2>
        <p v-for="(paragraph, index) in factParagraphs" :key="index" class="about-page__text">
          {{ paragraph }}
        </p>
      </section>

      <section
        v-if="scopeParagraphs.length > 0"
        class="about-page__section"
        aria-labelledby="about-scope-title"
        data-testid="about-scope"
      >
        <h2 id="about-scope-title" class="about-page__section-title">制作范围</h2>
        <p v-for="(paragraph, index) in scopeParagraphs" :key="index" class="about-page__text">
          {{ paragraph }}
        </p>
      </section>

      <section
        v-if="contact"
        id="contact"
        class="about-page__section about-page__contact"
        aria-labelledby="about-contact-title"
        data-testid="about-contact"
      >
        <h2 id="about-contact-title" class="about-page__section-title">联系</h2>
        <p class="about-page__text about-page__text--muted">
          委托与领养通过以下官方渠道人工沟通；本站不提供站内留言或在线提交。
        </p>
        <ContactEmailActions :email="contact.email" />
        <ul class="about-page__channels" role="list">
          <li>
            <span class="about-page__channel-label">QQ</span>
            <span class="about-page__channel-value">{{ contact.qq }}</span>
          </li>
          <li v-if="contact.douyin">
            <span class="about-page__channel-label">抖音</span>
            <span class="about-page__channel-value">{{ contact.douyin }}</span>
          </li>
        </ul>
        <div v-if="antiScamParagraphs.length > 0" class="about-page__antiscam">
          <h3 class="about-page__subsection-title">防诈骗提示</h3>
          <p
            v-for="(paragraph, index) in antiScamParagraphs"
            :key="index"
            class="about-page__text"
          >
            {{ paragraph }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.about-page__body {
  display: grid;
  gap: var(--space-8);
  max-width: var(--public-content-article);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-7);
}

.about-page__section {
  display: grid;
  gap: var(--space-4);
}

.about-page__section-title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

.about-page__contact {
  scroll-margin-top: var(--space-8);
}

.about-page__text {
  line-height: var(--line-height-relaxed);
  white-space: pre-line;
}

.about-page__text--muted {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.about-page__channels {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.about-page__antiscam {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--public-bg-secondary);
  border-radius: var(--radius-md);
}

.about-page__subsection-title {
  font-size: var(--font-size-base);
  font-weight: 600;
}

.about-page__channels li {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.about-page__channel-label {
  flex: none;
  min-width: 4.5em;
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
}

.about-page__channel-value {
  overflow-wrap: anywhere;
}

</style>

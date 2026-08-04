<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

/**
 * T27 关于页：SSR 消费 /api/public/v1/site-content。
 * 工作室事实、制作范围、基本约定为 null 时整区隐藏或显示真实未发布状态；
 * 官方渠道（邮箱/QQ/抖音）为已确认登记值。不虚构品牌故事。
 */
useSeoMeta({
  title: `关于我们 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}的工作室事实、制作范围、官方渠道与基本约定。`,
  ogTitle: `关于我们 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}的工作室事实、制作范围、官方渠道与基本约定。`,
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
const channels = computed(() => about.value?.officialChannels ?? null)

function paragraphs(value: string | null | undefined) {
  return value ? splitPlainTextParagraphs(value) : []
}

const factParagraphs = computed(() => paragraphs(about.value?.studioFacts))
const scopeParagraphs = computed(() => paragraphs(about.value?.makingScope))
const termsParagraphs = computed(() => paragraphs(about.value?.basicTerms))
</script>

<template>
  <div class="about-page" data-testid="about-page">
    <PublicPageIntro title="关于我们" />

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
        v-if="channels"
        class="about-page__section"
        aria-labelledby="about-channels-title"
        data-testid="about-channels"
      >
        <h2 id="about-channels-title" class="about-page__section-title">官方渠道</h2>
        <ul class="about-page__channels" role="list">
          <li>
            <span class="about-page__channel-label">业务邮箱</span>
            <a :href="`mailto:${channels.email}`" class="about-page__channel-link">
              {{ channels.email }}
            </a>
          </li>
          <li>
            <span class="about-page__channel-label">QQ</span>
            <span class="about-page__channel-value">{{ channels.qq }}</span>
          </li>
          <li v-if="channels.douyin">
            <span class="about-page__channel-label">抖音</span>
            <span class="about-page__channel-value">{{ channels.douyin }}</span>
          </li>
        </ul>
      </section>

      <section
        id="terms"
        class="about-page__section about-page__terms"
        aria-labelledby="about-terms-title"
        data-testid="about-terms"
      >
        <h2 id="about-terms-title" class="about-page__section-title">基本约定</h2>
        <template v-if="termsParagraphs.length > 0">
          <p v-for="(paragraph, index) in termsParagraphs" :key="index" class="about-page__text">
            {{ paragraph }}
          </p>
        </template>
        <p v-else class="about-page__text about-page__text--muted">
          基本约定尚未发布；委托或领养前，请通过官方渠道与工作室确认具体安排。
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.about-page__body {
  display: grid;
  gap: var(--space-8);
  max-width: var(--public-content-reading);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-9);
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

.about-page__terms {
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

.about-page__channel-link {
  overflow-wrap: anywhere;
}

.about-page__channel-link:hover {
  text-decoration: underline;
  text-underline-offset: 0.3em;
}
</style>

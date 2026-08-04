<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

/**
 * T27 联系页：SSR 消费 /api/public/v1/site-content。
 * 邮箱为主行动（打开邮件客户端 / 复制邮箱），QQ、抖音与防诈骗提示来自公开投影；
 * 防诈骗文字为 null 时整区隐藏，不显示伪造占位；本站不提供站内发送。
 */
useSeoMeta({
  title: `联系 · ${PROJECT_NAME}`,
  description: `通过业务邮箱、QQ 或抖音联系${PROJECT_NAME}。`,
  ogTitle: `联系 · ${PROJECT_NAME}`,
  ogDescription: `通过业务邮箱、QQ 或抖音联系${PROJECT_NAME}。`,
})

const { data: site, error } = await useFetch('/api/public/v1/site-content', {
  key: 'public-site-content',
  headers: useRequestHeaders(['host']),
  transform: raw => publicSiteContentResponseSchema.parse(raw).data,
})

if (error.value) {
  throw createError({ statusCode: 500, statusMessage: '联系页暂时无法显示' })
}

const contact = computed(() => site.value?.contact ?? null)
const antiScamParagraphs = computed(() =>
  contact.value?.antiScam ? splitPlainTextParagraphs(contact.value.antiScam) : [],
)
</script>

<template>
  <div class="contact-page" data-testid="contact-page">
    <PublicPageIntro
      title="联系"
      description="委托与领养通过以下官方渠道人工沟通；本站不提供站内留言或在线提交。"
    />

    <div v-if="contact" class="contact-page__body">
      <section class="contact-page__section" aria-labelledby="contact-email-title">
        <h2 id="contact-email-title" class="contact-page__section-title">邮件</h2>
        <ContactEmailActions :email="contact.email" />
      </section>

      <section class="contact-page__section" aria-labelledby="contact-channels-title">
        <h2 id="contact-channels-title" class="contact-page__section-title">其他官方渠道</h2>
        <ul class="contact-page__channels" role="list">
          <li>
            <span class="contact-page__channel-label">QQ</span>
            <span class="contact-page__channel-value">{{ contact.qq }}</span>
          </li>
          <li v-if="contact.douyin">
            <span class="contact-page__channel-label">抖音</span>
            <span class="contact-page__channel-value">{{ contact.douyin }}</span>
          </li>
        </ul>
      </section>

      <section
        v-if="antiScamParagraphs.length > 0"
        class="contact-page__section contact-page__antiscam"
        aria-labelledby="contact-antiscam-title"
        data-testid="contact-antiscam"
      >
        <h2 id="contact-antiscam-title" class="contact-page__section-title">防诈骗提示</h2>
        <p
          v-for="(paragraph, index) in antiScamParagraphs"
          :key="index"
          class="contact-page__text"
        >
          {{ paragraph }}
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.contact-page__body {
  display: grid;
  gap: var(--space-8);
  max-width: var(--public-content-reading);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-9);
}

.contact-page__section {
  display: grid;
  gap: var(--space-4);
}

.contact-page__section-title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

.contact-page__channels {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.contact-page__channels li {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.contact-page__channel-label {
  flex: none;
  min-width: 4.5em;
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
}

.contact-page__channel-value {
  overflow-wrap: anywhere;
}

.contact-page__antiscam {
  padding: var(--space-4) var(--space-5);
  background: var(--public-bg-secondary);
  border-radius: var(--radius-md);
}

.contact-page__text {
  line-height: var(--line-height-relaxed);
  white-space: pre-line;
}
</style>

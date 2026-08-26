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
    <header class="about-masthead">
      <p class="about-masthead__word" aria-hidden="true">ABOUT</p>
      <div class="about-masthead__inner">
        <div class="about-masthead__heading">
          <p class="about-masthead__studio">有点小狗工作室</p>
          <h1 class="about-masthead__title">关于我们</h1>
        </div>
        <div class="about-masthead__summary">
          <p>了解工作室、制作范围与官方联系方式。</p>
          <a class="about-masthead__wayfinding" href="#contact">
            前往联系方式
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>
    </header>

    <div class="about-story">
      <section
        v-if="factParagraphs.length > 0"
        class="about-story__facts"
        aria-labelledby="about-facts-title"
        data-testid="about-facts"
      >
        <h2 id="about-facts-title" class="about-story__title">工作室</h2>
        <div class="about-story__facts-copy">
          <p v-for="(paragraph, index) in factParagraphs" :key="index" class="about-story__text">
            {{ paragraph }}
          </p>
        </div>
      </section>

      <aside
        v-if="scopeParagraphs.length > 0"
        class="about-story__scope"
        aria-labelledby="about-scope-title"
        data-testid="about-scope"
      >
        <h2 id="about-scope-title" class="about-story__title">制作范围</h2>
        <div class="about-story__scope-copy">
          <p v-for="(paragraph, index) in scopeParagraphs" :key="index" class="about-story__text">
            {{ paragraph }}
          </p>
        </div>
      </aside>
    </div>

    <section
      v-if="contact"
      id="contact"
      class="about-contact"
      aria-labelledby="about-contact-title"
      data-testid="about-contact"
    >
      <div class="about-contact__inner">
        <div class="about-contact__intro">
          <p class="about-contact__label">联系方式</p>
          <h2 id="about-contact-title" class="about-contact__title">联系我们</h2>
          <p class="about-contact__description">
            委托申请可通过站内表单私密提交；邮箱、QQ 与 QQ群用于后续人工沟通和备用联系。
          </p>
          <PublicAction class="about-contact__primary" to="/commission/apply">
            提交委托申请
          </PublicAction>
        </div>

        <div class="about-contact__directory">
          <ContactEmailActions class="about-contact__email" :email="contact.email" show-address />

          <div v-if="contact.officialChannels.length > 0" class="about-contact__channels">
            <h3 class="about-contact__channels-title">官方 QQ 渠道</h3>
            <ContactChannelGrid :channels="contact.officialChannels" />
          </div>
        </div>

        <aside
          v-if="antiScamParagraphs.length > 0"
          class="about-contact__notice"
          aria-labelledby="about-antiscam-title"
        >
          <h3 id="about-antiscam-title" class="about-contact__notice-title">防诈骗提示</h3>
          <div class="about-contact__notice-copy">
            <p
              v-for="(paragraph, index) in antiScamParagraphs"
              :key="index"
              class="about-contact__notice-text"
            >
              {{ paragraph }}
            </p>
          </div>
        </aside>
      </div>
    </section>
  </div>
</template>

<style scoped>
.about-page {
  overflow: clip;
}

.about-masthead {
  position: relative;
  min-height: 18rem;
  overflow: hidden;
  border-bottom: 1px solid var(--public-border-secondary);
}

.about-masthead__word {
  position: absolute;
  top: 1.5rem;
  left: max(var(--public-page-padding), calc((100% - var(--public-content-wide)) / 2));
  color: var(--public-background-type);
  font-family: var(--font-role-display-sans);
  font-size: 5rem;
  font-weight: 700;
  line-height: 0.8;
  pointer-events: none;
  user-select: none;
}

.about-masthead__inner {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 18rem;
  align-content: end;
  gap: var(--space-6);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-8) var(--public-page-padding) var(--space-6);
}

.about-masthead__heading {
  display: grid;
  gap: var(--space-3);
}

.about-masthead__studio,
.about-contact__label {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0;
}

.about-masthead__title {
  font-family: var(--font-role-display);
  font-size: 3rem;
  font-weight: 600;
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.about-masthead__summary {
  display: grid;
  justify-items: start;
  gap: var(--space-4);
  max-width: 28rem;
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}

.about-masthead__wayfinding {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: var(--space-2);
  color: var(--public-text-primary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.about-masthead__wayfinding:hover {
  color: var(--public-accent-hover);
}

.about-story {
  display: grid;
  gap: var(--space-8);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-7) var(--public-page-padding);
}

.about-story__facts,
.about-story__scope {
  display: grid;
  align-content: start;
  gap: var(--space-5);
  min-width: 0;
}

.about-story__title,
.about-contact__channels-title,
.about-contact__notice-title {
  font-size: var(--font-size-sm);
  font-weight: 700;
  line-height: var(--line-height-heading);
}

.about-story__facts-copy,
.about-contact__notice-copy {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

.about-story__facts-copy,
.about-story__scope-copy {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  font-family: var(--font-role-body);
  font-size: var(--font-size-md);
  line-height: var(--line-height-relaxed);
}

.about-story__scope {
  padding-top: var(--space-5);
  border-top: 1px solid var(--public-border-primary);
}

.about-story__text,
.about-contact__description,
.about-contact__notice-text {
  line-height: var(--line-height-relaxed);
  white-space: pre-line;
}

.about-contact {
  background: var(--public-bg-secondary);
  border-top: 1px solid var(--public-border-secondary);
  border-bottom: 1px solid var(--public-border-secondary);
}

.about-contact__inner {
  display: grid;
  gap: var(--space-8);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-8) var(--public-page-padding);
}

.about-contact__intro {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: var(--space-4);
  max-width: 29rem;
}

.about-contact__title {
  font-family: var(--font-role-display);
  font-size: 2.25rem;
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: 0;
}

.about-contact__description {
  color: var(--public-text-secondary);
}

.about-contact__primary {
  margin-top: var(--space-2);
}

.about-contact__directory {
  display: grid;
  align-content: start;
  align-items: start;
  gap: var(--space-7);
  min-width: 0;
}

.about-contact__channels {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
  padding-top: var(--space-5);
  border-top: 1px solid var(--public-border-primary);
}

.about-contact__notice {
  display: grid;
  gap: var(--space-4);
  width: 100%;
  min-width: 0;
  padding-left: var(--space-4);
  border-left: 2px solid var(--public-border-primary);
}

.about-contact__notice-copy {
  max-width: var(--public-content-reading);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

@media (min-width: 768px) {
  .about-masthead__inner {
    grid-template-columns: minmax(0, 1.3fr) minmax(20rem, 0.7fr);
    align-items: end;
    gap: var(--space-8);
  }

  .about-masthead__title {
    font-size: 4rem;
  }

  .about-masthead__word {
    top: 2rem;
    font-size: 7.5rem;
  }

  .about-story {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-7);
  }

  .about-story__scope {
    padding-top: 0;
    padding-left: var(--space-6);
    border-top: 0;
    border-left: 1px solid var(--public-border-primary);
  }

  .about-contact__directory {
    grid-template-columns: minmax(11rem, 0.7fr) minmax(0, 1.3fr);
    gap: 0;
  }

  .about-contact__channels {
    padding-top: 0;
    padding-left: var(--space-5);
    border-top: 0;
    border-left: 1px solid var(--public-border-primary);
  }

  .about-contact__email {
    align-self: center;
  }

  .about-contact__email :deep(.email-actions__address) {
    font-size: var(--font-size-base);
  }

  .about-contact__channels :deep(.contact-channel-grid) {
    grid-template-columns: repeat(2, minmax(0, 9.5rem));
    gap: var(--space-5);
  }

  .about-contact__notice {
    grid-template-columns: minmax(10rem, 0.3fr) minmax(0, 1fr);
    gap: var(--space-6);
  }
}

@media (min-width: 1024px) {
  .about-masthead,
  .about-masthead__inner {
    min-height: 15rem;
  }

  .about-masthead__inner {
    padding-top: var(--space-7);
    padding-bottom: var(--space-5);
  }

  .about-masthead__title {
    font-size: 4rem;
  }

  .about-masthead__word {
    font-size: 7rem;
  }

  .about-story {
    padding-top: var(--space-6);
    padding-bottom: var(--space-6);
  }

  .about-contact__inner {
    grid-template-columns: minmax(18rem, 32%) minmax(0, 1fr);
    column-gap: var(--space-6);
    row-gap: var(--space-5);
    padding-top: var(--space-7);
    padding-bottom: var(--space-7);
  }

  .about-contact__title {
    font-size: 3rem;
  }

  .about-contact__directory {
    align-self: center;
  }

  .about-contact__notice {
    grid-column: 1 / -1;
  }
}
</style>

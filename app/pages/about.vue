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
</script>

<template>
  <div class="about-page" data-testid="about-page">
    <header class="about-masthead">
      <p class="about-masthead__word" aria-hidden="true">ABOUT</p>
      <img
        class="about-masthead__mark"
        src="/brand/logo-mark.png"
        alt=""
        aria-hidden="true"
        width="1600"
        height="1600"
      >
      <div class="about-masthead__title-group">
        <h1 class="about-masthead__title">关于我们</h1>
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
            委托请先提交站内申请；确认可以制作后，我们会通过官方 QQ 继续沟通。
          </p>
          <PublicAction class="about-contact__primary" to="/commission/apply">
            提交委托申请
          </PublicAction>
        </div>

        <div class="about-contact__directory">
          <ContactChannelList
            :channels="contact.officialChannels"
            :email="contact.email"
          />
        </div>
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
  display: grid;
  align-content: end;
  min-height: clamp(10rem, 14vw, 13rem);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-4) var(--public-page-padding);
  overflow: clip;
  isolation: isolate;
}

.about-masthead__word {
  position: absolute;
  inset: clamp(1rem, 2vw, 1.75rem) 0 auto;
  z-index: -1;
  color: var(--public-background-type);
  font-family: var(--font-role-display-sans);
  font-size: clamp(6rem, 11vw, 10rem);
  font-weight: 700;
  line-height: 0.66;
  letter-spacing: var(--type-display-letter-spacing);
  pointer-events: none;
  user-select: none;
}

.about-masthead__mark {
  position: absolute;
  inset: clamp(-1.5rem, -1.2vw, -0.75rem) clamp(0.5rem, 3vw, 3rem) auto auto;
  z-index: -1;
  width: clamp(13rem, 18vw, 17rem);
  height: auto;
  object-fit: contain;
  opacity: 0.055;
  filter: grayscale(1);
  transform: translate(8%, -8%) rotate(12deg);
  transform-origin: center;
  pointer-events: none;
  user-select: none;
}

.about-contact__label {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0;
}

.about-masthead__title-group {
  width: min(100%, 38rem);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--public-text-primary);
}

.about-masthead__title {
  margin-top: var(--space-1);
  font-family: var(--font-role-display);
  font-size: clamp(3.5rem, 5.5vw, 5.5rem);
  font-weight: var(--type-display-weight);
  line-height: 0.9;
  letter-spacing: var(--type-display-letter-spacing);
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

.about-story__title {
  font-size: var(--font-size-sm);
  font-weight: 700;
  line-height: var(--line-height-heading);
}

.about-story__facts-copy {
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
}

.about-story__text,
.about-contact__description {
  line-height: var(--line-height-relaxed);
  white-space: pre-line;
}

.about-contact {
  background: var(--public-bg-primary);
  border-top: 1px solid var(--public-border-secondary);
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

@media (min-width: 768px) {
  .about-story {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-7);
  }

  .about-story__scope {
    padding-top: 0;
  }
}

@media (min-width: 1024px) {
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
}

@media (max-width: 767px) {
  .about-masthead {
    min-height: 10.5rem;
    padding-top: var(--space-4);
    padding-bottom: var(--space-3);
  }

  .about-masthead__word {
    inset-block-start: 2.25rem;
    font-size: clamp(2.35rem, 9.8vw, 4rem);
    line-height: 0.72;
  }

  .about-masthead__mark {
    inset: 0.5rem -1rem auto auto;
    width: 7.5rem;
    opacity: 0.045;
    transform: rotate(12deg);
  }

  .about-masthead__title {
    font-size: clamp(3rem, 14vw, 3.75rem);
  }
}
</style>

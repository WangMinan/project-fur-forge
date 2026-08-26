<script setup lang="ts">
const props = defineProps<{
  content: string | null
  title: string
}>()

const structuredContent = computed(() => structureNumberedPlainText(props.content ?? ''))
const hasContent = computed(() => structuredContent.value.preface.length > 0
  || structuredContent.value.sections.length > 0)
const documentMeta = computed(() => `${structuredContent.value.sections.length} 个章节`)
</script>

<template>
  <div id="document-top" class="legal-document">
    <PublicPageIntro :title="title" :meta="documentMeta" variant="document" />

    <div v-if="hasContent" class="legal-document__layout">
      <nav
        v-if="structuredContent.sections.length > 1"
        class="legal-document__contents"
        :aria-label="`${title}目录`"
      >
        <div class="legal-document__contents-heading">
          <p class="legal-document__contents-label">章节导航</p>
          <p class="legal-document__contents-count">{{ structuredContent.sections.length }} 节</p>
        </div>
        <ol class="legal-document__contents-list">
          <li v-for="section in structuredContent.sections" :key="section.id">
            <a class="legal-document__contents-link" :href="`#${section.id}`">
              <span class="legal-document__contents-number">{{ section.number.padStart(2, '0') }}</span>
              <span>{{ section.title }}</span>
            </a>
          </li>
        </ol>
      </nav>

      <article class="legal-document__body">
        <div v-if="structuredContent.preface.length" class="legal-document__preface">
          <p
            v-for="(paragraph, index) in structuredContent.preface"
            :key="index"
            class="legal-document__text"
          >
            {{ paragraph }}
          </p>
        </div>

        <section
          v-for="section in structuredContent.sections"
          :key="section.id"
          class="legal-document__section"
          :aria-labelledby="section.id"
        >
          <header class="legal-document__section-heading">
            <span class="legal-document__section-number" aria-hidden="true">
              {{ section.number.padStart(2, '0') }}
            </span>
            <h2 :id="section.id" class="legal-document__section-title" tabindex="-1">
              {{ section.title }}
            </h2>
          </header>
          <p
            v-for="(paragraph, index) in section.paragraphs"
            :key="index"
            class="legal-document__text"
          >
            {{ paragraph }}
          </p>
        </section>

        <a class="legal-document__back-to-top" href="#document-top">
          返回页首 <span aria-hidden="true">↑</span>
        </a>
      </article>
    </div>
  </div>
</template>

<style scoped>
.legal-document__layout {
  display: grid;
  gap: var(--space-8);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-6) var(--public-page-padding) var(--space-9);
}

.legal-document__contents {
  padding-block: var(--space-3);
  border-top: 2px solid var(--public-text-primary);
  border-bottom: 1px solid var(--public-border-primary);
}

.legal-document__contents-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.legal-document__contents-label {
  color: var(--public-text-tertiary);
  font-family: var(--font-role-metadata);
  font-size: var(--type-metadata-size);
  font-weight: var(--type-metadata-weight);
  line-height: var(--type-metadata-line-height);
}

.legal-document__contents-count {
  color: var(--public-text-tertiary);
  font-family: var(--font-role-metadata);
  font-size: var(--type-metadata-size);
  font-weight: var(--type-metadata-weight);
  font-variant-numeric: tabular-nums;
  line-height: var(--type-metadata-line-height);
}

.legal-document__contents-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-1) var(--space-4);
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.legal-document__contents-link {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr);
  align-items: center;
  min-height: 2.75rem;
  color: var(--public-text-secondary);
  font-family: var(--font-role-ui);
  font-size: var(--type-ui-size);
  font-weight: var(--type-ui-weight);
  line-height: var(--type-ui-line-height);
  text-underline-offset: 0.2em;
}

.legal-document__contents-link:hover,
.legal-document__contents-link:focus-visible {
  color: var(--public-text-link);
  text-decoration: underline;
}

.legal-document__contents-number,
.legal-document__section-number {
  color: var(--public-text-tertiary);
  font-family: var(--font-role-metadata);
  font-size: var(--type-metadata-size);
  font-weight: var(--type-metadata-weight);
  line-height: var(--type-metadata-line-height);
  font-variant-numeric: tabular-nums;
}

.legal-document__body {
  display: grid;
  gap: var(--space-9);
  min-width: 0;
  max-width: 46rem;
  font-family: var(--font-role-legal);
  font-size: var(--type-legal-size);
  font-weight: var(--type-legal-weight);
}

.legal-document__preface,
.legal-document__section {
  display: grid;
  gap: var(--space-4);
}

.legal-document__preface {
  padding-left: var(--space-4);
  border-left: 2px solid var(--public-border-primary);
  font-size: var(--font-size-md);
}

.legal-document__section {
  padding-top: var(--space-6);
  border-top: 1px solid var(--public-border-primary);
}

.legal-document__section-heading {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  align-items: baseline;
  gap: var(--space-2);
}

.legal-document__section-title {
  font-family: var(--font-role-display);
  font-size: var(--type-display-item-size);
  font-weight: var(--type-display-weight);
  line-height: var(--type-display-line-height);
  letter-spacing: var(--type-display-letter-spacing);
}

.legal-document__text {
  line-height: var(--type-legal-line-height);
  white-space: pre-line;
}

.legal-document__back-to-top {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  min-height: 2.75rem;
  color: var(--public-text-secondary);
  font-family: var(--font-role-ui);
  font-size: var(--type-ui-size);
  font-weight: var(--type-ui-weight);
  line-height: var(--type-ui-line-height);
}

.legal-document__back-to-top:hover,
.legal-document__back-to-top:focus-visible {
  color: var(--public-text-link);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

@media (min-width: 1024px) {
  .legal-document__layout {
    grid-template-columns: minmax(13rem, 15rem) minmax(0, 46rem);
    justify-content: center;
    align-items: start;
    gap: var(--space-10);
    padding-top: var(--space-8);
  }

  .legal-document__contents {
    position: sticky;
    top: calc(var(--public-header-height) + var(--space-5));
    padding-block: var(--space-4);
  }

  .legal-document__contents-list {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
const props = defineProps<{
  content: string | null
  title: string
}>()

const structuredContent = computed(() => structureNumberedPlainText(props.content ?? ''))
const hasContent = computed(() => structuredContent.value.preface.length > 0
  || structuredContent.value.sections.length > 0)
</script>

<template>
  <div class="legal-document">
    <PublicPageIntro :title="title" />

    <div v-if="hasContent" class="legal-document__layout">
      <nav
        v-if="structuredContent.sections.length > 1"
        class="legal-document__contents"
        :aria-label="`${title}目录`"
      >
        <p class="legal-document__contents-label">本页目录</p>
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
      </article>
    </div>
  </div>
</template>

<style scoped>
.legal-document__layout {
  display: grid;
  gap: var(--space-7);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-8);
}

.legal-document__contents {
  padding-block: var(--space-3);
  border-block: 1px solid var(--public-border-secondary);
}

.legal-document__contents-label {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.legal-document__contents-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-1) var(--space-3);
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
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.legal-document__contents-link:hover {
  color: var(--public-text-link);
}

.legal-document__contents-number,
.legal-document__section-number {
  color: var(--public-text-tertiary);
  font-family: var(--font-public-mono);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.legal-document__body {
  display: grid;
  gap: var(--space-8);
  min-width: 0;
  max-width: var(--public-content-reading);
}

.legal-document__preface,
.legal-document__section {
  display: grid;
  gap: var(--space-4);
}

.legal-document__section {
  padding-top: var(--space-5);
  border-top: 1px solid var(--public-border-secondary);
}

.legal-document__section-heading {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  align-items: baseline;
  gap: var(--space-2);
}

.legal-document__section-title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

.legal-document__text {
  line-height: 1.9;
  white-space: pre-line;
}

@media (min-width: 1024px) {
  .legal-document__layout {
    grid-template-columns: minmax(12rem, 16rem) minmax(0, var(--public-content-reading));
    justify-content: center;
    align-items: start;
    gap: var(--space-9);
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

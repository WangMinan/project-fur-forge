<script setup lang="ts">
const props = defineProps<{
  content: string | null
  title: string
}>()

const paragraphs = computed(() => props.content
  ? splitPlainTextParagraphs(props.content)
  : [])
</script>

<template>
  <div class="legal-document">
    <PublicPageIntro :title="title" />

    <article v-if="paragraphs.length > 0" class="legal-document__body">
      <p v-for="(paragraph, index) in paragraphs" :key="index" class="legal-document__text">
        {{ paragraph }}
      </p>
    </article>
  </div>
</template>

<style scoped>
.legal-document__body {
  display: grid;
  gap: var(--space-5);
  max-width: var(--public-content-article);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-10);
}

.legal-document__text {
  line-height: 1.9;
  white-space: pre-line;
}
</style>

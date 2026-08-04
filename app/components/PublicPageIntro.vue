<script setup lang="ts">
/** 内页紧凑页名区：页名 + 一句必要说明，不与作品图争夺层级。 */
defineProps<{
  title: string
  description?: string | undefined
}>()
</script>

<template>
  <header class="page-intro">
    <h1 class="page-intro__title">
      {{ title }}
    </h1>
    <p v-if="description" class="page-intro__description">
      {{ description }}
    </p>
  </header>
</template>

<style scoped>
.page-intro {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-7) var(--public-page-padding) var(--space-5);
}

.page-intro__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.page-intro__description {
  max-width: var(--public-content-reading);
  margin-top: var(--space-3);
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}
</style>

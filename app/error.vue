<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const statusCode = computed(() => props.error.statusCode || 500)
const isNotFound = computed(() => statusCode.value === 404)
const title = computed(() =>
  isNotFound.value ? '页面未找到' : '页面暂时无法显示',
)
const description = computed(() =>
  isNotFound.value
    ? '访问的页面不存在、尚未发布或已经下架。'
    : '服务器暂时无法完成请求，请稍后重试。',
)

useHead(() => ({
  title: `${statusCode.value} · ${title.value} · 有点小狗工作室`,
}))
</script>

<template>
  <main class="error-page">
    <p class="error-page__code">
      {{ statusCode }}
    </p>
    <h1 class="error-page__title">
      {{ title }}
    </h1>
    <p class="error-page__description">
      {{ description }}
    </p>
    <a
      class="error-page__link"
      href="/"
      @click.prevent="clearError({ redirect: '/' })"
    >
      返回首页
    </a>
  </main>
</template>

<style scoped>
.error-page {
  display: grid;
  min-height: 100vh;
  padding: 2rem;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  place-content: center;
  justify-items: start;
}

.error-page__code {
  color: var(--public-accent-primary);
  font-size: var(--font-size-sm);
  letter-spacing: var(--letter-spacing-label);
}

.error-page__title {
  margin-top: var(--space-2);
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  line-height: var(--line-height-heading);
}

.error-page__description {
  max-width: 32rem;
  margin-top: var(--space-3);
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}

.error-page__link {
  margin-top: var(--space-5);
  color: var(--public-text-link);
  text-underline-offset: 0.25em;
}
</style>

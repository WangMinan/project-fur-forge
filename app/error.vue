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
  <div class="error-shell public-error-enter">
    <PublicHeader brand-only />
    <main class="error-page" data-testid="public-error-page">
      <PublicEmptyState
        :eyebrow="String(statusCode)"
        :title="title"
        :description="description"
        heading="h1"
      >
        <PublicAction
          href="/"
          @click.prevent="clearError({ redirect: '/' })"
        >返回首页</PublicAction>
      </PublicEmptyState>
    </main>
  </div>
</template>

<style scoped>
.error-shell {
  display: grid;
  min-height: 100svh;
  background: var(--public-bg-primary);
  grid-template-rows: auto 1fr;
}

.error-page {
  display: grid;
  padding: var(--public-page-padding);
  place-content: center;
}
</style>

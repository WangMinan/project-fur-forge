<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicUpdateListResponseSchema } from '~~/shared/schemas/update'

const SEO_DESCRIPTION = '工作室的参展资讯、掉落预告、开单通知与其它最新消息。'

useSeoMeta({
  title: `最新动态 · ${PROJECT_NAME}`,
  description: SEO_DESCRIPTION,
  ogTitle: `最新动态 · ${PROJECT_NAME}`,
  ogDescription: SEO_DESCRIPTION,
})

const { data, error, status } = await useFetch('/api/public/v1/updates', {
  key: 'public-updates',
  headers: useRequestHeaders(['host']),
  transform: raw => publicUpdateListResponseSchema.parse(raw).data,
})

const items = computed(() => data.value ?? [])
</script>

<template>
  <div class="public-page updates-page" data-testid="updates-page">
    <PublicPageIntro
      title="最新动态"
      description="参展、掉落与开单消息会在这里统一发布。"
    />

    <main class="updates-page__body">
      <PublicEmptyState
        v-if="status === 'idle' || status === 'pending'"
        title="正在加载最新动态"
      />
      <PublicEmptyState
        v-else-if="error"
        title="最新动态暂时无法显示"
        description="请稍后重新打开本页。"
      >
        <NuxtLink to="/updates">重新加载</NuxtLink>
      </PublicEmptyState>
      <PublicEmptyState
        v-else-if="items.length === 0"
        title="暂时没有公开动态"
        description="参展、掉落与开单消息发布后会出现在这里。"
      />
      <PublicUpdateList v-else :items="items" />
    </main>
  </div>
</template>

<style scoped>
.updates-page__body {
  max-width: var(--public-content-article);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-8);
}

.updates-page__body :deep(.empty-state) {
  padding-right: 0;
  padding-left: 0;
}
</style>

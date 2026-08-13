<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import {
  publicUpdateListResponseSchema,
  UPDATE_TYPE_VALUES,
} from '~~/shared/schemas/update'
import type { UpdateType } from '~~/shared/types/contracts'
import { UPDATE_TYPE_LABELS } from '~/utils/update-labels'

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

const route = useRoute()
const items = computed(() => data.value ?? [])
const selectedType = computed<'all' | UpdateType>(() => {
  const raw = Array.isArray(route.query.type)
    ? route.query.type[0]
    : route.query.type
  return UPDATE_TYPE_VALUES.includes(raw as UpdateType)
    ? raw as UpdateType
    : 'all'
})
const filteredItems = computed(() => selectedType.value === 'all'
  ? items.value
  : items.value.filter(item => item.type === selectedType.value))
const typeOptions = computed(() => [
  { key: 'all', label: '全部', to: '/updates' },
  ...UPDATE_TYPE_VALUES.map(type => ({
    key: type,
    label: UPDATE_TYPE_LABELS[type],
    to: { path: '/updates', query: { type } },
  })),
])
</script>

<template>
  <div class="public-page updates-page" data-testid="updates-page">
    <PublicPageIntro
      title="最新动态"
      description="参展、掉落与开单消息会在这里统一发布。"
    />

    <main class="updates-page__body">
      <div class="updates-page__filters" data-testid="updates-type-filter">
        <PublicFilterChips
          label="资讯类型筛选"
          :options="typeOptions"
          :selected="selectedType"
        />
      </div>

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
      <PublicEmptyState
        v-else-if="filteredItems.length === 0"
        title="当前类型暂时没有动态"
      >
        <NuxtLink to="/updates">查看全部动态</NuxtLink>
      </PublicEmptyState>
      <PublicUpdateList v-else :items="filteredItems" />
    </main>
  </div>
</template>

<style scoped>
.updates-page__body {
  max-width: var(--public-content-article);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-8);
}

.updates-page__filters {
  margin-bottom: var(--space-5);
}

.updates-page__body :deep(.empty-state) {
  padding-right: 0;
  padding-left: 0;
}
</style>

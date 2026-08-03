<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicAdoptionListResponseSchema } from '~~/shared/schemas/public-content'

useSeoMeta({
  title: `角色领养 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}当前公开的常规领养角色，查看完整横版设定图、状态、属性与人民币价格。`,
  ogTitle: `角色领养 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}当前公开的常规领养角色。`,
})

const { data: list, error } = await useFetch('/api/public/v1/adoptions', {
  key: 'public-adoptions-list',
  headers: useRequestHeaders(['host']),
  transform: raw => publicAdoptionListResponseSchema.parse(raw).data,
})

if (error.value) {
  throw createError({ statusCode: 500, statusMessage: '角色领养暂时无法显示' })
}

const items = computed(() => list.value?.items ?? [])
</script>

<template>
  <main class="adoptions-page">
    <PublicPageIntro
      title="角色领养"
      description="完整查看角色设定与公开状态；后续沟通通过工作室公开联系方式在线下完成。"
    />

    <div v-if="items.length > 0" class="adoptions-page__content">
      <p class="adoptions-page__count" role="status">共 {{ items.length }} 个可浏览角色</p>
      <ul class="adoptions-page__grid" role="list">
        <li v-for="adoption in items" :key="adoption.work.id">
          <AdoptionCard :adoption="adoption" />
        </li>
      </ul>
    </div>

    <PublicEmptyState
      v-else
      title="当前没有已发布的常规领养"
      description="这里会只展示已经完成设定图、状态与公开资料的真实角色。你仍可先浏览工作室作品。"
    >
      <NuxtLink to="/works">浏览作品展示</NuxtLink>
    </PublicEmptyState>
  </main>
</template>

<style scoped>
.adoptions-page {
  min-height: 60vh;
}

.adoptions-page__content {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-10);
}

.adoptions-page__count {
  margin-bottom: var(--space-5);
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
}

.adoptions-page__grid {
  display: grid;
  gap: var(--space-8) var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 768px) {
  .adoptions-page__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

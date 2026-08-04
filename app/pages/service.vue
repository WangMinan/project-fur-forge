<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

useSeoMeta({
  title: `服务条款 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}的委托、领养、作品权利与售后服务条款。`,
  ogTitle: `服务条款 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}的委托、领养、作品权利与售后服务条款。`,
})

const { data: site, error } = await useFetch('/api/public/v1/site-content', {
  key: 'public-service-site-content',
  headers: useRequestHeaders(['host']),
  transform: raw => publicSiteContentResponseSchema.parse(raw).data,
})

if (error.value) {
  throw createError({ statusCode: 500, statusMessage: '服务条款暂时无法显示' })
}

const content = computed(() => site.value?.about.basicTerms ?? null)
</script>

<template>
  <PublicLegalDocument title="服务条款" :content="content" />
</template>

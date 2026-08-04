<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

useSeoMeta({
  title: `隐私政策 · ${PROJECT_NAME}`,
  description: `${PROJECT_NAME}网站的信息收集、使用、保存与访客权利说明。`,
  ogTitle: `隐私政策 · ${PROJECT_NAME}`,
  ogDescription: `${PROJECT_NAME}网站的信息收集、使用、保存与访客权利说明。`,
})

const { data: site, error } = await useFetch('/api/public/v1/site-content', {
  key: 'public-privacy-site-content',
  headers: useRequestHeaders(['host']),
  transform: raw => publicSiteContentResponseSchema.parse(raw).data,
})

if (error.value) {
  throw createError({ statusCode: 500, statusMessage: '隐私政策暂时无法显示' })
}

const content = computed(() => site.value?.about.privacyPolicy ?? null)
</script>

<template>
  <PublicLegalDocument title="隐私政策" :content="content" />
</template>

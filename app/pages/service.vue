<script setup lang="ts">
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'
const { t } = usePublicI18n()

usePublicSeo('terms')

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
  <PublicLegalDocument
    :title="t('ui.terms')"
    :description="t('contact.channelNote')"
    :content="content"
  />
</template>

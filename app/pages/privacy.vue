<script setup lang="ts">
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'
const { t } = usePublicI18n()

usePublicSeo('privacy')

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
  <PublicLegalDocument :title="t('ui.privacy')" :content="content" />
</template>

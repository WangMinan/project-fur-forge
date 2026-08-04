<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import {
  publicCommissionHeroResponseSchema,
  publicHomeResponseSchema,
} from '~~/shared/schemas/home'
import { publicAdoptionListResponseSchema } from '~~/shared/schemas/public-content'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'

useSeoMeta({
  title: `${PROJECT_NAME} · 兽装作品主页`,
  description:
    '有点小狗工作室（dite dog）的兽装作品主页：浏览全装与半装作品，了解自设委托人工估价与角色领养的真实营业状态。',
})

// T20 首页双源轮播：SSR 消费公开首页投影（口号、自动轮播设置、启用轮播项）。
const { data: home, error: homeError } = await useFetch('/api/public/v1/home', {
  key: 'public-home',
  headers: useRequestHeaders(['host']),
  transform: raw => publicHomeResponseSchema.parse(raw).data,
})

if (homeError.value) {
  throw createError({ statusCode: 500, statusMessage: '首页暂时无法显示' })
}

const { data: commissionHero, error: commissionHeroError } = await useFetch(
  '/api/public/v1/commission-hero',
  {
    key: 'public-home-commission-hero',
    headers: useRequestHeaders(['host']),
    transform: raw => publicCommissionHeroResponseSchema.parse(raw).data,
  },
)

const { data: site, error: siteError } = await useFetch('/api/public/v1/site-content', {
  key: 'public-home-site-content',
  headers: useRequestHeaders(['host']),
  transform: raw => publicSiteContentResponseSchema.parse(raw).data,
})

const { data: adoptions, error: adoptionsError } = await useFetch('/api/public/v1/adoptions', {
  key: 'public-home-adoptions',
  headers: useRequestHeaders(['host']),
  transform: raw => publicAdoptionListResponseSchema.parse(raw).data,
})

if (commissionHeroError.value || siteError.value || adoptionsError.value) {
  throw createError({ statusCode: 500, statusMessage: '首页暂时无法显示' })
}

</script>

<template>
  <div class="public-home" data-testid="public-home">
    <HomeHeroCarousel v-if="home" :home="home" />

    <FeaturedWorks />

    <HomeContinuation
      v-if="site"
      :adoptions="adoptions?.items ?? []"
      :commission-slide="commissionHero?.slide ?? null"
      :statuses="site.statuses"
    />
  </div>
</template>

<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicHomepageResponseSchema } from '~~/shared/schemas/home'

useSeoMeta({
  title: `${PROJECT_NAME} · 兽装作品主页`,
  description:
    '有点小狗工作室（dite dog）的兽装作品主页：浏览全装与半装作品，了解自设委托人工估价与角色领养的真实营业状态。',
})

// T34-F2 首页聚合投影：Hero、精选、统一业务入口和当前领养在同一
// SQLite 快照内完成，非关键区块不再通过四个独立请求放大故障。
const { data: homepage, error } = await useFetch('/api/public/v1/homepage', {
  key: 'public-homepage',
  headers: useRequestHeaders(['host']),
  transform: raw => publicHomepageResponseSchema.parse(raw).data,
})

if (error.value || !homepage.value) {
  throw createError({ statusCode: 500, statusMessage: '首页暂时无法显示' })
}
</script>

<template>
  <div class="public-home" data-testid="public-home">
    <HomeHeroCarousel :home="homepage.hero" />

    <FeaturedWorks :works="homepage.featured.items" />

    <HomeContinuation
      :adoptions="homepage.currentAdoptions"
      :entries="homepage.entries"
    />
  </div>
</template>

<script setup lang="ts">
import { publicHomeAggregateResponseSchema } from '~~/shared/schemas/public-content'
import { useHomeSectionNavigation } from '~/composables/useHomeSectionNavigation'


const { pageTitle, pageDescription } = usePublicSeo('home')

/**
 * T34-F2：首页只消费一个聚合投影，避免多接口重复查询和故障放大。
 * Hero 与页面骨架是关键区块；精选作品与当前领养由服务端标记可用性后受控降级。
 *
 * 区块顺序与公开站 IA 一致：Hero → 精选作品 → 统一业务入口 → 当前领养 → 页脚。
 * 作品优先于业务入口：页面首先服务兽装作品的观看。
 */
const { data: home, error: homeError } = await useFetch(
  '/api/public/v1/home-aggregate',
  {
    key: 'public-home-aggregate',
    headers: useRequestHeaders(['host']),
    transform: raw => publicHomeAggregateResponseSchema.parse(raw).data,
  },
)

if (homeError.value) {
  throw createError({ statusCode: 500, statusMessage: '首页暂时无法显示' })
}

const homeRef = useTemplateRef<HTMLElement>('home')
useHomeSectionNavigation(homeRef)

useHead({
  htmlAttrs: { class: 'home-scroll-navigation' },
})
</script>

<template>
  <div
    v-if="home"
    ref="home"
    class="public-home home-page"
    data-testid="public-home"
  >
    <Head>
      <Meta itemprop="name" :content="pageTitle" />
      <Meta itemprop="description" :content="pageDescription" />
    </Head>
    <HomeHeroCarousel :home="home.hero" :copy="home.copy" />

    <FeaturedWorks
      :works="home.featured.items"
      :available="home.featured.available"
    />

    <HomeBusinessEntries :x-contact-url="home.hero.xContactUrl" :entries="home.entries" :copy="home.copy" />

    <HomeCurrentAdoptions
      :adoptions="home.currentAdoptions.items"
      :available="home.currentAdoptions.available"
    />

  </div>
</template>

<style scoped>
/* 首页收尾留白由自己提供；内页页脚间距更紧凑。 */
.home-page {
  padding-bottom: 0;
}
</style>

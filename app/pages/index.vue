<script setup lang="ts">
import {
  businessStatusFixtures,
  routeCardFixtures,
} from '~~/shared/fixtures/visual-home'
import { PROJECT_NAME } from '~~/shared/constants/project'
import { publicHomeResponseSchema } from '~~/shared/schemas/home'

useSeoMeta({
  title: `${PROJECT_NAME} · 兽装作品主页`,
  description:
    '有点小狗工作室（dite dog）的兽装作品主页：浏览全装与半装作品，了解自设委托人工估价与角色领养的真实营业状态。',
})

// T20 首页双源轮播：SSR 消费公开首页投影（口号、自动轮播设置、启用轮播项）。
const { data: home } = await useFetch('/api/public/v1/home', {
  key: 'public-home',
  headers: useRequestHeaders(['host']),
  transform: raw => publicHomeResponseSchema.parse(raw).data,
})
</script>

<template>
  <div class="public-home" data-testid="public-home">
    <HomeHeroCarousel v-if="home" :home="home" />

    <FeaturedWorks />

    <section
      class="public-home__routes"
      aria-label="业务入口"
    >
      <ImageRouteCard
        v-for="card in routeCardFixtures"
        :key="card.href"
        :card="card"
        class="public-home__route"
      />
    </section>

    <section
      class="public-home__statuses"
      aria-label="营业状态"
    >
      <p class="public-home__statuses-label">
        营业状态
      </p>
      <BusinessStatusLine
        v-for="status in businessStatusFixtures"
        :key="status.kind"
        :status="status"
      />
    </section>
  </div>
</template>

<style scoped>
.public-home__routes {
  display: grid;
  gap: var(--space-4);
  max-width: var(--public-content-wide);
  margin: var(--space-9) auto 0;
  padding: 0 var(--public-page-padding);
}

.public-home__statuses {
  max-width: var(--public-content-wide);
  margin: var(--space-8) auto 0;
  padding: 0 var(--public-page-padding);
}

.public-home__statuses-label {
  margin-bottom: var(--space-2);
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
  letter-spacing: var(--letter-spacing-label);
}

@media (min-width: 768px) {
  .public-home__routes {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-5);
  }
}
</style>

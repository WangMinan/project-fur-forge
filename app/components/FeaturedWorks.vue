<script setup lang="ts">
import { publicFeaturedWorksResponseSchema } from '~~/shared/schemas/public-content'

/**
 * 首页精选轨道：SSR 消费 /api/public/v1/works/featured 的真实精选投影。
 * 人工顺序由服务端投影保证；无精选作品时整区隐藏（首屏不出现空轨道）。
 */
const { data: featured } = await useFetch('/api/public/v1/works/featured', {
  key: 'public-featured-works',
  headers: useRequestHeaders(['host']),
  transform: raw => publicFeaturedWorksResponseSchema.parse(raw).data,
})

const works = computed(() => featured.value?.items ?? [])
</script>

<template>
  <section
    v-if="works.length > 0"
    class="featured-works"
    aria-labelledby="featured-works-title"
    data-testid="featured-works"
  >
    <header class="featured-works__header">
      <h2 id="featured-works-title" class="featured-works__title">
        精选作品
      </h2>
      <NuxtLink to="/works" class="featured-works__more">
        查看全部作品
        <span aria-hidden="true">→</span>
      </NuxtLink>
    </header>

    <FeaturedTrack :works="works" />
  </section>
</template>

<style scoped>
.featured-works {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-9) var(--public-page-padding) 0;
}

.featured-works__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.featured-works__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.featured-works__more {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
}

.featured-works__more:hover {
  text-decoration: underline;
  text-underline-offset: 0.3em;
}
</style>

<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'

/** 首页精选轨道由聚合首页投影提供，避免子组件再次读取数据库。 */
const props = defineProps<{
  works: PublicWorkSummaryDto[]
}>()
</script>

<template>
  <section
    v-if="props.works.length > 0"
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

    <FeaturedTrack :works="props.works" />
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

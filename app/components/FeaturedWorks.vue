<script setup lang="ts">
import type { PublicWorkSummaryDto } from '~~/shared/types/contracts'

/**
 * 首页精选轨道：人工顺序由服务端聚合投影保证。
 * T34-F2 起由首页聚合传入，不再自行请求，精选异常不再放大为整页 500。
 */
const props = defineProps<{
  available: boolean
  works: PublicWorkSummaryDto[]
}>()

const works = computed(() => (props.available ? props.works : []))
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
      <PublicAction to="/works" variant="text" class="featured-works__more">
        查看全部作品
        <span aria-hidden="true">→</span>
      </PublicAction>
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

.featured-works__more { flex-shrink: 0; }
</style>

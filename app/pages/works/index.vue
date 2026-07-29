<script setup lang="ts">
import { workCatalog } from '~~/shared/fixtures/visual-works'
import { PROJECT_NAME } from '~~/shared/constants/project'

useSeoMeta({
  title: `作品展示 · ${PROJECT_NAME}`,
  description:
    '有点小狗工作室的兽装作品展示：按人工顺序浏览全装与半装的委托、领养与展示作品，支持用途与装型交集筛选。',
})

const route = useRoute()
const filter = computed(() => parseWorkFilter(route.query))
const filteredWorks = computed(() => filterWorks(workCatalog, filter.value))
const filterActive = computed(() => !isWorkFilterEmpty(filter.value))

const GRID_SIZES = '(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw'
</script>

<template>
  <div class="works-page" data-testid="works-page">
    <PublicPageIntro
      title="作品展示"
      description="浏览工作室全部的委托、领养与展示作品。"
    />

    <WorkFilterBar
      :filter="filter"
      :result-count="filteredWorks.length"
    />

    <section
      v-if="filteredWorks.length > 0"
      class="works-page__grid-section"
      aria-label="作品列表"
    >
      <div class="works-page__grid" data-testid="works-grid">
        <WorkCard
          v-for="work in filteredWorks"
          :key="work.dto.id"
          :work="work"
          :sizes="GRID_SIZES"
        />
      </div>
    </section>

    <PublicEmptyState
      v-else
      title="没有符合条件的作品"
      :description="filterActive ? '当前用途与装型的交集下暂时没有作品，可以清除筛选后浏览全部。' : '作品正在整理中，请稍后再来。'"
    >
      <NuxtLink v-if="filterActive" to="/works">
        清除筛选，查看全部作品
      </NuxtLink>
    </PublicEmptyState>
  </div>
</template>

<style scoped>
.works-page {
  padding-bottom: var(--space-2);
}

.works-page__grid-section {
  max-width: var(--public-content-wide);
  margin: var(--space-6) auto 0;
  padding: 0 var(--public-page-padding);
}

.works-page__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-6) var(--space-4);
}

@media (min-width: 768px) {
  .works-page__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-7) var(--space-5);
  }
}

@media (min-width: 1024px) {
  .works-page__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>

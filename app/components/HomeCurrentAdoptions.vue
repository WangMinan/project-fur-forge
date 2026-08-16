<script setup lang="ts">
import type { PublicAdoptionListItemDto } from '~~/shared/types/contracts'

/**
 * T34-F2 当前领养：入口与状态已合并到 HomeBusinessEntries，本区只保留真实领养。
 * 聚合投影标记该区块不可用时整区隐藏，不显示服务端错误详情。
 */
const props = defineProps<{
  adoptions: PublicAdoptionListItemDto[]
  available: boolean
}>()

const currentAdoptions = computed(() => props.adoptions.slice(0, 2))
</script>

<template>
  <section
    v-if="available && currentAdoptions.length > 0"
    class="home-adoptions"
    aria-labelledby="home-adoptions-title"
    data-testid="home-current-adoptions"
  >
    <header class="home-adoptions__header">
      <h2 id="home-adoptions-title" class="home-adoptions__title">设定领养</h2>
      <NuxtLink to="/adoptions" class="home-adoptions__more">
        查看全部 <span aria-hidden="true">→</span>
      </NuxtLink>
    </header>
    <ul class="home-adoptions__grid" role="list">
      <li v-for="adoption in currentAdoptions" :key="adoption.work.id">
        <AdoptionCard :adoption="adoption" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.home-adoptions {
  display: grid;
  gap: var(--space-5);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-9) var(--public-page-padding) 0;
}

.home-adoptions__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.home-adoptions__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

.home-adoptions__more {
  flex: none;
  color: var(--public-text-link);
  font-size: var(--font-size-sm);
}

.home-adoptions__more:hover,
.home-adoptions__more:focus-visible {
  color: var(--public-accent-hover);
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

.home-adoptions__grid {
  display: grid;
  gap: var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 768px) {
  .home-adoptions__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

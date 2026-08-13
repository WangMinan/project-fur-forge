<script setup lang="ts">
import type { PublicUpdateDto } from '~~/shared/types/contracts'

defineProps<{
  items: PublicUpdateDto[]
}>()
</script>

<template>
  <section
    class="home-updates"
    aria-labelledby="home-updates-title"
    data-testid="home-latest-updates"
  >
    <header class="home-updates__heading">
      <h2 id="home-updates-title" class="home-updates__title">最新动态</h2>
      <NuxtLink class="home-updates__more" to="/updates">
        查看全部 <span aria-hidden="true">→</span>
      </NuxtLink>
    </header>

    <PublicUpdateList :items="items" variant="summary" />
  </section>
</template>

<style scoped>
.home-updates {
  display: grid;
  gap: var(--space-5);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-9) var(--public-page-padding) 0;
}

.home-updates__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

.home-updates__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.home-updates__more {
  flex: none;
  color: var(--public-text-link);
  font-size: var(--font-size-sm);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.25em;
}

.home-updates__more:hover,
.home-updates__more:focus-visible {
  color: var(--public-accent-primary);
}

</style>

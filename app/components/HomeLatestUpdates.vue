<script setup lang="ts">
import type { PublicUpdateDto } from '~~/shared/types/contracts'
import {
  formatUpdateDateTime,
  UPDATE_TYPE_LABELS,
} from '~/utils/update-labels'

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

    <ol class="home-updates__list">
      <li v-for="item in items" :key="item.id" class="home-updates__item">
        <article>
          <div class="home-updates__meta">
            <span class="home-updates__type">{{ UPDATE_TYPE_LABELS[item.type] }}</span>
            <time :datetime="item.publishedAt">
              {{ formatUpdateDateTime(item.publishedAt) }}
            </time>
          </div>
          <h3 class="home-updates__item-title">{{ item.title }}</h3>
          <p class="home-updates__content">{{ item.content }}</p>
        </article>
      </li>
    </ol>
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
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.25em;
}

.home-updates__more:hover,
.home-updates__more:focus-visible {
  color: var(--public-accent-primary);
}

.home-updates__list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-updates__item {
  min-width: 0;
  padding-top: var(--space-4);
  border-top: 1px solid var(--public-border-secondary);
}

.home-updates__meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
}

.home-updates__type {
  color: var(--public-accent-primary);
  font-weight: 600;
}

.home-updates__item-title {
  margin-top: var(--space-3);
  overflow-wrap: anywhere;
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

.home-updates__content {
  display: -webkit-box;
  margin-top: var(--space-3);
  overflow: hidden;
  overflow-wrap: anywhere;
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

@media (max-width: 767px) {
  .home-updates__list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 479px) {
  .home-updates__meta {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
  }
}
</style>

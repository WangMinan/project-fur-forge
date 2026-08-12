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
  <ol class="update-list" aria-label="最新动态列表" data-testid="public-update-list">
    <li v-for="item in items" :key="item.id" class="update-list__item" :data-update-id="item.id">
      <article>
        <header class="update-list__header">
          <p class="update-list__type">{{ UPDATE_TYPE_LABELS[item.type] }}</p>
          <time class="update-list__time" :datetime="item.publishedAt">
            {{ formatUpdateDateTime(item.publishedAt) }}
          </time>
        </header>
        <h2 class="update-list__title">{{ item.title }}</h2>
        <!-- 始终使用 Vue 文本插值，不使用 v-html；换行只由 CSS 保留。 -->
        <p class="update-list__content">{{ item.content }}</p>
      </article>
    </li>
  </ol>
</template>

<style scoped>
.update-list {
  display: grid;
  gap: var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}

.update-list__item {
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--public-border-secondary);
}

.update-list__item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.update-list__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.update-list__type {
  color: var(--public-accent-primary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: var(--letter-spacing-label);
}

.update-list__time {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.update-list__title {
  margin-top: var(--space-3);
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

.update-list__content {
  max-width: var(--public-content-reading);
  margin-top: var(--space-4);
  overflow-wrap: anywhere;
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
}

@media (max-width: 479px) {
  .update-list__header {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
  }

  .update-list__time {
    white-space: normal;
  }
}
</style>

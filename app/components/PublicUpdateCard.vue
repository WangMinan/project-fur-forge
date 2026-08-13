<script setup lang="ts">
import type { PublicUpdateDto } from '~~/shared/types/contracts'
import {
  formatUpdateDateTime,
  UPDATE_TYPE_LABELS,
} from '~/utils/update-labels'

const props = withDefaults(defineProps<{
  item: PublicUpdateDto
  variant?: 'full' | 'summary'
}>(), {
  variant: 'full',
})

const headingTag = computed(() => props.variant === 'summary' ? 'h3' : 'h2')
</script>

<template>
  <article
    class="public-update-card"
    :class="`public-update-card--${variant}`"
    :data-update-type="item.type"
  >
    <header class="public-update-card__meta">
      <span class="public-update-card__type">
        <span class="public-update-card__dot" aria-hidden="true" />
        {{ UPDATE_TYPE_LABELS[item.type] }}
      </span>
      <time class="public-update-card__time" :datetime="item.publishedAt">
        {{ formatUpdateDateTime(item.publishedAt) }}
      </time>
    </header>
    <component :is="headingTag" class="public-update-card__title">
      {{ item.title }}
    </component>
    <!-- 始终使用 Vue 文本插值，不使用 v-html；换行只由 CSS 保留。 -->
    <p class="public-update-card__content update-list__content">{{ item.content }}</p>
  </article>
</template>

<style scoped>
.public-update-card {
  --update-type-color: var(--public-status-neutral);

  height: 100%;
  padding: var(--space-5);
  background: var(--public-bg-primary);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-md);
  box-shadow: 0 0.25rem 1.25rem rgb(25 31 42 / 0.06);
}

.public-update-card[data-update-type='event'] {
  --update-type-color: var(--public-accent-primary);
}

.public-update-card[data-update-type='drop'] {
  --update-type-color: var(--public-status-paused);
}

.public-update-card[data-update-type='commission_open'] {
  --update-type-color: var(--public-status-open);
}

.public-update-card__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.public-update-card__type {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--update-type-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: var(--letter-spacing-label);
}

.public-update-card__dot {
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  background: currentcolor;
  border-radius: var(--radius-full);
}

.public-update-card__time {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.public-update-card__title {
  margin-top: var(--space-3);
  overflow-wrap: anywhere;
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

.public-update-card__content {
  max-width: var(--public-content-reading);
  margin-top: var(--space-3);
  overflow-wrap: anywhere;
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
}

.public-update-card--summary .public-update-card__content {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

@media (max-width: 479px) {
  .public-update-card__meta {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
  }

  .public-update-card__time {
    white-space: normal;
  }
}
</style>

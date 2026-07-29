<script setup lang="ts">
import type { BusinessStatusFixture } from '~~/shared/fixtures/visual-home'

defineProps<{
  status: BusinessStatusFixture
}>()
</script>

<template>
  <NuxtLink :to="status.href" class="status-line" :data-tone="status.tone">
    <span class="status-line__dot" aria-hidden="true" />
    <span class="status-line__label">{{ status.label }}</span>
    <span class="status-line__detail">{{ status.detail }}</span>
    <span class="status-line__arrow" aria-hidden="true">→</span>
  </NuxtLink>
</template>

<style scoped>
.status-line {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  color: var(--public-text-primary);
  border-bottom: 1px solid var(--public-border-secondary);
}

.status-line:hover {
  color: var(--public-text-primary);
}

.status-line:hover .status-line__detail {
  color: var(--public-accent-primary);
}

.status-line__dot {
  align-self: center;
  width: 0.5rem;
  height: 0.5rem;
  flex-shrink: 0;
  background: var(--public-status-neutral);
  border-radius: var(--radius-full);
}

.status-line[data-tone='open'] .status-line__dot {
  background: var(--public-status-open);
}

.status-line[data-tone='paused'] .status-line__dot {
  background: var(--public-status-paused);
}

.status-line__label {
  font-size: var(--font-size-base);
  font-weight: 600;
}

.status-line__detail {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.status-line__arrow {
  margin-left: auto;
  color: var(--public-text-tertiary);
}
</style>

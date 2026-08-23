<script setup lang="ts">
import type { PublicSiteBusinessStatusDto } from '~~/shared/types/contracts'

defineProps<{
  status: PublicSiteBusinessStatusDto
}>()

const TONE_LABELS = {
  open: '开放中',
  closed: '暂不开放',
} as const
</script>

<template>
  <div
    class="home-business-status"
    :data-tone="status.tone"
    :data-status-label="status.label"
    data-testid="home-business-status"
  >
    <span class="home-business-status__dot" aria-hidden="true" />
    <span>{{ status.label }}</span>
    <small>{{ TONE_LABELS[status.tone] }}</small>
  </div>
</template>

<style scoped>
.home-business-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.home-business-status small {
  color: var(--public-text-tertiary);
}

.home-business-status__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: var(--public-text-tertiary);
}

.home-business-status[data-tone='open'] .home-business-status__dot {
  background: var(--status-open, #2f7a4d);
}

.home-business-status[data-tone='closed'] .home-business-status__dot {
  background: var(--status-closed, #8a8f98);
}
</style>

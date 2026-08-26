<script setup lang="ts">
import type { PublicSiteBusinessStatusDto } from '~~/shared/types/contracts'

// 委托营业状态徽章：状态点颜色由 tone 决定，只展示管理员维护的公开标签。
defineProps<{
  status: PublicSiteBusinessStatusDto
}>()
</script>

<template>
  <p class="business-status" :data-tone="status.tone">
    <span class="business-status__dot" aria-hidden="true" />
    <span class="business-status__label">{{ status.label }}</span>
  </p>
</template>

<style scoped>
.business-status {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
}

.business-status__dot {
  align-self: center;
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: var(--radius-full);
  background: var(--public-status-neutral);
}

.business-status[data-tone='open'] .business-status__dot {
  background: var(--public-status-open);
}

.business-status[data-tone='closed'] .business-status__dot {
  background: var(--public-status-paused);
}

.business-status__label {
  font-weight: 600;
}

</style>

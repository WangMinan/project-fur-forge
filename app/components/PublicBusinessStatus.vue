<script setup lang="ts">
import type { PublicSiteBusinessStatusDto } from '~~/shared/types/contracts'

// T26–T27 营业状态徽章：状态点颜色由 tone 决定，文字（标签/短说明）全部来自
// 管理端已保存值；无状态数据时父级整区隐藏，不渲染空徽章。
defineProps<{
  status: PublicSiteBusinessStatusDto
}>()
</script>

<template>
  <p class="business-status" :data-tone="status.tone">
    <span class="business-status__dot" aria-hidden="true" />
    <span class="business-status__label">{{ status.label }}</span>
    <span class="business-status__detail">{{ status.detail }}</span>
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

.business-status[data-tone='limited'] .business-status__dot {
  background: var(--public-status-paused);
}

.business-status[data-tone='closed'] .business-status__dot {
  background: var(--public-status-neutral);
}

.business-status__label {
  font-weight: 600;
}

.business-status__detail {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}
</style>

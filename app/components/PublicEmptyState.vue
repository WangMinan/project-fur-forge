<script setup lang="ts">
/** 公开站真实空状态：说明原因并给出恢复行动，不用假图或“后续开放”。 */
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="empty-state" data-testid="public-empty-state">
    <p class="empty-state__title">
      {{ title }}
    </p>
    <p v-if="description" class="empty-state__description">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="empty-state__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  max-width: var(--public-content-reading);
  margin: 0 auto;
  padding: var(--space-9) var(--public-page-padding);
  text-align: center;
}

.empty-state__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
}

.empty-state__description {
  margin-top: var(--space-3);
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}

.empty-state__actions {
  margin-top: var(--space-5);
}

.empty-state__actions :deep(a) {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: var(--space-2) var(--space-5);
  color: var(--public-accent-primary);
  border: 1px solid var(--public-accent-primary);
  border-radius: var(--radius-full);
}

.empty-state__actions :deep(a:hover) {
  color: var(--public-accent-hover);
  border-color: var(--public-accent-hover);
}
</style>

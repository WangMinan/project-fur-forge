<script setup lang="ts">
/** 公开站真实空状态：说明原因并给出恢复行动，不用假图或“后续开放”。 */
const props = withDefaults(defineProps<{
  description?: string
  eyebrow?: string
  heading?: 'h1' | 'h2'
  title: string
}>(), {
  description: '',
  eyebrow: '',
  heading: 'h2',
})
</script>

<template>
  <div class="empty-state" data-testid="public-empty-state">
    <p v-if="props.eyebrow" class="empty-state__eyebrow">
      {{ props.eyebrow }}
    </p>
    <component :is="props.heading" class="empty-state__title">
      {{ title }}
    </component>
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
  display: grid;
  gap: var(--space-3);
  max-width: var(--public-content-reading);
  margin: 0 auto;
  padding: clamp(var(--space-7), 10vw, var(--space-10)) var(--public-page-padding);
  border-block: 1px solid var(--public-border-secondary);
  text-align: left;
}

.empty-state__eyebrow {
  margin: 0;
  color: var(--public-text-tertiary);
  font-family: var(--font-public-mono);
  font-size: var(--font-size-xs);
  letter-spacing: var(--letter-spacing-label);
}

.empty-state__title {
  margin: 0;
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
}

.empty-state__description {
  margin: 0;
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-2);
}
</style>

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
    <img
      class="empty-state__background-mark"
      src="/brand/logo-mark.png"
      alt=""
      aria-hidden="true"
      width="1600"
      height="1600"
    >

    <div class="empty-state__body">
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
  </div>
</template>

<style scoped>
.empty-state {
  position: relative;
  isolation: isolate;
  display: grid;
  width: 100%;
  max-width: 64rem;
  min-height: clamp(15rem, 30vw, 21rem);
  margin: 0 auto;
  padding: clamp(var(--space-6), 7vw, var(--space-9));
  overflow: hidden;
  border-block: 1px solid var(--public-border-secondary);
  text-align: left;
  place-items: center start;
}

.empty-state__background-mark {
  position: absolute;
  z-index: -1;
  right: clamp(-4rem, -3vw, -1.5rem);
  bottom: clamp(-5rem, -4vw, -2rem);
  width: clamp(15rem, 27vw, 25rem);
  height: auto;
  opacity: 0.055;
  filter: grayscale(1);
  transform: rotate(12deg);
  pointer-events: none;
  user-select: none;
}

.empty-state__body {
  display: grid;
  gap: var(--space-3);
  width: min(100%, var(--public-content-reading));
}

.empty-state__eyebrow {
  margin: 0;
  color: var(--public-text-tertiary);
  font-family: var(--font-role-metadata);
  font-size: var(--type-metadata-size);
  font-weight: var(--type-metadata-weight);
  line-height: var(--type-metadata-line-height);
  letter-spacing: var(--type-metadata-letter-spacing);
  font-variant-numeric: tabular-nums;
}

.empty-state__title {
  margin: 0;
  font-family: var(--font-role-display);
  font-size: clamp(1.75rem, 4vw, 3.25rem);
  font-weight: var(--type-display-weight);
  line-height: var(--type-display-line-height);
  letter-spacing: var(--type-display-letter-spacing);
}

.empty-state__description {
  margin: 0;
  color: var(--public-text-secondary);
  font-family: var(--font-role-body);
  line-height: var(--type-body-line-height);
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

@media (max-width: 767px) {
  .empty-state {
    min-height: 16rem;
    padding: var(--space-7) var(--space-4);
  }

  .empty-state__background-mark {
    right: -4.5rem;
    bottom: -3.5rem;
    width: 17rem;
    opacity: 0.05;
  }
}
</style>

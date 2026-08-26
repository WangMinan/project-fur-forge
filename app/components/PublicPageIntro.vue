<script setup lang="ts">
/** 内页紧凑页名区：页名 + 一句必要说明，不与作品图争夺层级。 */
const props = withDefaults(defineProps<{
  title: string
  description?: string | undefined
  meta?: string | undefined
  variant?: 'default' | 'document'
  wide?: boolean
}>(), {
  description: undefined,
  meta: undefined,
  variant: 'default',
  wide: false,
})
</script>

<template>
  <header
    class="page-intro"
    :class="{
      'page-intro--document': props.variant === 'document',
      'page-intro--wide': props.wide,
    }"
  >
    <h1 class="page-intro__title">
      {{ title }}
    </h1>
    <p v-if="meta" class="page-intro__meta">{{ meta }}</p>
    <p v-if="description" class="page-intro__description">
      {{ description }}
    </p>
  </header>
</template>

<style scoped>
.page-intro {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-7) var(--public-page-padding) var(--space-5);
}

.page-intro__title {
  font-family: var(--font-role-display);
  font-size: var(--font-size-xl);
  font-weight: var(--type-display-weight);
  line-height: var(--type-display-line-height);
  letter-spacing: var(--type-display-letter-spacing);
}

.page-intro__description {
  max-width: var(--public-content-reading);
  margin-top: var(--space-3);
  color: var(--public-text-secondary);
  font-family: var(--font-role-body);
  line-height: var(--type-body-line-height);
}

.page-intro__meta {
  margin-top: var(--space-2);
  color: var(--public-text-tertiary);
  font-family: var(--font-role-metadata);
  font-size: var(--type-metadata-size);
  font-weight: var(--type-metadata-weight);
  font-variant-numeric: tabular-nums;
  line-height: var(--type-metadata-line-height);
  letter-spacing: var(--type-metadata-letter-spacing);
}

.page-intro--document {
  padding-top: var(--space-8);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--public-border-primary);
}

.page-intro--document .page-intro__title {
  font-size: 2.25rem;
  letter-spacing: 0;
}

@media (min-width: 1024px) {
  .page-intro--wide {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.42fr);
    align-items: end;
    gap: var(--space-8);
    padding-bottom: var(--space-7);
  }

  .page-intro--wide .page-intro__description {
    margin-top: 0;
  }

  .page-intro--document {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: var(--space-5);
    padding-top: var(--space-9);
    padding-bottom: var(--space-6);
  }

  .page-intro--document .page-intro__title {
    font-size: 3.5rem;
  }

  .page-intro--document .page-intro__meta {
    margin-top: 0;
    padding-bottom: var(--space-2);
  }

  .page-intro--document .page-intro__description {
    grid-column: 1 / -1;
  }
}
</style>

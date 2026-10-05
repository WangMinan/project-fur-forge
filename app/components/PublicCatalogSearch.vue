<script setup lang="ts">
const { t } = usePublicI18n()
defineProps<{
  action: string
  clearTo: string
  hiddenFields?: Readonly<Record<string, string | null | undefined>>
  query: string
  showClear: boolean
}>()
</script>

<template>
  <form class="catalog-search" method="get" :action="action" role="search">
    <div class="catalog-search__controls">
      <input
        :id="`catalog-search-${action}`"
        class="catalog-search__input"
        type="search"
        name="q"
        :aria-label="t('ui.searchByName')"
        :value="query"
        maxlength="100"
        autocomplete="off"
        :placeholder="t('ui.enterName')"
      >
      <template v-for="(value, name) in hiddenFields" :key="name">
        <input v-if="value" type="hidden" :name="name" :value="value">
      </template>
      <PublicAction type="submit">
        {{ t('ui.search') }}
      </PublicAction>
      <PublicAction v-if="showClear" class="catalog-search__clear" variant="text" :to="clearTo">
        {{ t('ui.clear') }}
      </PublicAction>
    </div>
  </form>
</template>

<style scoped>
.catalog-search {
  width: min(100%, 34rem);
}

.catalog-search__controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
}

.catalog-search__input {
  min-height: 2.75rem;
  border-radius: var(--radius-sm);
  font: inherit;
  font-family: var(--font-role-ui);
  font-size: var(--type-body-size);
  line-height: var(--type-ui-line-height);
  letter-spacing: var(--type-ui-letter-spacing);
}

.catalog-search__input {
  min-width: 0;
  padding: var(--space-2) var(--space-4);
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  border: 1px solid var(--public-border-primary);
  transition:
    border-color var(--motion-duration-feedback) var(--motion-ease-standard),
    background-color var(--motion-duration-feedback) var(--motion-ease-standard);
}

.catalog-search__input:focus-visible {
  border-color: var(--public-border-focus);
}

.catalog-search__clear {
  grid-column: 1 / -1;
  justify-self: start;
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding-right: 0;
  padding-left: 0;
  color: var(--public-text-link);
  transition: color var(--motion-duration-feedback) var(--motion-ease-standard);
}

@media (min-width: 480px) {
  .catalog-search__controls {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }

  .catalog-search__clear {
    grid-column: auto;
    justify-self: stretch;
    padding-right: var(--space-3);
    padding-left: var(--space-3);
  }
}
</style>

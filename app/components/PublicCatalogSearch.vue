<script setup lang="ts">
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
        aria-label="按设定名称搜索"
        :value="query"
        maxlength="100"
        autocomplete="off"
        placeholder="输入设定名称"
      >
      <template v-for="(value, name) in hiddenFields" :key="name">
        <input v-if="value" type="hidden" :name="name" :value="value">
      </template>
      <button class="catalog-search__submit" type="submit">
        搜索
      </button>
      <NuxtLink v-if="showClear" class="catalog-search__clear" :to="clearTo">
        清除
      </NuxtLink>
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

.catalog-search__input,
.catalog-search__submit,
.catalog-search__clear {
  min-height: 2.75rem;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--font-size-base);
}

.catalog-search__input {
  min-width: 0;
  padding: var(--space-2) var(--space-4);
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  border: 1px solid var(--public-border-primary);
}

.catalog-search__input:focus {
  border-color: var(--public-border-focus);
}

.catalog-search__submit,
.catalog-search__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-4);
}

.catalog-search__submit {
  color: var(--public-text-inverse);
  background: var(--public-accent-primary);
  border: 1px solid var(--public-accent-primary);
  cursor: pointer;
}

.catalog-search__submit:hover {
  background: var(--public-accent-hover);
  border-color: var(--public-accent-hover);
}

.catalog-search__clear {
  grid-column: 1 / -1;
  justify-self: start;
  min-height: 2.75rem;
  padding-right: 0;
  padding-left: 0;
  color: var(--public-text-link);
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

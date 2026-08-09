<script setup lang="ts">
interface RankingItem {
  detail?: string
  href?: string
  key: string
  label: string
  value: number
}

defineProps<{
  emptyText: string
  items: RankingItem[]
  title: string
}>()
</script>

<template>
  <section class="analytics-ranking" :aria-label="title">
    <h2 class="analytics-ranking__title">{{ title }}</h2>
    <ol v-if="items.length" class="analytics-ranking__list">
      <li v-for="item in items" :key="item.key" class="analytics-ranking__item">
        <span class="analytics-ranking__name">
          <a
            v-if="item.href"
            :href="item.href"
            target="_blank"
            rel="noopener noreferrer"
          >{{ item.label }}<span class="sr-only">（在新窗口打开）</span></a>
          <span v-else>{{ item.label }}</span>
          <small v-if="item.detail">{{ item.detail }}</small>
        </span>
        <strong>{{ item.value }}</strong>
      </li>
    </ol>
    <p v-else class="analytics-ranking__empty">{{ emptyText }}</p>
  </section>
</template>

<style scoped>
.analytics-ranking {
  min-width: 0;
  padding: var(--admin-space-5);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
}

.analytics-ranking__title,
.analytics-ranking__list,
.analytics-ranking__empty {
  margin: 0;
}

.analytics-ranking__title {
  font-size: var(--admin-font-md);
}

.analytics-ranking__list {
  margin-top: var(--admin-space-3);
  padding: 0;
  list-style: none;
}

.analytics-ranking__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-3);
  min-height: var(--admin-touch-target);
  padding: var(--admin-space-2) 0;
  border-top: 1px solid var(--admin-border-secondary);
  font-size: var(--admin-font-sm);
}

.analytics-ranking__name {
  min-width: 0;
  display: grid;
}

.analytics-ranking__name a {
  color: var(--admin-accent-primary);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.analytics-ranking__name small {
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
}

.analytics-ranking__empty {
  margin-top: var(--admin-space-3);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}
</style>

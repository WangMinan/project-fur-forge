<script setup lang="ts">
import type { V00PrototypeView } from './types'

const props = defineProps<{
  current: V00PrototypeView
}>()

const items = [
  { key: 'b-m3', label: 'B + M3' },
] as const

const activeKey = computed(() => props.current === 'shared-detail' ? 'shared' : props.current)
</script>

<template>
  <aside class="v00-nav" aria-label="V00 原型候选">
    <div class="v00-nav__identity">
      <span class="v00-nav__badge">DEV ONLY</span>
      <span class="v00-nav__title">V00 Visual Lab</span>
    </div>
    <nav class="v00-nav__scroller" aria-label="切换原型">
      <NuxtLink
        v-for="item in items"
        :key="item.key"
        class="v00-nav__link"
        :class="{ 'v00-nav__link--active': activeKey === item.key }"
        :to="`/__prototype/v00/${item.key}`"
        :aria-current="activeKey === item.key ? 'page' : undefined"
      >
        {{ item.label }}
      </NuxtLink>
    </nav>
  </aside>
</template>

<style scoped>
.v00-nav {
  position: relative;
  z-index: 10;
  display: grid;
  gap: 0.45rem;
  min-width: 0;
  padding: 0.55rem var(--public-page-padding);
  color: var(--public-text-primary);
  background: rgb(255 255 255 / 0.96);
  border-bottom: 1px solid var(--public-border-secondary);
}

.v00-nav__identity {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 1.25rem;
}

.v00-nav__badge {
  padding: 0.12rem 0.38rem;
  color: #fff;
  background: #20242b;
  font-family: var(--font-public-mono);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.v00-nav__title {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
}

.v00-nav__scroller {
  display: flex;
  gap: 0.25rem;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.v00-nav__link {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 0.65rem;
  color: var(--public-text-secondary);
  font-size: 0.72rem;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}

.v00-nav__link:hover,
.v00-nav__link--active {
  color: var(--public-text-primary);
  border-bottom-color: currentcolor;
}

@media (min-width: 1024px) {
  .v00-nav {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 1.5rem;
    min-height: 3.75rem;
    padding-block: 0;
  }

  .v00-nav__scroller {
    justify-content: flex-end;
  }
}
</style>

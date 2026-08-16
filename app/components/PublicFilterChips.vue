<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

/**
 * 公开端筛选条：一组胶囊链接。
 *
 * `/works` 与 `/adoptions` 共用这一个组件，筛选条才不会各自漂移。
 * 全部是普通链接（NuxtLink），无 JavaScript 也可用；
 * 选中态同时用底色、边框与文字权重表达，不只依赖颜色。
 */
defineProps<{
  label: string;
  options: Array<{
    key: string;
    label: string;
    to: RouteLocationRaw;
  }>;
  /** 当前选中项的 key。 */
  selected: string;
}>();
</script>

<template>
  <div class="filter-chips" role="group" :aria-label="label">
    <NuxtLink
      v-for="option in options"
      :key="option.key"
      class="filter-chips__chip"
      :class="{ 'filter-chips__chip--active': option.key === selected }"
      :to="option.to"
      :aria-current="option.key === selected ? 'true' : undefined"
    >
      {{ option.label }}
    </NuxtLink>
  </div>
</template>

<style scoped>
.filter-chips {
  /* 宽度贴合内容：筛选条不占满页宽。 */
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0;
  padding: var(--space-1);
  background: var(--public-bg-secondary);
  border: 1px solid var(--public-border-primary);
  /* 单行仍是 25px 胶囊；换行时外框圆角不随总高度膨胀，
     与 40px chip 的 20px 圆角保持 4px 内边距和 1px 边框间隔。 */
  border-radius: calc(1.25rem + var(--space-1) + 1px);
  box-shadow: 0 0.25rem 0.75rem rgb(25 31 42 / 0.08);
}

.filter-chips__chip {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: var(--space-2) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  transition:
    color var(--duration-fast) var(--easing-standard),
    background-color var(--duration-fast) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard),
    box-shadow var(--duration-fast) var(--easing-standard),
    transform var(--duration-fast) var(--easing-standard);
}

.filter-chips__chip:hover {
  color: var(--public-text-primary);
}

.filter-chips__chip--active,
.filter-chips__chip--active:hover {
  background: var(--public-bg-primary);
  border-color: var(--public-border-primary);
  color: var(--public-text-primary);
  box-shadow: 0 0.125rem 0.5rem rgb(25 31 42 / 0.12);
}

/* 与顶级导航同一套悬停语言：抬升 + 投影，只在真实指针设备上生效。 */
@media (min-width: 1024px) and (hover: hover) and (pointer: fine) {
  .filter-chips__chip:hover,
  .filter-chips__chip:focus-visible,
  .filter-chips__chip--active:hover {
    color: var(--public-text-primary);
    background: var(--public-bg-primary);
    box-shadow: 0 0.45rem 1.25rem rgb(17 20 25 / 0.12);
    transform: translateY(-2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .filter-chips__chip {
    transition: none;
  }

  .filter-chips__chip:hover,
  .filter-chips__chip:focus-visible,
  .filter-chips__chip--active:hover {
    transform: none;
  }
}
</style>

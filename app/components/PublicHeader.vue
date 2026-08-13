<script setup lang="ts">
import type { PublicNavItem } from '~/utils/public-nav'
import {
  PROJECT_ENGLISH_NAME,
  PUBLIC_NAV_BRAND,
} from '~~/shared/constants/project'

/**
 * `brandOnly` 只保留 Logo 与工作室名称，隐藏主导航与移动端菜单。
 * 管理端登录页用它：那个页面可能被 ICP 备案审核抓到，需要品牌与备案信息，
 * 但不应该把访客导航混进登录流程。
 */
const props = withDefaults(defineProps<{
  brandOnly?: boolean
}>(), {
  brandOnly: false,
})

const route = useRoute()
const navOpen = ref(false)

/** 首页图片覆盖态；内页白底态。 */
const overlay = computed(() => route.path === '/' && !props.brandOnly)
const triggerId = 'public-nav-trigger'

function isActive(item: PublicNavItem) {
  return route.path === item.href || item.children?.some(child => route.path === child.href)
}

watch(() => route.fullPath, () => {
  navOpen.value = false
})
</script>

<template>
  <header
    class="public-header"
    :class="{ 'public-header--overlay': overlay }"
    data-testid="public-header"
  >
    <NuxtLink
      to="/"
      class="public-header__brand"
      :aria-label="`${PUBLIC_NAV_BRAND} · 回首页`"
    >
      <img
        class="public-header__logo"
        :src="overlay ? '/brand/logo-full-light.png' : '/brand/logo-full-dark.png'"
        alt=""
        width="473"
        height="512"
      >
      <span class="public-header__brand-name">{{ PUBLIC_NAV_BRAND }}</span>
      <span class="public-header__brand-sub">{{ PROJECT_ENGLISH_NAME }}</span>
    </NuxtLink>

    <nav v-if="!brandOnly" class="public-header__nav" aria-label="主导航">
      <div
        v-for="item in PUBLIC_NAV_ITEMS"
        :key="item.href"
        class="public-header__nav-item"
        :class="{ 'public-header__nav-item--active': isActive(item) }"
      >
        <NuxtLink
          :to="item.href"
          class="public-header__link"
          :aria-current="route.path === item.href ? 'page' : undefined"
          :aria-haspopup="item.children ? 'true' : undefined"
        >
          {{ item.label }}
          <svg
            v-if="item.children"
            class="public-header__chevron"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path d="m3 4.5 3 3 3-3" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </NuxtLink>

        <div v-if="item.children" class="public-header__subnav">
          <nav class="public-header__subnav-panel" :aria-label="`${item.label}二级导航`">
            <NuxtLink
              v-for="child in item.children"
              :key="child.href"
              :to="child.href"
              class="public-header__subnav-link"
              :aria-current="route.path === child.href ? 'page' : undefined"
            >
              {{ child.label }}
            </NuxtLink>
          </nav>
        </div>
      </div>
    </nav>

    <button
      v-if="!brandOnly"
      :id="triggerId"
      type="button"
      class="public-header__menu"
      aria-label="打开导航"
      :aria-expanded="navOpen"
      aria-controls="public-mobile-nav-panel"
      @click="navOpen = true"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 6h16M3 11h16M3 16h16"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <PublicMobileNav
      v-if="!brandOnly"
      :open="navOpen"
      :trigger-id="triggerId"
      @close="navOpen = false"
    />
  </header>
</template>

<style scoped>
.public-header {
  position: absolute;
  z-index: 50;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--public-page-padding);
}

.public-header--overlay {
  color: var(--public-text-inverse);
}

.public-header:not(.public-header--overlay) {
  position: sticky;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  border-bottom: 1px solid var(--public-border-secondary);
}

.public-header__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: inherit;
}

.public-header__brand:hover {
  color: inherit;
}

.public-header__logo {
  /* 完整堆叠 Logo 与品牌文字行高等高（18px 字号 × 1.55 行高 ≈ 28px）。 */
  width: auto;
  height: 1.75rem;
  align-self: center;
}

/* 覆盖态（首页图片大底）文字必须满透明度：半透明反白在图片上无法保证对比度。 */
.public-header--overlay .public-header__brand-sub {
  opacity: 1;
}

.public-header--overlay .public-header__link {
  opacity: 1;
}

.public-header__brand-name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
  letter-spacing: var(--letter-spacing-normal);
}

.public-header__brand-sub {
  font-size: var(--font-size-xs);
  letter-spacing: var(--letter-spacing-label);
  opacity: 0.72;
  text-transform: uppercase;
}

.public-header__nav {
  display: none;
  align-items: center;
  gap: var(--space-5);
}

.public-header__nav-item {
  position: relative;
}

.public-header__link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: inherit;
  font-size: var(--font-size-sm);
  opacity: 0.86;
}

.public-header__link:hover {
  color: inherit;
  opacity: 1;
}

.public-header__link[aria-current='page'],
.public-header__nav-item--active > .public-header__link {
  opacity: 1;
  text-decoration: underline;
  text-underline-offset: 0.4em;
}

.public-header:not(.public-header--overlay) .public-header__link[aria-current='page'],
.public-header:not(.public-header--overlay) .public-header__nav-item--active > .public-header__link {
  color: var(--public-accent-primary);
}

.public-header__chevron {
  transition: transform var(--duration-fast) var(--easing-standard);
}

.public-header__subnav {
  position: absolute;
  top: 100%;
  right: 0;
  width: max-content;
  min-width: 10rem;
  padding-top: var(--space-2);
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-0.25rem);
  transition:
    opacity var(--duration-fast) var(--easing-standard),
    transform var(--duration-fast) var(--easing-standard),
    visibility var(--duration-fast) var(--easing-standard);
}

.public-header__subnav-panel {
  display: grid;
  padding: var(--space-2);
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  border: 1px solid var(--public-border-secondary);
  border-radius: var(--radius-lg);
  box-shadow: 0 1rem 2rem rgb(17 20 25 / 0.12);
}

.public-header__subnav-link {
  padding: var(--space-3) var(--space-4);
  color: inherit;
  font-size: var(--font-size-sm);
  white-space: nowrap;
  border-radius: var(--radius-sm);
}

.public-header__subnav-link:hover,
.public-header__subnav-link[aria-current='page'] {
  color: var(--public-accent-primary);
  background: var(--public-bg-secondary);
}

.public-header__nav-item:hover .public-header__subnav,
.public-header__nav-item:focus-within .public-header__subnav {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.public-header__nav-item:hover .public-header__chevron,
.public-header__nav-item:focus-within .public-header__chevron {
  transform: rotate(180deg);
}

.public-header__menu {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  color: inherit;
  background: none;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  place-items: center;
}

.public-header__menu:hover {
  background: rgb(127 137 150 / 0.16);
}

@media (min-width: 1024px) {
  .public-header__nav {
    display: flex;
  }

  .public-header__menu {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .public-header__chevron,
  .public-header__subnav {
    transition: none;
  }
}
</style>

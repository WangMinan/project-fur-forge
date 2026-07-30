<script setup lang="ts">
const route = useRoute()
const navOpen = ref(false)

/** 首页图片覆盖态；内页白底态。 */
const overlay = computed(() => route.path === '/')
const triggerId = 'public-nav-trigger'

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
      aria-label="有点小狗工作室 · 回首页"
    >
      <img
        class="public-header__logo"
        :src="overlay ? '/brand/logo-mark-light.png' : '/brand/logo-mark-dark.png'"
        alt=""
        width="578"
        height="384"
      >
      <span class="public-header__brand-name">有点小狗工作室</span>
      <span class="public-header__brand-sub">dite dog</span>
    </NuxtLink>

    <nav class="public-header__nav" aria-label="主导航">
      <NuxtLink
        v-for="item in PUBLIC_NAV_ITEMS"
        :key="item.href"
        :to="item.href"
        class="public-header__link"
        :class="{ 'public-header__link--emphasized': item.emphasized }"
        :aria-current="route.path === item.href ? 'page' : undefined"
      >
        {{ item.label }}
      </NuxtLink>
    </nav>

    <button
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
  width: auto;
  height: 2rem;
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

.public-header__link {
  color: inherit;
  font-size: var(--font-size-sm);
  opacity: 0.86;
}

.public-header__link:hover {
  color: inherit;
  opacity: 1;
}

.public-header__link[aria-current='page'] {
  opacity: 1;
  text-decoration: underline;
  text-underline-offset: 0.4em;
}

.public-header:not(.public-header--overlay) .public-header__link[aria-current='page'] {
  color: var(--public-accent-primary);
}

.public-header__link--emphasized {
  padding: var(--space-2) var(--space-4);
  border: 1px solid currentcolor;
  border-radius: var(--radius-full);
  opacity: 1;
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

@media (min-width: 768px) {
  .public-header__nav {
    display: flex;
  }

  .public-header__menu {
    display: none;
  }
}
</style>

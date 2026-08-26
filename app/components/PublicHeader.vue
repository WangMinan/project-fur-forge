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
const nuxtApp = useNuxtApp()
const navOpen = ref(false)
const scrolled = shallowRef(false)
const displayedPath = shallowRef(route.path)

/**
 * 页头定位跟随当前真正显示的页面，而不是抢先跟随已更新的 route。
 *
 * Nuxt 页面转场期间，新 route 会先就绪，旧页面再离场。如果这里直接读取
 * route.path，离开首页时页头会在旧首页仍可见的一帧从 fixed 变为 sticky，
 * 重新进入文档流并把当前 scene 向下推一个页头高度。
 */
const overlay = computed(() => displayedPath.value === '/' && !props.brandOnly)
const triggerId = 'public-nav-trigger'

const removePageLoadingEndHook = nuxtApp.hooks.hook('page:loading:end', () => {
  const targetPath = route.path
  const commitDisplayedPath = () => requestAnimationFrame(() => {
    if (route.path === targetPath) {
      displayedPath.value = targetPath
    }
  })
  const transition = nuxtApp['~transitionPromise']

  // 与滚动恢复共用同一个页面交换边界：旧页面已经移除、新页面仍在淡入起点。
  if (transition) void transition.then(commitDisplayedPath, commitDisplayedPath)
  else commitDisplayedPath()
})

function isActive(item: PublicNavItem) {
  return route.path === item.href || item.children?.some(child => route.path === child.href)
}

watch(() => route.fullPath, () => {
  navOpen.value = false
  if (route.path === '/') {
    scrolled.value = false
  }
})

function updateScrolled() {
  scrolled.value = window.scrollY > 32
}

onMounted(() => {
  updateScrolled()
  window.addEventListener('scroll', updateScrolled, { passive: true })
})

onBeforeUnmount(() => {
  removePageLoadingEndHook()
  window.removeEventListener('scroll', updateScrolled)
})
</script>

<template>
  <header
    class="public-header"
    :class="{
      'public-header--overlay': overlay,
      'public-header--scrolled': scrolled,
      'public-header--nav-open': navOpen,
    }"
    data-testid="public-header"
  >
    <NuxtLink
      to="/"
      class="public-header__brand"
      :aria-label="`${PUBLIC_NAV_BRAND} · 回首页`"
    >
      <img
        class="public-header__logo"
        src="/brand/logo-mark.png"
        alt=""
        width="1600"
        height="1600"
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
  position: fixed;
  color: var(--public-text-inverse);
}

.public-header--overlay.public-header--scrolled {
  color: var(--public-text-primary);
  background: rgb(255 255 255 / 0.94);
  border-bottom: 1px solid var(--public-border-secondary);
  backdrop-filter: blur(14px) saturate(140%);
}

/* backdrop-filter 会把内部 fixed 菜单限制在 Header 高度内。 */
.public-header--overlay.public-header--scrolled.public-header--nav-open {
  backdrop-filter: none;
}

.public-header--overlay.public-header--nav-open {
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
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
  min-height: 2.75rem;
  color: inherit;
}

.public-header__brand:hover {
  color: inherit;
}

.public-header__brand:focus-visible {
  border-radius: var(--radius-xs);
}

.public-header__logo {
  width: 1.75rem;
  height: 1.75rem;
  align-self: center;
  object-fit: contain;
}

.public-header--overlay .public-header__logo {
  filter: brightness(0) invert(1);
}

.public-header--overlay.public-header--scrolled .public-header__logo {
  filter: none;
}

.public-header--overlay.public-header--nav-open .public-header__logo {
  filter: none;
}

/* 覆盖态（首页图片大底）文字必须满透明度：半透明反白在图片上无法保证对比度。 */
.public-header--overlay .public-header__brand-sub {
  opacity: 1;
}

.public-header--overlay .public-header__link {
  opacity: 1;
}

.public-header__brand-name {
  font-family: var(--font-brand-display);
  font-size: var(--font-size-md);
  letter-spacing: var(--letter-spacing-normal);
}

.public-header__brand-sub {
  font-family: var(--font-brand-display);
  font-size: var(--font-size-xs);
  letter-spacing: var(--letter-spacing-label);
  opacity: 0.72;
  text-transform: uppercase;
}

.public-header__nav {
  display: none;
  align-items: center;
  gap: var(--space-2);
}

.public-header__nav-item {
  position: relative;
}

.public-header__link {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 2.75rem;
  padding: 0 var(--space-4);
  color: inherit;
  font-size: var(--font-size-sm);
  opacity: 0.86;
  transition:
    color var(--motion-duration-state) var(--motion-ease-standard),
    opacity var(--motion-duration-state) var(--motion-ease-standard);
}

.public-header__link::after {
  position: absolute;
  right: var(--space-3);
  bottom: 0.2rem;
  left: var(--space-3);
  height: 2px;
  content: '';
  background: currentcolor;
  transform: scaleX(0);
  transform-origin: center;
  transition: transform var(--motion-duration-state) var(--motion-ease-standard);
}

.public-header__link:hover,
.public-header__link:focus-visible {
  color: inherit;
  opacity: 1;
}

.public-header__link[aria-current='page'],
.public-header__nav-item--active > .public-header__link {
  opacity: 1;
}

.public-header__link[aria-current='page']::after,
.public-header__nav-item--active > .public-header__link::after {
  transform: scaleX(1);
}

.public-header:not(.public-header--overlay) .public-header__link[aria-current='page'],
.public-header:not(.public-header--overlay) .public-header__nav-item--active > .public-header__link {
  color: var(--public-accent-primary);
}

@media (min-width: 1024px) and (hover: hover) and (pointer: fine) {
  .public-header__link:hover,
  .public-header__link:focus-visible,
  .public-header__nav-item:focus-within > .public-header__link {
    opacity: 1;
  }

  .public-header__link:hover::after,
  .public-header__link:focus-visible::after,
  .public-header__nav-item:focus-within > .public-header__link::after {
    transform: scaleX(1);
  }

  .public-header__nav-item:hover .public-header__subnav {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }

  .public-header__nav-item:hover .public-header__chevron {
    transform: rotate(180deg);
  }
}

.public-header__chevron {
  transition: transform var(--motion-duration-state) var(--motion-ease-standard);
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
    opacity var(--motion-duration-state) var(--motion-ease-standard),
    transform var(--motion-duration-state) var(--motion-ease-standard),
    visibility var(--motion-duration-state) var(--motion-ease-standard);
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
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
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

.public-header__nav-item:focus-within .public-header__subnav {
  visibility: visible;
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

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

.public-header__menu:focus-visible {
  outline: 3px solid var(--public-focus-ring);
  outline-offset: 2px;
}

.public-header__menu:active {
  background: rgb(127 137 150 / 0.24);
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
  .public-header__subnav,
  .public-header__link,
  .public-header__link::after {
    transition: none;
  }

  .public-header__link:hover,
  .public-header__link:focus-visible,
  .public-header__nav-item:focus-within > .public-header__link {
    transform: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .public-header--overlay {
    background: #111419;
  }

  .public-header--overlay.public-header--scrolled {
    background: var(--public-bg-primary);
    backdrop-filter: none;
  }
}
</style>

<script setup lang="ts">
import type { AdminNavCurrent } from '~/utils/admin-nav'
import AdminMobileNav from '~/components/AdminMobileNav.vue'
import { ADMIN_NAV_ITEMS } from '~/utils/admin-nav'

// 管理端壳：<1024px 为顶栏 + 全屏抽屉，1024–1279px 为顶栏 + 横向导航，
// ≥1280px 为固定侧栏。
// 导航顺序按 .design/admin-console/INFORMATION_ARCHITECTURE.md 的“业务对象优先”：
// 作品管理 → 返图管理 → 动态管理 → 大图管理 → 文案配置 → 全局水印 → 访问概览 → 修改密码。
// 公开端称“返图墙”，管理端称“返图管理”，两端不混用同一个短词。
withDefaults(defineProps<{
  current?: AdminNavCurrent
}>(), {
  current: 'none',
})

const { user, logout } = useAdminAuth()

const logoutPending = ref(false)
const logoutError = ref<string | null>(null)
const navOpen = shallowRef(false)
const triggerId = 'admin-nav-trigger'

async function onLogout() {
  if (logoutPending.value) {
    return
  }

  logoutError.value = null
  logoutPending.value = true

  try {
    const result = await logout()

    if (result.ok) {
      await navigateTo('/admin/login', { replace: true })
      return
    }

    logoutError.value = '退出失败，请稍后重试。若持续失败，可直接关闭页面。'
  }
  finally {
    logoutPending.value = false
  }
}
</script>

<template>
  <div class="admin-surface admin-shell" data-testid="admin-shell">
    <header class="admin-shell__bar">
      <p class="admin-shell__brand">
        <span class="admin-shell__brand-name">有点小狗工作室</span>
        <span class="admin-shell__brand-role">管理端</span>
      </p>
      <nav class="admin-shell__nav" aria-label="管理导航">
        <NuxtLink
          v-for="item in ADMIN_NAV_ITEMS"
          :key="item.key"
          :to="item.href"
          class="admin-shell__nav-link"
          :aria-current="current === item.key ? 'page' : undefined"
        >{{ item.label }}</NuxtLink>
      </nav>
      <div class="admin-shell__session">
        <span v-if="user" class="admin-shell__user">{{ user.username }}</span>
        <button
          type="button"
          class="admin-shell__exit"
          :disabled="logoutPending"
          @click="onLogout"
        >
          {{ logoutPending ? '退出中…' : '退出登录' }}
        </button>
      </div>
      <button
        :id="triggerId"
        type="button"
        class="admin-shell__menu"
        aria-label="打开管理导航"
        :aria-expanded="navOpen"
        aria-controls="admin-mobile-nav-panel"
        @click="navOpen = true"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
        </svg>
      </button>
    </header>
    <main id="admin-main" class="admin-shell__main" tabindex="-1">
      <p v-if="logoutError" class="admin-shell__alert" role="alert">
        {{ logoutError }}
      </p>
      <slot />
    </main>
    <AdminMobileNav
      :open="navOpen"
      :trigger-id="triggerId"
      :current="current"
      :username="user?.username"
      :logout-pending="logoutPending"
      :logout-error="logoutError"
      @close="navOpen = false"
      @logout="onLogout"
    />
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
}

.admin-shell__bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--admin-space-2) var(--admin-space-4);
  padding: 0 var(--admin-space-4);
  background: var(--admin-bg-primary);
  border-bottom: 1px solid var(--admin-border-secondary);
  min-height: 3.5rem;
}

.admin-shell__brand {
  order: 1;
  display: flex;
  align-items: baseline;
  gap: var(--admin-space-2);
  margin: 0;
  white-space: nowrap;
}

.admin-shell__brand-name {
  font-size: var(--admin-font-md);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.admin-shell__brand-role {
  font-size: var(--admin-font-xs);
  color: var(--admin-accent-primary);
  border: 1px solid var(--admin-accent-tint);
  border-radius: 999px;
  padding: 0.05rem 0.5rem;
}

.admin-shell__nav {
  order: 3;
  display: flex;
  gap: var(--admin-space-1);
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.admin-shell__nav-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-touch-target);
  padding: 0 var(--admin-space-3);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-primary);
  font-size: var(--admin-font-sm);
}

.admin-shell__nav-link:hover {
  background: var(--admin-bg-subtle);
}

.admin-shell__nav-link[aria-current='page'] {
  background: var(--admin-bg-subtle);
  font-weight: 600;
  color: var(--admin-accent-primary);
}

.admin-shell__session {
  order: 2;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
}

.admin-shell__menu {
  display: none;
  width: var(--admin-touch-target);
  height: var(--admin-touch-target);
  margin-left: auto;
  padding: 0;
  color: var(--admin-text-primary);
  background: none;
  border: none;
  border-radius: var(--admin-radius-md);
  cursor: pointer;
  place-items: center;
}

.admin-shell__menu:hover {
  background: var(--admin-bg-subtle);
}

.admin-shell__menu:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.admin-shell__user {
  display: none;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  white-space: nowrap;
}

.admin-shell__exit {
  border: none;
  background: none;
  padding: 0 var(--admin-space-2);
  font: inherit;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
  min-height: var(--admin-touch-target);
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  border-radius: var(--admin-radius-md);
}

.admin-shell__exit:hover:not(:disabled) {
  color: var(--admin-text-primary);
  background: var(--admin-bg-subtle);
}

.admin-shell__exit:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.admin-shell__exit:disabled {
  opacity: 0.65;
  cursor: default;
}

.admin-shell__alert {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.admin-shell__main {
  padding: var(--admin-space-4);
}

@media (max-width: 1023px) {
  .admin-shell__bar {
    flex-wrap: nowrap;
    gap: var(--admin-space-3);
  }

  .admin-shell__brand {
    min-width: 0;
  }

  .admin-shell__brand-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .admin-shell__nav,
  .admin-shell__session {
    display: none;
  }

  .admin-shell__menu {
    display: grid;
    flex: none;
  }
}

@media (min-width: 1280px) {
  .admin-shell {
    display: grid;
    grid-template-columns: var(--admin-sidebar-width) 1fr;
  }

  .admin-shell__bar {
    position: sticky;
    top: 0;
    height: 100vh;
    flex-direction: column;
    align-items: stretch;
    gap: var(--admin-space-6);
    padding: var(--admin-space-6) var(--admin-space-4);
    border-bottom: none;
    border-right: 1px solid var(--admin-border-secondary);
  }

  .admin-shell__brand {
    order: initial;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--admin-space-2);
    padding: 0 var(--admin-space-2);
  }

  .admin-shell__nav {
    order: initial;
    flex-direction: column;
    width: auto;
    overflow: visible;
  }

  .admin-shell__session {
    order: initial;
    margin: auto 0 0;
    flex-direction: column;
    align-items: stretch;
    gap: var(--admin-space-2);
  }

  .admin-shell__user {
    display: block;
    padding: 0 var(--admin-space-3);
  }

  .admin-shell__exit {
    justify-content: flex-start;
    padding: 0 var(--admin-space-3);
  }

  .admin-shell__main {
    padding: var(--admin-space-7);
  }
}
</style>

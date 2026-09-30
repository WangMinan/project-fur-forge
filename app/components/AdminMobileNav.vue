<script setup lang="ts">
import type { AdminNavCurrent } from '~/utils/admin-nav'
import { useFullscreenNavigation } from '~/composables/useFullscreenNavigation'
import { ADMIN_NAV_ITEMS } from '~/utils/admin-nav'

const props = defineProps<{
  open: boolean
  triggerId: string
  current: AdminNavCurrent
  username: string | undefined
  logoutPending: boolean
  logoutError: string | null
}>()

const emit = defineEmits<{
  close: []
  logout: []
}>()

const route = useRoute()
const panelRef = useTemplateRef<HTMLElement>('panelRef')

function close() {
  emit('close')
}

useFullscreenNavigation({
  open: () => props.open,
  panel: panelRef,
  triggerId: props.triggerId,
  close,
})

watch(() => route.fullPath, () => {
  if (props.open) {
    close()
  }
})
</script>

<template>
  <Transition name="admin-mobile-nav">
    <div
      v-if="open"
      id="admin-mobile-nav-panel"
      ref="panelRef"
      class="admin-mobile-nav"
      role="dialog"
      aria-modal="true"
      aria-label="管理导航"
      data-testid="admin-mobile-nav"
    >
      <div class="admin-mobile-nav__bar">
        <p class="admin-mobile-nav__brand">
          <span class="admin-mobile-nav__brand-name">有点小狗工作室</span>
          <span class="admin-mobile-nav__brand-role">管理端</span>
        </p>
        <button
          type="button"
          class="admin-mobile-nav__close"
          aria-label="关闭管理导航"
          @click="close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <nav class="admin-mobile-nav__links" aria-label="管理导航入口">
        <NuxtLink
          v-for="(item, index) in ADMIN_NAV_ITEMS"
          :key="item.key"
          :to="item.href"
          class="admin-mobile-nav__link"
          :style="{ animationDelay: `${index * 40}ms` }"
          :aria-current="current === item.key ? 'page' : undefined"
          @click="close"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="admin-mobile-nav__session">
        <p v-if="username" class="admin-mobile-nav__user">
          当前账号：{{ username }}
        </p>
        <p v-if="logoutError" class="admin-mobile-nav__alert" role="alert">
          {{ logoutError }}
        </p>
        <button
          type="button"
          class="admin-mobile-nav__exit"
          :disabled="logoutPending"
          @click="emit('logout')"
        >
          {{ logoutPending ? '退出中…' : '退出登录' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.admin-mobile-nav {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: var(--space-4) var(--public-page-padding) var(--space-6);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
}

.admin-mobile-nav__bar,
.admin-mobile-nav__brand {
  display: flex;
  align-items: center;
}

.admin-mobile-nav__bar {
  justify-content: space-between;
  gap: var(--admin-space-4);
  min-height: 3rem;
}

.admin-mobile-nav__brand {
  gap: var(--admin-space-2);
  min-width: 0;
  margin: 0;
  white-space: nowrap;
}

.admin-mobile-nav__brand-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.admin-mobile-nav__brand-role {
  padding: 0.05rem 0.5rem;
  color: var(--admin-accent-primary);
  font-size: var(--admin-font-xs);
  border: 1px solid var(--admin-accent-tint);
  border-radius: 999px;
}

.admin-mobile-nav__close {
  display: grid;
  flex: none;
  width: var(--admin-touch-target);
  height: var(--admin-touch-target);
  padding: 0;
  color: inherit;
  background: none;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  place-items: center;
}

.admin-mobile-nav__close:hover {
  background: var(--public-bg-tertiary);
}

.admin-mobile-nav__close:active {
  background: var(--public-bg-secondary);
}

.admin-mobile-nav__links {
  display: grid;
  gap: var(--admin-space-1);
  margin-top: var(--admin-space-6);
}

.admin-mobile-nav__link {
  display: flex;
  align-items: center;
  min-height: var(--admin-touch-target);
  padding: var(--space-3) var(--space-2);
  color: var(--admin-text-primary);
  font-family: var(--font-role-ui);
  font-size: var(--font-size-lg);
  line-height: var(--line-height-heading);
  border-radius: var(--radius-sm);
  animation: admin-mobile-nav-link-in var(--motion-duration-state) var(--motion-ease-standard) both;
}

.admin-mobile-nav__link:hover {
  color: var(--admin-accent-primary);
  background: var(--public-bg-secondary);
}

.admin-mobile-nav__link[aria-current='page'] {
  color: var(--admin-accent-primary);
}

.admin-mobile-nav__link:active {
  color: var(--public-accent-active);
}

.admin-mobile-nav__session {
  display: grid;
  gap: var(--admin-space-3);
  margin-top: auto;
  padding-top: var(--admin-space-5);
  border-top: 1px solid var(--admin-border-secondary);
}

.admin-mobile-nav__user,
.admin-mobile-nav__alert {
  margin: 0;
  font-size: var(--admin-font-sm);
}

.admin-mobile-nav__user {
  color: var(--admin-text-tertiary);
}

.admin-mobile-nav__alert {
  padding: var(--admin-space-3);
  color: var(--admin-status-error);
  background: var(--admin-status-error-soft);
  border-radius: var(--admin-radius-md);
}

.admin-mobile-nav__exit {
  min-height: var(--admin-touch-target);
  padding: 0 var(--admin-space-3);
  color: var(--admin-text-secondary);
  font: inherit;
  text-align: left;
  background: var(--admin-bg-subtle);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  cursor: pointer;
}

.admin-mobile-nav__close:focus-visible {
  outline: 3px solid var(--public-focus-ring);
  outline-offset: 2px;
}

.admin-mobile-nav__link:focus-visible {
  outline: 3px solid var(--public-focus-ring);
  outline-offset: -2px;
}

.admin-mobile-nav__exit:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.admin-mobile-nav__exit:disabled {
  opacity: 0.65;
  cursor: default;
}

.admin-mobile-nav-enter-active,
.admin-mobile-nav-leave-active {
  transition:
    opacity var(--motion-duration-state) var(--motion-ease-standard),
    transform var(--motion-duration-state) var(--motion-ease-standard);
}

.admin-mobile-nav-enter-from,
.admin-mobile-nav-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes admin-mobile-nav-link-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-mobile-nav-enter-active,
  .admin-mobile-nav-leave-active {
    transition: opacity var(--motion-duration-state) var(--motion-ease-standard);
  }

  .admin-mobile-nav-enter-from,
  .admin-mobile-nav-leave-to {
    transform: none;
  }

  .admin-mobile-nav__link {
    animation: none;
  }
}
</style>

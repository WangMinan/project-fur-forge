<script setup lang="ts">
// 管理端壳：窄屏为顶栏 + 横向导航，≥1280px 为固定侧栏。
// P0 仅包含已实现的作品管理入口；P1/P2 项目（业务状态、站点内容、账号等）在对应任务实现前不出现。
withDefaults(defineProps<{
  current?: 'works' | 'none'
}>(), {
  current: 'none',
})
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
          to="/admin/works"
          class="admin-shell__nav-link"
          :aria-current="current === 'works' ? 'page' : undefined"
        >作品</NuxtLink>
      </nav>
      <NuxtLink to="/admin/login" class="admin-shell__exit">退出登录</NuxtLink>
    </header>
    <main id="admin-main" class="admin-shell__main" tabindex="-1">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
}

.admin-shell__bar {
  display: flex;
  align-items: center;
  gap: var(--admin-space-4);
  padding: 0 var(--admin-space-4);
  background: var(--admin-bg-primary);
  border-bottom: 1px solid var(--admin-border-secondary);
  min-height: 3.5rem;
}

.admin-shell__brand {
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
  display: flex;
  gap: var(--admin-space-1);
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

.admin-shell__exit {
  margin-left: auto;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
  min-height: var(--admin-touch-target);
  display: inline-flex;
  align-items: center;
}

.admin-shell__exit:hover {
  color: var(--admin-text-primary);
}

.admin-shell__main {
  padding: var(--admin-space-4);
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
    flex-direction: column;
    align-items: flex-start;
    gap: var(--admin-space-2);
    padding: 0 var(--admin-space-2);
  }

  .admin-shell__nav {
    flex-direction: column;
  }

  .admin-shell__exit {
    margin: auto 0 0;
    padding: 0 var(--admin-space-3);
  }

  .admin-shell__main {
    padding: var(--admin-space-7);
  }
}
</style>

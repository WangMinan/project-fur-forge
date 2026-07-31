<script setup lang="ts">
const { status, ensureSession } = useAdminAuth()

// guest 重定向由 app.vue 全局 watcher 负责（覆盖 layout:false 的过渡页）；
// 本布局只负责 loading/error 的呈现与 slot 门禁。
async function retrySessionCheck() {
  await ensureSession({ revalidate: true })
}
</script>

<template>
  <div class="admin-layout">
    <a href="#admin-main" class="skip-link">跳到主要内容</a>
    <div
      v-if="status === 'unknown' || status === 'loading'"
      class="admin-layout__notice"
      role="status"
    >
      <p class="admin-layout__notice-text">正在确认登录状态…</p>
    </div>
    <div
      v-else-if="status === 'error'"
      class="admin-layout__notice"
    >
      <p class="admin-layout__notice-text" role="alert">
        暂时无法确认登录状态，请检查网络连接后重试。
      </p>
      <button
        type="button"
        class="admin-layout__retry"
        @click="retrySessionCheck"
      >
        重试
      </button>
    </div>
    <!-- 未确认或已失效时不渲染 slot，受保护页面内容不会闪现或残留。 -->
    <slot v-else-if="status === 'ready'" />
  </div>
</template>

<!--
  管理端专用布局：不继承公开站 Header/Footer，也不创建 <main>。
  唯一 main landmark 由 AdminShell（#admin-main）持有；登录页使用 layout: false 独立呈现。
  布局同时承担 Session 门禁：loading/error/guest 状态下受保护内容不渲染。
-->
<style scoped>
.admin-layout {
  min-height: 100vh;
  background: #f6f7f9;
}

.admin-layout__notice {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--admin-space-4);
  padding: var(--admin-space-6);
  text-align: center;
}

.admin-layout__notice-text {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.admin-layout__retry {
  min-height: var(--admin-touch-target);
  padding: 0 var(--admin-space-5);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-accent-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.admin-layout__retry:hover {
  background: var(--admin-bg-subtle);
}

.admin-layout__retry:focus-visible {
  outline: none;
  border-color: var(--admin-border-focus);
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}
</style>

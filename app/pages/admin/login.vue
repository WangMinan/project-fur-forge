<script setup lang="ts">
definePageMeta({
  layout: false,
})

useSeoMeta({
  title: '管理端登录',
  robots: 'noindex, nofollow',
})

const route = useRoute()

const username = ref('')
const password = ref('')
const submitting = ref(false)
const submitNotice = ref<string | null>(null)

const stateError = computed(() => {
  if (route.query.state === 'error') {
    return '用户名或密码不正确。'
  }
  if (route.query.state === 'locked') {
    return '登录已临时锁定，请 15 分钟后再试。'
  }
  return null
})

function onSubmit() {
  submitNotice.value = null
  submitting.value = true
  // 只呈现真实 UI 的提交/加载序列；认证接口在 T13 接入，这里不校验凭据、不创建会话。
  window.setTimeout(() => {
    submitting.value = false
    submitNotice.value = '认证接口尚未接入（T13）：当前为视觉样张，不校验真实凭据，也不会创建会话。'
  }, 600)
}
</script>

<template>
  <div class="admin-surface login" data-testid="admin-login">
    <main class="login__main">
      <div class="login__card">
        <header class="login__header">
          <p class="login__brand">有点小狗工作室</p>
          <p class="login__brand-sub">dite dog · 管理端</p>
          <h1 class="login__title">管理端登录</h1>
        </header>

        <p v-if="stateError" class="login__alert" role="alert">{{ stateError }}</p>
        <p v-if="submitNotice" class="login__alert" role="alert">{{ submitNotice }}</p>

        <form class="login__form" :aria-busy="submitting" @submit.prevent="onSubmit">
          <div class="login__field">
            <label class="login__label" for="login-username">用户名或邮箱</label>
            <input
              id="login-username"
              v-model="username"
              class="login__input"
              type="text"
              autocomplete="username"
              required
              :disabled="submitting"
            >
          </div>
          <div class="login__field">
            <label class="login__label" for="login-password">密码</label>
            <input
              id="login-password"
              v-model="password"
              class="login__input"
              type="password"
              autocomplete="current-password"
              required
              :disabled="submitting"
            >
          </div>
          <button class="login__submit" type="submit" :disabled="submitting">
            {{ submitting ? '登录中…' : '登录' }}
          </button>
        </form>

        <footer class="login__footer">
          <p>认证能力尚未接入（T13）：当前不校验真实凭据、不产生会话。找回密码等 P2 能力将在实现后加入。</p>
        </footer>
      </div>
    </main>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  background: var(--admin-bg-workspace);
  display: flex;
}

.login__main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--admin-space-5);
}

.login__card {
  width: 100%;
  max-width: 24rem;
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-7) var(--admin-space-6);
  box-shadow: var(--admin-shadow-popover);
}

.login__header {
  margin-bottom: var(--admin-space-6);
}

.login__brand {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.login__brand-sub {
  margin: var(--admin-space-1) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.login__title {
  margin: var(--admin-space-5) 0 0;
  font-size: var(--admin-font-xl);
  font-weight: 600;
  line-height: var(--admin-line-tight);
}

.login__alert {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.login__form {
  display: grid;
  gap: var(--admin-space-4);
}

.login__label {
  display: block;
  font-size: var(--admin-font-sm);
  font-weight: 600;
  margin-bottom: var(--admin-space-2);
}

.login__input {
  width: 100%;
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  font: inherit;
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
}

.login__input:focus {
  border-color: var(--admin-border-focus);
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.login__submit {
  min-height: var(--admin-control-height);
  border: none;
  border-radius: var(--admin-radius-md);
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--admin-duration-fast) var(--admin-easing);
}

.login__submit:hover:not(:disabled) {
  background: var(--admin-accent-hover);
}

.login__submit:disabled {
  opacity: 0.65;
  cursor: default;
}

.login__footer {
  margin-top: var(--admin-space-6);
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  line-height: var(--admin-line-normal);
}

.login__footer p {
  margin: 0;
}
</style>

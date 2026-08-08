<script setup lang="ts">
definePageMeta({
  layout: false,
})

useSeoMeta({
  title: '管理端登录',
  robots: 'noindex, nofollow',
})

const route = useRoute()
const { login } = useAdminAuth()

const username = ref('')
const password = ref('')
const submitting = ref(false)
const loginError = ref<string | null>(null)

const passwordChangedNotice = computed(() =>
  route.query.state === 'password-changed'
    ? '密码已修改，请使用新密码重新登录。'
    : null,
)

async function onSubmit() {
  if (submitting.value) {
    return
  }

  loginError.value = null
  submitting.value = true

  try {
    const result = await login({
      username: username.value,
      password: password.value,
    })

    password.value = ''

    if (result.ok) {
      await navigateTo(safeAdminRedirectTarget(route.query.redirect), {
        replace: true,
      })
      return
    }

    if (result.kind === 'credentials') {
      loginError.value = '用户名或密码不正确。'
    }
    else if (result.kind === 'forbidden') {
      loginError.value = '请求被安全校验拒绝，请刷新页面后重试。'
    }
    else {
      loginError.value = '登录服务暂时不可用，请稍后重试。'
    }
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <!--
    登录页保留公开站页头与页脚：这个页面可能被 ICP 备案审核抓到，
    备案信息统一放在公开页脚里。其他管理端页面仍用 admin 布局。
  -->
  <div class="admin-surface login" data-testid="admin-login">
    <PublicHeader brand-only />
    <main class="login__main">
      <div class="login__card">
        <header class="login__header">
          <!-- 品牌已由页头给出，卡片里不再重复一遍。 -->
          <h1 class="login__title">管理端登录</h1>
        </header>

        <p
          v-if="passwordChangedNotice"
          class="login__notice"
          role="status"
        >{{ passwordChangedNotice }}</p>
        <p
          v-if="loginError"
          id="login-error"
          class="login__alert"
          role="alert"
        >{{ loginError }}</p>

        <form class="login__form" :aria-busy="submitting" @submit.prevent="onSubmit">
          <div class="login__field">
            <label class="login__label" for="login-username">用户名</label>
            <input
              id="login-username"
              v-model="username"
              class="login__input"
              type="text"
              autocomplete="username"
              required
              :disabled="submitting"
              :aria-invalid="loginError ? 'true' : undefined"
              :aria-describedby="loginError ? 'login-error' : undefined"
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
              :aria-invalid="loginError ? 'true' : undefined"
              :aria-describedby="loginError ? 'login-error' : undefined"
            >
          </div>
          <button class="login__submit" type="submit" :disabled="submitting">
            {{ submitting ? '登录中…' : '登录' }}
          </button>
        </form>
      </div>
    </main>
    <PublicFooter brand-only />
  </div>
</template>

<style scoped>
.login {
  /* 页头 → 登录卡 → 页脚纵向排列，登录卡吃掉剩余高度并居中。 */
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--admin-bg-workspace);
}

.login__main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--admin-space-7) var(--admin-space-5);
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

.login__title {
  margin: 0;
  font-size: var(--admin-font-xl);
  font-weight: 600;
  line-height: var(--admin-line-tight);
}

.login__notice {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-info-soft);
  color: var(--admin-status-info);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
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

.login__input[aria-invalid='true'] {
  border-color: var(--admin-status-error);
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
</style>

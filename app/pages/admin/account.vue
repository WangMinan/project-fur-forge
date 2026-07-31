<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '账号',
  robots: 'noindex, nofollow',
})

const { user, changePassword, ensureSession } = useAdminAuth()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const currentInput = ref<HTMLInputElement | null>(null)
const newInput = ref<HTMLInputElement | null>(null)
const confirmInput = ref<HTMLInputElement | null>(null)

const submitting = ref(false)
const sessionRefreshing = ref(false)
const formError = ref<string | null>(null)
const conflictPending = ref(false)

const fieldErrors = reactive<{
  current: string | null
  next: string | null
  confirm: string | null
}>({
  current: null,
  next: null,
  confirm: null,
})

function validate() {
  fieldErrors.current = currentPassword.value
    ? null
    : '请输入当前密码。'

  if (!newPassword.value) {
    fieldErrors.next = '请输入新密码。'
  }
  else if (newPassword.value.length < 12) {
    fieldErrors.next = '新密码至少需要 12 个字符。'
  }
  else if (newPassword.value.length > 256) {
    fieldErrors.next = '新密码不能超过 256 个字符。'
  }
  else {
    fieldErrors.next = null
  }

  if (!confirmPassword.value) {
    fieldErrors.confirm = '请再次输入新密码。'
  }
  else if (confirmPassword.value !== newPassword.value) {
    fieldErrors.confirm = '两次输入的新密码不一致。'
  }
  else {
    fieldErrors.confirm = null
  }

  return !fieldErrors.current && !fieldErrors.next && !fieldErrors.confirm
}

function focusFirstInvalid() {
  if (fieldErrors.current) {
    currentInput.value?.focus()
  }
  else if (fieldErrors.next) {
    newInput.value?.focus()
  }
  else if (fieldErrors.confirm) {
    confirmInput.value?.focus()
  }
}

function clearPasswords() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
}

async function onSubmit() {
  if (submitting.value) {
    return
  }

  formError.value = null
  conflictPending.value = false

  if (!validate()) {
    focusFirstInvalid()
    return
  }

  submitting.value = true

  try {
    const result = await changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })

    clearPasswords()

    if (result.ok) {
      await navigateTo(
        {
          path: '/admin/login',
          query: { state: 'password-changed' },
        },
        { replace: true },
      )
      return
    }

    if (result.kind === 'wrong-current') {
      fieldErrors.current = '当前密码不正确。'
      currentInput.value?.focus()
    }
    else if (result.kind === 'conflict') {
      conflictPending.value = true
    }
    else if (result.kind === 'forbidden') {
      formError.value = '请求被安全校验拒绝，请刷新登录状态后重试。'
    }
    else if (result.kind === 'unauthenticated') {
      formError.value = '登录状态已失效，请重新登录。'
    }
    else {
      formError.value = '服务暂时不可用，请稍后重试。'
    }
  }
  finally {
    submitting.value = false
  }
}

async function refreshSession() {
  if (sessionRefreshing.value) {
    return
  }

  sessionRefreshing.value = true

  try {
    const resolved = await ensureSession({ revalidate: true })
    if (resolved === 'ready') {
      conflictPending.value = false
      formError.value = null
    }
    else if (resolved === 'error') {
      formError.value = '刷新失败，请检查网络连接后重试。'
    }
    // guest：会话已失效，布局门禁会自动回到登录页。
  }
  finally {
    sessionRefreshing.value = false
  }
}
</script>

<template>
  <AdminShell current="account">
    <div class="account-page">
      <header class="account-page__header">
        <h1 class="account-page__title">账号</h1>
      </header>

      <section class="account-card" aria-labelledby="account-profile-title">
        <h2 id="account-profile-title" class="account-card__title">当前账号</h2>
        <dl class="account-profile">
          <dt class="account-profile__term">用户名</dt>
          <dd class="account-profile__value" data-testid="account-username">
            {{ user?.username }}
          </dd>
        </dl>
      </section>

      <section class="account-card" aria-labelledby="account-password-title">
        <h2 id="account-password-title" class="account-card__title">修改密码</h2>
        <p id="password-change-hint" class="account-card__hint">
          新密码至少 12 个字符；修改成功后所有登录状态失效，需要重新登录。
        </p>

        <p
          v-if="formError"
          id="password-form-error"
          class="account-card__alert"
          role="alert"
        >{{ formError }}</p>

        <div
          v-if="conflictPending"
          class="account-card__conflict"
          role="alert"
        >
          <p class="account-card__conflict-text">
            账号信息已在其他地方发生变化，本次修改未保存。请先刷新登录状态，再重新提交。
          </p>
          <button
            type="button"
            class="account-card__conflict-action"
            :disabled="sessionRefreshing"
            @click="refreshSession"
          >
            {{ sessionRefreshing ? '刷新中…' : '刷新登录状态' }}
          </button>
        </div>

        <form
          class="account-form"
          :aria-busy="submitting"
          @submit.prevent="onSubmit"
        >
          <div class="account-form__field">
            <label class="account-form__label" for="password-current">当前密码</label>
            <input
              id="password-current"
              ref="currentInput"
              v-model="currentPassword"
              class="account-form__input"
              type="password"
              autocomplete="current-password"
              required
              :disabled="submitting"
              :aria-invalid="fieldErrors.current ? 'true' : undefined"
              :aria-describedby="fieldErrors.current ? 'password-current-error' : undefined"
            >
            <p
              v-if="fieldErrors.current"
              id="password-current-error"
              class="account-form__error"
              role="alert"
            >{{ fieldErrors.current }}</p>
          </div>

          <div class="account-form__field">
            <label class="account-form__label" for="password-new">新密码</label>
            <input
              id="password-new"
              ref="newInput"
              v-model="newPassword"
              class="account-form__input"
              type="password"
              autocomplete="new-password"
              required
              :disabled="submitting"
              :aria-invalid="fieldErrors.next ? 'true' : undefined"
              :aria-describedby="fieldErrors.next ? 'password-new-hint password-new-error' : 'password-new-hint'"
            >
            <p
              v-if="fieldErrors.next"
              id="password-new-error"
              class="account-form__error"
              role="alert"
            >{{ fieldErrors.next }}</p>
          </div>

          <div class="account-form__field">
            <label class="account-form__label" for="password-confirm">确认新密码</label>
            <input
              id="password-confirm"
              ref="confirmInput"
              v-model="confirmPassword"
              class="account-form__input"
              type="password"
              autocomplete="new-password"
              required
              :disabled="submitting"
              :aria-invalid="fieldErrors.confirm ? 'true' : undefined"
              :aria-describedby="fieldErrors.confirm ? 'password-confirm-error' : undefined"
            >
            <p
              v-if="fieldErrors.confirm"
              id="password-confirm-error"
              class="account-form__error"
              role="alert"
            >{{ fieldErrors.confirm }}</p>
          </div>

          <div class="account-form__actions">
            <button
              class="account-form__submit"
              type="submit"
              :disabled="submitting"
            >
              {{ submitting ? '提交中…' : '修改密码' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </AdminShell>
</template>

<style scoped>
.account-page {
  max-width: var(--admin-reading-max);
}

.account-page__header {
  margin-bottom: var(--admin-space-5);
}

.account-page__title {
  margin: 0;
  font-size: var(--admin-font-xl);
  font-weight: 600;
  line-height: var(--admin-line-tight);
}

.account-card {
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-6);
}

.account-card + .account-card {
  margin-top: var(--admin-space-4);
}

.account-card__title {
  margin: 0 0 var(--admin-space-4);
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.account-card__hint {
  margin: 0 0 var(--admin-space-4);
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
  line-height: var(--admin-line-normal);
}

.account-profile {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: var(--admin-space-4);
}

.account-profile__term {
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.account-profile__value {
  margin: 0;
  font-size: var(--admin-font-base);
  font-weight: 600;
}

.account-card__alert {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.account-card__conflict {
  margin: 0 0 var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-warning-soft);
  color: var(--admin-status-warning);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-4);
  flex-wrap: wrap;
}

.account-card__conflict-text {
  margin: 0;
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.account-card__conflict-action {
  min-height: var(--admin-touch-target);
  padding: 0 var(--admin-space-4);
  border: 1px solid currentColor;
  border-radius: var(--admin-radius-md);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--admin-font-sm);
  font-weight: 600;
  cursor: pointer;
}

.account-card__conflict-action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.5);
}

.account-card__conflict-action:disabled {
  opacity: 0.65;
  cursor: default;
}

.account-form {
  display: grid;
  gap: var(--admin-space-4);
  max-width: 24rem;
}

.account-form__label {
  display: block;
  font-size: var(--admin-font-sm);
  font-weight: 600;
  margin-bottom: var(--admin-space-2);
}

.account-form__input {
  width: 100%;
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  font: inherit;
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
}

.account-form__input:focus {
  border-color: var(--admin-border-focus);
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.account-form__input[aria-invalid='true'] {
  border-color: var(--admin-status-error);
}

.account-form__error {
  margin: var(--admin-space-2) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-error);
}

.account-form__actions {
  margin-top: var(--admin-space-2);
}

.account-form__submit {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: none;
  border-radius: var(--admin-radius-md);
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--admin-duration-fast) var(--admin-easing);
}

.account-form__submit:hover:not(:disabled) {
  background: var(--admin-accent-hover);
}

.account-form__submit:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--admin-focus-ring);
}

.account-form__submit:disabled {
  opacity: 0.65;
  cursor: default;
}
</style>

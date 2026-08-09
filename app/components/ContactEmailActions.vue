<script setup lang="ts">
// T26–T27 邮件行动组：打开邮件客户端（mailto）+ 复制邮箱。
// 邮箱只来自公开投影；复制反馈用 aria-live 宣告，键盘按原生按钮操作。
const props = withDefaults(defineProps<{
  email: string
  subject?: string | undefined
}>(), {
  subject: undefined,
})

const route = useRoute()

const mailtoHref = computed(() => {
  const base = `mailto:${props.email}`
  return props.subject ? `${base}?subject=${encodeURIComponent(props.subject)}` : base
})

const copyState = ref<'copied' | 'failed' | 'idle'>('idle')
let copyTimer: ReturnType<typeof setTimeout> | null = null

/** 部分内嵌浏览器（如微信）不支持异步剪贴板 API，退回隐藏 textarea 复制。 */
function copyWithExecCommand(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.inset = '0 auto auto 0'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  area.setSelectionRange(0, area.value.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  }
  catch {
    ok = false
  }
  area.remove()
  return ok
}

async function onCopy() {
  trackPublicContactAction(route.path, 'email_copy')
  if (copyTimer) {
    clearTimeout(copyTimer)
    copyTimer = null
  }
  let copied = false
  try {
    await navigator.clipboard.writeText(props.email)
    copied = true
  }
  catch {
    copied = copyWithExecCommand(props.email)
  }
  copyState.value = copied ? 'copied' : 'failed'
  copyTimer = setTimeout(() => {
    copyState.value = 'idle'
    copyTimer = null
  }, 3_000)
}

function onEmailOpen() {
  trackPublicContactAction(route.path, 'email_open')
}

onScopeDispose(() => {
  if (copyTimer) {
    clearTimeout(copyTimer)
  }
})
</script>

<template>
  <div class="email-actions">
    <div class="email-actions__buttons">
      <a class="email-actions__primary" :href="mailtoHref" @click="onEmailOpen">
        打开邮件客户端
        <span aria-hidden="true">↗</span>
      </a>
      <button
        type="button"
        class="email-actions__copy"
        @click="onCopy"
      >
        {{ copyState === 'copied' ? '已复制邮箱' : '复制邮箱' }}
      </button>
    </div>
    <p class="email-actions__address">
      <a :href="mailtoHref" class="email-actions__address-link" @click="onEmailOpen">{{ email }}</a>
    </p>
    <p v-if="copyState === 'failed'" class="email-actions__feedback" role="alert">
      复制失败，请手动选择邮箱地址复制。
    </p>
    <p v-else-if="copyState === 'copied'" class="email-actions__feedback" role="status">
      邮箱地址已复制到剪贴板。
    </p>
  </div>
</template>

<style scoped>
.email-actions {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
}

.email-actions__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.email-actions__primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  padding: 0 var(--space-5);
  color: var(--public-text-inverse);
  background: var(--public-accent-primary);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.email-actions__primary:hover {
  color: var(--public-text-inverse);
  background: var(--public-accent-hover);
}

.email-actions__copy {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 var(--space-5);
  color: var(--public-text-primary);
  background: none;
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.email-actions__copy:hover {
  background: var(--public-bg-secondary);
}

.email-actions__address {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

.email-actions__feedback {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}
</style>

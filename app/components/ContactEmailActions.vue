<script setup lang="ts">
// T26–T27 邮件行动组：打开邮件客户端（mailto）+ 复制邮箱。
// 邮箱只来自公开投影；复制反馈用 aria-live 宣告，键盘按原生按钮操作。
const props = withDefaults(defineProps<{
  email: string
  showAddress?: boolean
  subject?: string | undefined
}>(), {
  showAddress: false,
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
    <div v-if="showAddress" class="email-actions__identity">
      <h3 class="email-actions__label">邮箱</h3>
      <p class="email-actions__address">{{ email }}</p>
    </div>
    <div class="email-actions__buttons">
      <PublicAction :href="mailtoHref" variant="secondary" @click="onEmailOpen">
        打开邮件客户端
        <span aria-hidden="true">↗</span>
      </PublicAction>
      <span class="email-actions__copy-anchor">
        <PublicAction class="email-actions__copy" variant="secondary" @click="onCopy">
          复制邮箱
        </PublicAction>
        <span
          v-if="copyState !== 'idle'"
          class="email-actions__feedback"
          :class="`email-actions__feedback--${copyState}`"
          :role="copyState === 'failed' ? 'alert' : 'status'"
        >
          {{ copyState === 'copied' ? '已复制到剪贴板' : '复制失败，请手动选择' }}
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.email-actions {
  display: grid;
  gap: var(--space-4);
  justify-items: start;
}

.email-actions__identity {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.email-actions__label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  line-height: var(--line-height-heading);
}

.email-actions__address {
  max-width: 100%;
  color: var(--public-text-secondary);
  font-family: var(--font-role-metadata);
  font-size: var(--type-ui-size);
  line-height: var(--type-ui-line-height);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.email-actions__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.email-actions__copy {
  min-width: 7.5rem;
}

.email-actions__copy-anchor {
  position: relative;
  display: inline-flex;
}

.email-actions__feedback {
  position: absolute;
  right: 0;
  bottom: calc(100% + var(--space-2));
  z-index: 4;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--public-text-inverse);
  background: var(--public-text-primary);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  animation: email-feedback-in var(--motion-duration-state) var(--motion-ease-standard);
}

.email-actions__feedback--failed {
  background: var(--public-status-paused);
}

@keyframes email-feedback-in {
  from {
    opacity: 0;
    transform: translateY(0.25rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .email-actions__feedback {
    animation: none;
  }
}
</style>

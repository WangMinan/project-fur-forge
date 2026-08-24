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
    <PublicAction :href="mailtoHref" @click="onEmailOpen">
      打开邮件客户端
      <span aria-hidden="true">↗</span>
    </PublicAction>
    <!--
      复制反馈做成按钮上方的浮层，不再在按钮下方插入一段文字：
      插入文字会把整行推开、把同行按钮挤走（下方 __feedback 注释）。
      按钮文字保持"复制邮箱"不变，宽度因此也不随状态跳动。
    -->
    <span class="email-actions__copy-anchor">
      <PublicAction variant="secondary" @click="onCopy">
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
</template>

<style scoped>
.email-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.email-actions__copy-anchor {
  position: relative;
  display: inline-flex;
}

/*
 * 绝对定位的浮层：反馈不参与布局，因此出现和消失都不会推开同行的其它按钮。
 * 贴按钮右端展开（浮层比按钮宽，居中会探出容器），文字不折行。
 */
.email-actions__feedback {
  position: absolute;
  right: 0;
  bottom: calc(100% + var(--space-2));
  z-index: 2;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--public-text-inverse);
  background: var(--public-text-primary);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  animation: email-actions-feedback-in var(--motion-duration-state) var(--motion-ease-standard);
}

.email-actions__feedback--failed {
  background: var(--public-status-paused);
}

@keyframes email-actions-feedback-in {
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

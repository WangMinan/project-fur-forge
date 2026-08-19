<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  disabled?: boolean
  href?: string | undefined
  loading?: boolean
  loadingLabel?: string
  size?: 'normal' | 'small'
  to?: RouteLocationRaw | undefined
  type?: 'button' | 'reset' | 'submit'
  variant?: 'danger' | 'primary' | 'secondary' | 'text'
}>(), {
  disabled: false,
  href: undefined,
  loading: false,
  loadingLabel: '处理中…',
  size: 'normal',
  to: undefined,
  type: 'button',
  variant: 'secondary',
})

const blocked = computed(() => props.disabled || props.loading)

function preventBlockedNavigation(event: Event) {
  if (blocked.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}
</script>

<template>
  <NuxtLink
    v-if="to"
    v-bind="$attrs"
    class="admin-action"
    :class="[`admin-action--${variant}`, `admin-action--${size}`]"
    :to="to"
    :aria-busy="loading || undefined"
    :aria-disabled="blocked || undefined"
    :tabindex="blocked ? -1 : undefined"
    @click="preventBlockedNavigation"
  >
    <span v-if="loading" class="admin-action__spinner" aria-hidden="true" />
    <span>{{ loading ? loadingLabel : undefined }}<slot v-if="!loading" /></span>
  </NuxtLink>
  <a
    v-else-if="href"
    v-bind="$attrs"
    class="admin-action"
    :class="[`admin-action--${variant}`, `admin-action--${size}`]"
    :href="blocked ? undefined : href"
    :aria-busy="loading || undefined"
    :aria-disabled="blocked || undefined"
    :tabindex="blocked ? -1 : undefined"
    @click="preventBlockedNavigation"
  >
    <span v-if="loading" class="admin-action__spinner" aria-hidden="true" />
    <span>{{ loading ? loadingLabel : undefined }}<slot v-if="!loading" /></span>
  </a>
  <button
    v-else
    v-bind="$attrs"
    class="admin-action"
    :class="[`admin-action--${variant}`, `admin-action--${size}`]"
    :type="type"
    :disabled="blocked"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="admin-action__spinner" aria-hidden="true" />
    <span>{{ loading ? loadingLabel : undefined }}<slot v-if="!loading" /></span>
  </button>
</template>

<style scoped>
.admin-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--admin-space-2);
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: 1px solid transparent;
  border-radius: var(--admin-radius-md);
  font: inherit;
  font-weight: 600;
  line-height: 1;
  text-align: center;
  cursor: pointer;
  transition:
    color var(--admin-duration-fast) var(--admin-easing),
    background-color var(--admin-duration-fast) var(--admin-easing),
    border-color var(--admin-duration-fast) var(--admin-easing),
    transform var(--admin-duration-fast) var(--admin-easing);
}

.admin-action--small {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  font-size: var(--admin-font-xs);
}

.admin-action--primary {
  color: var(--admin-text-inverse);
  background: var(--admin-accent-primary);
  border-color: var(--admin-accent-primary);
}

.admin-action--primary:hover:not([aria-disabled='true']) {
  color: var(--admin-text-inverse);
  background: var(--admin-accent-hover);
  border-color: var(--admin-accent-hover);
}

.admin-action--secondary {
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
  border-color: var(--admin-border-primary);
}

.admin-action--secondary:hover:not([aria-disabled='true']) {
  background: var(--admin-bg-subtle);
}

.admin-action--danger {
  color: var(--admin-danger);
  background: var(--admin-bg-primary);
  border-color: var(--admin-danger);
}

.admin-action--danger:hover:not([aria-disabled='true']) {
  color: var(--admin-text-inverse);
  background: var(--admin-danger-hover);
  border-color: var(--admin-danger-hover);
}

.admin-action--text {
  min-height: var(--admin-control-height-sm);
  padding: 0;
  color: var(--admin-accent-primary);
  background: transparent;
  border-radius: var(--admin-radius-sm);
}

.admin-action--text:hover:not([aria-disabled='true']) {
  color: var(--admin-accent-hover);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.admin-action:active:not([aria-disabled='true']) {
  transform: translateY(1px);
}

.admin-action:disabled,
.admin-action[aria-disabled='true'] {
  cursor: default;
  opacity: 0.55;
}

.admin-action__spinner {
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: admin-action-spin 700ms linear infinite;
}

@keyframes admin-action-spin {
  to { transform: rotate(1turn); }
}

@media (prefers-reduced-motion: reduce) {
  .admin-action,
  .admin-action__spinner {
    transition: none;
    animation: none;
  }

  .admin-action:active:not([aria-disabled='true']) {
    transform: none;
  }
}
</style>

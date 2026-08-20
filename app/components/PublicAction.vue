<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  disabled?: boolean
  href?: string | undefined
  loading?: boolean
  loadingLabel?: string
  to?: RouteLocationRaw | undefined
  type?: 'button' | 'reset' | 'submit'
  variant?: 'primary' | 'secondary' | 'text'
}>(), {
  disabled: false,
  href: undefined,
  loading: false,
  loadingLabel: '处理中…',
  to: undefined,
  type: 'button',
  variant: 'primary',
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
    class="public-action"
    :class="`public-action--${variant}`"
    :to="to"
    :aria-busy="loading || undefined"
    :aria-disabled="blocked || undefined"
    :tabindex="blocked ? -1 : undefined"
    @click="preventBlockedNavigation"
  >
    <span v-if="loading" class="public-action__spinner" aria-hidden="true" />
    <span>{{ loading ? loadingLabel : undefined }}<slot v-if="!loading" /></span>
  </NuxtLink>
  <a
    v-else-if="href"
    v-bind="$attrs"
    class="public-action"
    :class="`public-action--${variant}`"
    :href="blocked ? undefined : href"
    :aria-busy="loading || undefined"
    :aria-disabled="blocked || undefined"
    :tabindex="blocked ? -1 : undefined"
    @click="preventBlockedNavigation"
  >
    <span v-if="loading" class="public-action__spinner" aria-hidden="true" />
    <span>{{ loading ? loadingLabel : undefined }}<slot v-if="!loading" /></span>
  </a>
  <button
    v-else
    v-bind="$attrs"
    class="public-action"
    :class="`public-action--${variant}`"
    :type="type"
    :disabled="blocked"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="public-action__spinner" aria-hidden="true" />
    <span>{{ loading ? loadingLabel : undefined }}<slot v-if="!loading" /></span>
  </button>
</template>

<style scoped>
.public-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  padding: 0 var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: 1;
  text-align: center;
  cursor: pointer;
  transition:
    color var(--motion-duration-feedback) var(--motion-ease-standard),
    background-color var(--motion-duration-feedback) var(--motion-ease-standard),
    border-color var(--motion-duration-feedback) var(--motion-ease-standard),
    transform var(--motion-duration-feedback) var(--motion-ease-standard);
}

.public-action--primary {
  color: var(--public-action-primary-text, var(--public-text-inverse));
  background: var(--public-action-primary-bg, var(--public-accent-primary));
  border-color: var(--public-action-primary-border, var(--public-accent-primary));
}

.public-action--primary:hover:not([aria-disabled='true']) {
  color: var(--public-action-primary-hover-text, var(--public-text-inverse));
  background: var(--public-action-primary-hover-bg, var(--public-accent-hover));
  border-color: var(--public-action-primary-hover-border, var(--public-accent-hover));
}

.public-action--secondary {
  color: var(--public-action-secondary-text, var(--public-text-primary));
  background: var(--public-action-secondary-bg, var(--public-bg-primary));
  border-color: var(--public-action-secondary-border, var(--public-border-primary));
}

.public-action--secondary:hover:not([aria-disabled='true']) {
  color: var(--public-action-secondary-hover-text, var(--public-accent-hover));
  background: var(--public-action-secondary-hover-bg, var(--public-bg-secondary));
  border-color: var(--public-action-secondary-hover-border, var(--public-accent-decorative));
}

.public-action--text {
  min-height: 2.75rem;
  padding: 0;
  color: var(--public-action-text, var(--public-text-link));
  background: transparent;
  border-radius: var(--radius-xs);
}

.public-action--text:hover:not([aria-disabled='true']) {
  color: var(--public-action-text-hover, var(--public-accent-hover));
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

.public-action:active:not([aria-disabled='true']) {
  transform: translateY(1px) scale(0.99);
}

.public-action:disabled,
.public-action[aria-disabled='true'] {
  cursor: default;
  opacity: 0.55;
}

.public-action__spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: public-action-spin 700ms linear infinite;
}

@keyframes public-action-spin {
  to { transform: rotate(1turn); }
}

@media (prefers-reduced-motion: reduce) {
  .public-action {
    transition:
      color var(--motion-duration-feedback) var(--motion-ease-standard),
      background-color var(--motion-duration-feedback) var(--motion-ease-standard),
      border-color var(--motion-duration-feedback) var(--motion-ease-standard);
  }

  .public-action__spinner {
    animation: none;
  }

  .public-action:active:not([aria-disabled='true']) {
    transform: none;
  }
}
</style>

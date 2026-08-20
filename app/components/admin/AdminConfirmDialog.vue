<script setup lang="ts">
const props = withDefaults(defineProps<{
  cancelLabel?: string
  busy?: boolean
  confirmLabel: string
  confirmDisabled?: boolean
  confirmLoadingLabel?: string
  open: boolean
  showCancel?: boolean
  title: string
  tone?: 'danger' | 'primary'
}>(), {
  cancelLabel: '取消',
  busy: false,
  confirmDisabled: false,
  confirmLoadingLabel: '处理中…',
  showCancel: true,
  tone: 'primary',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialog = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null

watch(() => props.open, async (open) => {
  if (open) {
    returnFocus = document.activeElement as HTMLElement | null
    await nextTick()
    dialog.value?.querySelector<HTMLElement>(
      props.confirmDisabled ? '[data-cancel]' : '[data-confirm]',
    )?.focus()
  }
  else {
    returnFocus?.focus()
    returnFocus = null
  }
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !props.busy) {
    event.preventDefault()
    emit('cancel')
  }
}

function dismiss() {
  if (!props.busy) {
    emit('cancel')
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="confirm-dialog__overlay"
      @keydown="onKeydown"
      @click.self="dismiss"
    >
      <div
        ref="dialog"
        class="confirm-dialog admin-surface"
        :role="showCancel ? 'dialog' : 'alertdialog'"
        aria-modal="true"
        :aria-busy="busy || undefined"
        :aria-labelledby="'confirm-dialog-title'"
      >
        <h2 id="confirm-dialog-title" class="confirm-dialog__title">{{ title }}</h2>
        <div class="confirm-dialog__body">
          <slot />
        </div>
        <div class="confirm-dialog__actions">
          <button
            v-if="showCancel"
            type="button"
            class="confirm-dialog__button confirm-dialog__button--secondary"
            data-cancel
            :disabled="busy"
            @click="dismiss"
          >{{ cancelLabel }}</button>
          <button
            type="button"
            class="confirm-dialog__button"
            :class="tone === 'danger'
              ? 'confirm-dialog__button--danger'
              : 'confirm-dialog__button--primary'"
            data-confirm
            :disabled="busy || confirmDisabled"
            :aria-busy="busy || undefined"
            @click="emit('confirm')"
          >{{ busy ? confirmLoadingLabel : confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-dialog__overlay {
  position: fixed;
  inset: 0;
  background: var(--admin-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--admin-space-4);
  z-index: 60;
}

.confirm-dialog {
  background: var(--admin-bg-primary);
  border-radius: var(--admin-radius-lg);
  box-shadow: var(--admin-shadow-modal);
  max-width: 26rem;
  width: 100%;
  padding: var(--admin-space-5);
}

.confirm-dialog__title {
  margin: 0 0 var(--admin-space-3);
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.confirm-dialog__body {
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
  line-height: var(--admin-line-normal);
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--admin-space-2);
  margin-top: var(--admin-space-5);
}

.confirm-dialog__button {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border-radius: var(--admin-radius-md);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.confirm-dialog__button:disabled {
  cursor: default;
  opacity: 0.55;
}

.confirm-dialog__button--primary {
  border: none;
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
}

.confirm-dialog__button--primary:hover {
  background: var(--admin-accent-hover);
}

.confirm-dialog__button--danger {
  border: none;
  background: var(--admin-danger);
  color: var(--admin-text-inverse);
}

.confirm-dialog__button--danger:hover {
  background: var(--admin-danger-hover);
}

.confirm-dialog__button--secondary {
  border: 1px solid var(--admin-border-primary);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
}

.confirm-dialog__button--secondary:hover {
  background: var(--admin-bg-subtle);
}
</style>

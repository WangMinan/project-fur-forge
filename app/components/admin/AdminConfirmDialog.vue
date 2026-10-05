<script setup lang="ts">
const props = withDefaults(defineProps<{
  cancelLabel?: string
  busy?: boolean
  confirmLabel: string
  confirmDisabled?: boolean
  confirmLoadingLabel?: string
  open: boolean
  returnFocusTo?: HTMLElement | null
  showCancel?: boolean
  title: string
  tone?: 'danger' | 'primary'
}>(), {
  cancelLabel: '取消',
  busy: false,
  confirmDisabled: false,
  confirmLoadingLabel: '处理中…',
  returnFocusTo: null,
  showCancel: true,
  tone: 'primary',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
let returnFocus: HTMLElement | null = null
let previousOverflow: string | null = null

function closeDialog() {
  dialog.value?.close()
  if (previousOverflow !== null) {
    document.documentElement.style.overflow = previousOverflow
    previousOverflow = null
  }
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
  returnFocus = null
}

watch(() => props.open, async (open) => {
  if (!import.meta.client) return
  if (open) {
    returnFocus = props.returnFocusTo ?? document.activeElement as HTMLElement | null
    await nextTick()
    if (!props.open || !dialog.value || dialog.value.open) return
    previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    dialog.value.showModal()
    dialog.value?.querySelector<HTMLElement>(
      props.showCancel ? '[data-cancel]' : '[data-confirm]',
    )?.focus()
  }
  else {
    closeDialog()
  }
}, { immediate: true })

onBeforeUnmount(closeDialog)

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const controls = Array.from(dialog.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  ) ?? []).filter(element => element.getClientRects().length > 0)
  const first = controls[0]
  const last = controls.at(-1)
  if (!first || !last) {
    event.preventDefault()
    dialog.value?.focus()
  }
  else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
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
    <dialog
      ref="dialog"
      class="confirm-dialog__overlay admin-surface"
      :aria-labelledby="titleId"
      :aria-busy="busy || undefined"
      @keydown="onKeydown"
      @cancel.prevent="dismiss"
      @click.self="dismiss"
    >
      <div
        class="confirm-dialog admin-surface"
      >
        <h2 :id="titleId" class="confirm-dialog__title">{{ title }}</h2>
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
    </dialog>
  </Teleport>
</template>

<style scoped>
.confirm-dialog__overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  border: 0;
  background: transparent;
  overflow-y: auto;
  align-items: safe center;
  justify-content: center;
  padding: var(--admin-space-4);
  z-index: 60;
}

.confirm-dialog__overlay[open] {
  display: flex;
}

.confirm-dialog__overlay::backdrop {
  background: var(--admin-overlay);
}

.confirm-dialog {
  background: var(--admin-bg-primary);
  border-radius: var(--admin-radius-lg);
  box-shadow: var(--admin-shadow-modal);
  max-width: 26rem;
  width: 100%;
  flex-shrink: 0;
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

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  confirmLabel?: string
}>(), {
  title: '放弃未保存的修改？',
  description: '有未保存的更改或正在进行的上传。离开后，这些修改可能丢失。',
  confirmLabel: '放弃修改并离开',
})

const open = shallowRef(false)
const returnFocusTo = shallowRef<HTMLElement | null>(null)
let resolveDecision: ((confirmed: boolean) => void) | null = null

function request(): Promise<boolean> {
  if (resolveDecision || document.querySelector('dialog[open]')) return Promise.resolve(false)
  returnFocusTo.value = document.activeElement as HTMLElement | null
  open.value = true
  return new Promise(resolve => { resolveDecision = resolve })
}

async function settle(confirmed: boolean) {
  const resolve = resolveDecision
  resolveDecision = null
  open.value = false
  // Release the modal focus trap before the router or language switch continues.
  await nextTick()
  resolve?.(confirmed)
}

onBeforeUnmount(() => {
  resolveDecision?.(false)
  resolveDecision = null
})
defineExpose({ request })
</script>

<template>
  <AdminConfirmDialog
    :open="open" :return-focus-to="returnFocusTo" :title="title"
    :confirm-label="confirmLabel" cancel-label="继续编辑" tone="danger"
    @confirm="settle(true)" @cancel="settle(false)"
  >
    <p>{{ description }}</p>
  </AdminConfirmDialog>
</template>

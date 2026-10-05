<script setup lang="ts" generic="T extends string | number">
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  id?: string
  options: readonly { value: T, label: string, disabled?: boolean }[]
  disabled?: boolean
  required?: boolean
  name?: string
}>()
const model = defineModel<T>({ required: true })
const emit = defineEmits<{ change: [value: T] }>()
const generatedId = useId()
const controlId = computed(() => props.id ?? generatedId)
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const panel = useTemplateRef<HTMLDivElement>('panel')
const enhanced = shallowRef(false)
const open = shallowRef(false)
const active = shallowRef(-1)
const selected = computed(() => props.options.find(option => option.value === model.value))
const position = shallowRef<Record<string, string>>({})
let search = ''
let searchAt = 0

function place() {
  if (!trigger.value || !panel.value) return
  const rect = trigger.value.getBoundingClientRect()
  const gap = 6
  const below = window.innerHeight - rect.bottom - gap - 8
  const above = rect.top - gap - 8
  const upwards = below < Math.min(panel.value.scrollHeight, 280) && above > below
  const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16)
  position.value = {
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`,
    width: `${width}px`,
    maxHeight: `${Math.max(0, Math.min(280, upwards ? above : below))}px`,
    top: upwards ? 'auto' : `${rect.bottom + gap}px`,
    bottom: upwards ? `${window.innerHeight - rect.top + gap}px` : 'auto',
  }
}

function close() {
  panel.value?.hidePopover()
  open.value = false
}

function show() {
  if (props.disabled || !panel.value) return
  active.value = props.options.findIndex(option => option.value === model.value && !option.disabled)
  if (active.value < 0) active.value = props.options.findIndex(option => !option.disabled)
  panel.value.showPopover()
  open.value = true
  place()
  revealActive()
}

function revealActive() {
  nextTick(() => panel.value?.querySelector<HTMLElement>(`[data-index="${active.value}"]`)?.scrollIntoView({ block: 'nearest' }))
}

function choose(index: number) {
  const option = props.options[index]
  if (props.disabled || !option || option.disabled) return
  if (model.value !== option.value) {
    model.value = option.value
    emit('change', option.value)
  }
  close()
  trigger.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  if (event.key === 'Tab' || event.key === 'Escape') {
    if (open.value) {
      close()
      if (event.key === 'Escape') event.preventDefault()
    }
    return
  }
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault()
    if (open.value) choose(active.value)
    else show()
    return
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    if (!open.value) { show(); return }
    const enabled = props.options.flatMap((option, index) => option.disabled ? [] : [index])
    const index = enabled.indexOf(active.value)
    active.value = (event.key === 'Home' ? enabled[0]
      : event.key === 'End' ? enabled.at(-1)
        : enabled[Math.max(0, Math.min(enabled.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]) ?? -1
    revealActive()
    return
  }
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    if (!open.value) show()
    search = (Date.now() - searchAt > 700 ? '' : search) + event.key.toLocaleLowerCase()
    searchAt = Date.now()
    const index = props.options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(search))
    if (index >= 0) { active.value = index; revealActive() }
  }
}

function onScroll(event: Event) {
  if (open.value && !panel.value?.contains(event.target as Node)) place()
}

watch(() => props.disabled, disabled => { if (disabled && open.value) close() })
watch(open, value => { if (!value) search = '' })
onMounted(() => {
  enhanced.value = typeof HTMLElement.prototype.showPopover === 'function'
  window.addEventListener('resize', place)
  window.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <div class="admin-select">
    <!-- Retain native form validation and a usable fallback before hydration / without Popover. -->
    <select
      :id="enhanced ? undefined : controlId"
      v-model="model"
      v-bind="enhanced ? {} : $attrs"
      :class="enhanced ? 'admin-select__native' : 'admin-select__trigger'"
      :name="name"
      :required="required"
      :disabled="disabled"
      :tabindex="enhanced ? -1 : undefined"
      :aria-hidden="enhanced || undefined"
      @invalid="enhanced && ($event.preventDefault(), trigger?.focus())"
      @change="emit('change', model)"
    >
      <option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">{{ option.label }}</option>
    </select>
    <button
      v-if="enhanced"
      :id="controlId"
      ref="trigger"
      v-bind="$attrs"
      type="button"
      role="combobox"
      class="admin-select__trigger"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-controls="`${controlId}-options`"
      :aria-activedescendant="open && active >= 0 ? `${controlId}-option-${active}` : undefined"
      :aria-required="required || undefined"
      aria-haspopup="listbox"
      @click="open ? close() : show()"
      @keydown="onKeydown"
      @blur="close"
    >
      <span>{{ selected?.label }}</span>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <div
      v-show="enhanced"
      :id="`${controlId}-options`"
      ref="panel"
      popover="auto"
      role="listbox"
      :aria-labelledby="controlId"
      class="admin-select__panel"
      :style="position"
      @toggle="open = ($event as ToggleEvent).newState === 'open'"
      @pointerdown.prevent
    >
      <div
        v-for="(option, index) in options"
        :id="`${controlId}-option-${index}`"
        :key="option.value"
        role="option"
        class="admin-select__option"
        :class="{ 'admin-select__option--active': active === index }"
        :aria-selected="option.value === model"
        :aria-disabled="option.disabled || undefined"
        :data-index="index"
        @click="choose(index)"
      >
        <span>{{ option.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-select { position: relative; min-width: 0; }
.admin-select__native { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.admin-select__trigger { display: flex; align-items: center; justify-content: space-between; gap: var(--admin-space-3); width: 100%; min-height: var(--admin-touch-target); padding: var(--admin-space-2) var(--admin-space-3); border: 1px solid var(--admin-border-primary); border-radius: var(--radius-ui); color: var(--admin-text-primary); background: var(--admin-bg-primary); font: inherit; font-size: var(--admin-font-sm); text-align: start; cursor: pointer; }
.admin-select__trigger span { overflow-wrap: anywhere; }
.admin-select__trigger svg { flex-shrink: 0; }
.admin-select__trigger:focus-visible { outline: 3px solid var(--admin-focus-ring); outline-offset: 2px; }
.admin-select__trigger[aria-expanded='true'] { border-color: var(--admin-border-focus); }
.admin-select__trigger:disabled { color: var(--admin-text-secondary); background: var(--admin-bg-subtle); cursor: default; }
.admin-select__trigger[aria-invalid='true'] { border-color: var(--admin-status-error); }
.admin-select__panel { position: fixed; inset: auto; margin: 0; padding: var(--admin-space-1); overflow-y: auto; overscroll-behavior: contain; border: 1px solid var(--admin-border-primary); border-radius: var(--radius-ui); background: var(--admin-bg-primary); color: var(--admin-text-primary); box-shadow: var(--admin-shadow-popover); font-family: var(--font-admin-ui); font-size: var(--admin-font-sm); }
.admin-select__panel:not(:popover-open) { display: none; }
.admin-select__option { display: flex; align-items: center; justify-content: space-between; gap: var(--admin-space-3); min-height: var(--admin-touch-target); padding: var(--admin-space-2) var(--admin-space-3); border-radius: var(--radius-ui); cursor: pointer; overflow-wrap: anywhere; }
.admin-select__option + .admin-select__option { margin-top: var(--admin-space-1); }
.admin-select__option[aria-selected='true'] { background: var(--ui-bg-selected); color: var(--admin-accent-primary); font-weight: 600; }
.admin-select__option--active { outline: 1px solid var(--admin-border-focus); outline-offset: -1px; }
.admin-select__option[aria-disabled='true'] { color: var(--admin-text-secondary); cursor: default; }
@media (hover: hover) {
  .admin-select__trigger:hover:not(:disabled) { border-color: var(--admin-accent-primary); }
  .admin-select__option:hover:not([aria-disabled='true']):not([aria-selected='true']) { background: var(--ui-bg-hover); }
}
@media (forced-colors: active) {
  .admin-select__option--active { outline-color: Highlight; }
}
</style>

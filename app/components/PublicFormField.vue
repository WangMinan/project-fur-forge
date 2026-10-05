<script setup lang="ts">
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  id: string
  label: string
  error?: string
  prefix?: string
  suffix?: string
  required?: boolean
  type?: 'text' | 'number' | 'tel' | 'email' | 'password' | 'search'
}>(), { error: '', prefix: '', suffix: '', required: false, type: 'text' })
// Preserve editable text (including an empty number); the form owns domain parsing and validation.
const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="public-field">
    <label :for="id" class="public-field__label">
      {{ label }}<span v-if="suffix" class="public-field__unit-label">（{{ suffix }}）</span>
      <span v-if="required" aria-hidden="true"> *</span>
    </label>
    <div class="public-field__control" :data-invalid="Boolean(error)">
      <span v-if="prefix" class="public-field__prefix" aria-hidden="true">{{ prefix }}</span>
      <input
        :id="id"
        v-bind="$attrs"
        class="public-field__input"
        :type="type"
        :value="model"
        :required="required"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? `${id}-error` : undefined"
        @input="model = ($event.target as HTMLInputElement).value"
      >
      <span v-if="suffix" class="public-field__suffix" aria-hidden="true">{{ suffix }}</span>
    </div>
    <p v-if="error" :id="`${id}-error`" class="public-field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.public-field { display: grid; align-content: start; align-self: start; gap: var(--space-2); min-width: 0; }
.public-field__label { color: var(--public-text-secondary); font-size: var(--font-size-sm); font-weight: 600; }
.public-field__control { display: flex; align-items: center; min-width: 0; min-height: 2.75rem; border: 1px solid var(--public-border-primary); border-radius: var(--radius-ui); background: var(--public-bg-primary); }
.public-field__input { flex: 1; width: 100%; min-width: 0; min-height: calc(2.75rem - 2px); padding: 0 var(--space-3); border: 0; outline: none; background: transparent; color: var(--public-text-primary); font: inherit; }
.public-field__input:focus-visible { outline: none; }
.public-field__control:focus-within { border-color: var(--public-border-focus); outline: 2px solid var(--public-focus-ring); outline-offset: 1px; }
.public-field__control[data-invalid='true'] { border-color: var(--public-status-error); }
.public-field__control:has(input:disabled) { background: var(--public-bg-secondary); }
.public-field__input:disabled { color: var(--public-text-secondary); cursor: default; }
.public-field__prefix { padding-left: var(--space-3); color: var(--public-text-secondary); }
.public-field__suffix { padding-right: var(--space-3); color: var(--public-text-tertiary); font-family: var(--font-role-ui); font-size: var(--font-size-xs); }
.public-field__error { margin: 0; color: var(--public-status-error); font-size: var(--font-size-sm); line-height: var(--line-height-normal); overflow-wrap: anywhere; }
.public-field__unit-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>

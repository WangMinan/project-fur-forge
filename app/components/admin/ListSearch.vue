<script setup lang="ts">
defineProps<{ id: string, label: string, placeholder: string }>()
const query = defineModel<string>({ required: true })
const input = useTemplateRef<HTMLInputElement>('input')
defineExpose({ focus: () => input.value?.focus() })

function search(event: FocusEvent) {
  query.value = (event.target as HTMLInputElement).value.trim()
}
</script>

<template>
  <div class="admin-list-toolbar__field" role="search" :aria-label="label">
    <label class="admin-list-toolbar__label" :for="id">{{ label }}</label>
    <input
      :id="id"
      ref="input"
      :value="query"
      class="admin-list-toolbar__control"
      type="search"
      :placeholder="placeholder"
      autocomplete="off"
      @blur="search"
      @keydown.enter.prevent="input?.blur()"
    >
  </div>
</template>

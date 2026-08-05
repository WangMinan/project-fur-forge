<script setup lang="ts">
/** T34-F3 分区 Card 的纯文本字段：统一标签、字数上限、字段级校验提示。 */
const props = defineProps<{
  field: string
  hint?: string
  issue?: string | undefined
  label: string
  max: number
  modelValue: string
  rows?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const length = computed(() => props.modelValue.trim().length)
</script>

<template>
  <div class="site-field">
    <label class="site-field__label" :for="`site-field-${field}`">
      {{ label }}
    </label>
    <p v-if="hint" class="site-field__hint">{{ hint }}</p>
    <textarea
      :id="`site-field-${field}`"
      class="site-field__input"
      :class="{ 'site-field__input--invalid': Boolean(issue) }"
      :value="modelValue"
      :rows="rows ?? 3"
      :aria-invalid="Boolean(issue)"
      :aria-describedby="issue ? `site-field-${field}-issue` : undefined"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <p class="site-field__meta">
      <span :class="{ 'site-field__count--over': length > max }">
        {{ length }} / {{ max }}
      </span>
      <span
        v-if="issue"
        :id="`site-field-${field}-issue`"
        class="site-field__issue"
        role="alert"
      >{{ issue }}</span>
    </p>
  </div>
</template>

<style scoped>
.site-field {
  display: grid;
  gap: var(--admin-space-1);
}

.site-field__label {
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.site-field__hint,
.site-field__meta {
  margin: 0;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
}

.site-field__meta {
  display: flex;
  gap: var(--admin-space-3);
}

.site-field__input {
  width: 100%;
  padding: var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
  resize: vertical;
}

.site-field__input--invalid {
  border-color: var(--admin-border-danger, #b3261e);
}

.site-field__count--over,
.site-field__issue {
  color: var(--admin-text-danger, #b3261e);
}
</style>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  accept?: string
  disabled?: boolean
  error?: string | null
  fileName?: string | null
  hint: string
  inputId: string
  label: string
  previewAlt?: string
  previewUrl?: string | null
  removable?: boolean
  theme?: 'admin' | 'public'
}>(), {
  accept: 'image/jpeg,image/png,image/webp',
  disabled: false,
  error: null,
  fileName: null,
  previewAlt: '所选图片预览',
  previewUrl: null,
  removable: true,
  theme: 'public',
})

const emit = defineEmits<{
  remove: []
  select: [file: File]
}>()

const input = useTemplateRef<HTMLInputElement>('input')
const dragging = ref(false)
const hintId = computed(() => `${props.inputId}-hint`)
const errorId = computed(() => `${props.inputId}-error`)
const describedBy = computed(() => props.error ? `${hintId.value} ${errorId.value}` : hintId.value)

function choose() {
  if (props.disabled || !input.value) {
    return
  }
  // 允许用户连续选择同一个文件，也能重新触发 change。
  input.value.value = ''
  input.value.click()
}

function selectFirst(files: FileList | null) {
  const selected = files?.[0]
  if (!props.disabled && selected) {
    emit('select', selected)
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  selectFirst(event.dataTransfer?.files ?? null)
}
</script>

<template>
  <div class="image-dropzone" :data-theme="theme">
    <p class="image-dropzone__label">
      {{ label }} <span aria-hidden="true">*</span>
    </p>
    <input
      :id="inputId"
      ref="input"
      class="image-dropzone__input"
      type="file"
      :accept="accept"
      :disabled="disabled"
      :aria-label="label"
      :aria-invalid="Boolean(error)"
      :aria-describedby="describedBy"
      @change="selectFirst(($event.target as HTMLInputElement).files)"
    >

    <div
      class="image-dropzone__card"
      :class="{
        'image-dropzone__card--dragging': dragging,
        'image-dropzone__card--preview': previewUrl,
      }"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave.self="dragging = false"
      @drop.prevent="onDrop"
    >
      <template v-if="previewUrl">
        <img
          class="image-dropzone__preview"
          :src="previewUrl"
          :alt="previewAlt"
        >
        <div class="image-dropzone__preview-meta">
          <span class="image-dropzone__filename">{{ fileName || '已选择图片' }}</span>
          <div class="image-dropzone__actions">
            <button type="button" :disabled="disabled" @click="choose">更换图片</button>
            <button v-if="removable" type="button" :disabled="disabled" @click="emit('remove')">移除</button>
          </div>
        </div>
      </template>
      <button
        v-else
        type="button"
        class="image-dropzone__picker"
        :disabled="disabled"
        @click="choose"
      >
        <svg width="42" height="42" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 32V8m0 0-9 9m9-9 9 9M10 29v7a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4v-7" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>点击或拖拽上传设定图</span>
        <small>仅上传一张图片</small>
      </button>
    </div>

    <p :id="hintId" class="image-dropzone__hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="image-dropzone__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.image-dropzone {
  --dropzone-accent: var(--public-accent-primary);
  --dropzone-bg: var(--public-bg-secondary);
  --dropzone-border: var(--public-accent-tint);
  --dropzone-error: var(--public-status-error);
  --dropzone-text: var(--public-text-primary);
  --dropzone-muted: var(--public-text-secondary);
  display: grid;
  gap: 0.75rem;
}

.image-dropzone[data-theme='admin'] {
  --dropzone-accent: var(--admin-accent-primary);
  --dropzone-bg: var(--admin-bg-subtle);
  --dropzone-border: color-mix(in srgb, var(--admin-accent-primary) 34%, var(--admin-border-primary));
  --dropzone-error: var(--admin-danger);
  --dropzone-text: var(--admin-text-primary);
  --dropzone-muted: var(--admin-text-secondary);
}

.image-dropzone__label {
  margin: 0;
  color: var(--dropzone-text);
  font-weight: 600;
}

.image-dropzone__input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.image-dropzone__card {
  min-height: clamp(12rem, 26vw, 17rem);
  overflow: hidden;
  color: var(--dropzone-text);
  background: var(--dropzone-bg);
  border: 2px dashed var(--dropzone-border);
  border-radius: var(--radius-sm);
  transition: border-color 150ms ease, background-color 150ms ease;
}

.image-dropzone__card--dragging {
  background: color-mix(in srgb, var(--dropzone-accent) 8%, var(--dropzone-bg));
  border-color: var(--dropzone-accent);
}

.image-dropzone__card--preview {
  display: grid;
  min-height: 0;
  background: var(--dropzone-bg);
  border-style: solid;
}

.image-dropzone__picker {
  display: grid;
  width: 100%;
  min-height: inherit;
  padding: 2rem;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
  place-content: center;
  place-items: center;
  gap: 0.75rem;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 600;
}

.image-dropzone__picker svg {
  color: color-mix(in srgb, var(--dropzone-accent) 48%, var(--dropzone-muted));
}

.image-dropzone__picker small {
  color: var(--dropzone-muted);
  font-size: 0.85rem;
  font-weight: 400;
}

.image-dropzone__picker:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--dropzone-accent) 30%, transparent);
  outline-offset: -5px;
}

.image-dropzone__preview {
  width: 100%;
  max-height: 34rem;
  object-fit: contain;
  background: var(--dropzone-bg);
}

.image-dropzone__preview-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: color-mix(in srgb, var(--dropzone-bg) 88%, white);
}

.image-dropzone__filename {
  min-width: 0;
  color: var(--dropzone-muted);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.image-dropzone__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.image-dropzone__actions button {
  min-height: 2.75rem;
  padding: 0 0.9rem;
  color: var(--dropzone-text);
  background: transparent;
  border: 1px solid var(--dropzone-border);
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}

.image-dropzone button:disabled {
  cursor: default;
  opacity: 0.55;
}

.image-dropzone__hint,
.image-dropzone__error {
  margin: 0;
  color: var(--dropzone-muted);
  font-size: 0.875rem;
  line-height: 1.6;
}

.image-dropzone__error {
  color: var(--dropzone-error);
}

.image-dropzone[data-theme='public'] .image-dropzone__card {
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-image);
}

.image-dropzone[data-theme='public'] .image-dropzone__card--dragging {
  border-color: var(--dropzone-accent);
}

.image-dropzone[data-theme='public'] .image-dropzone__card--preview {
  border-color: var(--public-border-secondary);
  border-radius: var(--radius-image);
}

.image-dropzone[data-theme='public'] .image-dropzone__picker {
  padding: var(--space-6);
  gap: var(--space-3);
}

.image-dropzone[data-theme='public'] .image-dropzone__preview-meta {
  padding: var(--space-3) var(--space-4);
}

.image-dropzone[data-theme='public'] .image-dropzone__actions button {
  border: 0;
  border-bottom: 1px solid currentColor;
  border-radius: 0;
  padding-inline: 0.15rem;
}

@media (max-width: 480px) {
  .image-dropzone__card {
    min-height: 12rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-dropzone__card {
    transition: none;
  }
}
</style>

<script setup lang="ts">
// 水印参数：不透明度 10–90（默认 50）、缩放 20–90（默认 60）、位置固定居中。
// 不提供关闭开关与四角位置；数字输入与滑块双向同步；
// 服务端/本地校验错误通过 aria-describedby 与控件程序化关联。
defineProps<{
  disabled: boolean
  dirty: boolean
  opacityPercent: number
  scalePercent: number
}>()

const emit = defineEmits<{
  validity: [value: boolean]
  'update:opacityPercent': [value: number]
  'update:scalePercent': [value: number]
}>()

const OPACITY_MIN = 10
const OPACITY_MAX = 90
const SCALE_MIN = 20
const SCALE_MAX = 90

const localError = ref<string | null>(null)

watch(localError, value => emit('validity', value === null), { immediate: true })

function inRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max
}

function onNumberInput(kind: 'opacity' | 'scale', event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  const [min, max, label] = kind === 'opacity'
    ? [OPACITY_MIN, OPACITY_MAX, '不透明度']
    : [SCALE_MIN, SCALE_MAX, '缩放']
  if (!inRange(value, min, max)) {
    localError.value = `${label}需为 ${min}–${max} 的整数。`
    return
  }
  localError.value = null
  if (kind === 'opacity') {
    emit('update:opacityPercent', value)
  }
  else {
    emit('update:scalePercent', value)
  }
}

function onRangeInput(kind: 'opacity' | 'scale', event: Event) {
  localError.value = null
  const value = Number((event.target as HTMLInputElement).value)
  if (kind === 'opacity') {
    emit('update:opacityPercent', value)
  }
  else {
    emit('update:scalePercent', value)
  }
}

const visibleError = computed(() => localError.value)
</script>

<template>
  <section class="editor-card branding-params" aria-labelledby="branding-params-title">
    <div class="editor-card__head">
      <h2 id="branding-params-title" class="editor-card__title">水印参数</h2>
      <p class="editor-card__hint">确认刷新时与 Logo 一起保存</p>
    </div>

    <div class="branding-params__field">
      <label class="branding-params__label" for="watermark-opacity-range">
        不透明度 {{ opacityPercent }}%
      </label>
      <div class="branding-params__controls">
        <input
          id="watermark-opacity-range"
          type="range"
          :min="OPACITY_MIN"
          :max="OPACITY_MAX"
          step="1"
          :value="opacityPercent"
          :disabled="disabled"
          aria-describedby="watermark-params-error watermark-opacity-hint"
          @input="onRangeInput('opacity', $event)"
        >
        <input
          type="number"
          class="branding-params__number"
          aria-label="不透明度数值（10 到 90）"
          :min="OPACITY_MIN"
          :max="OPACITY_MAX"
          step="1"
          :value="opacityPercent"
          :disabled="disabled"
          :aria-invalid="visibleError ? true : undefined"
          aria-describedby="watermark-params-error"
          @change="onNumberInput('opacity', $event)"
        >
      </div>
      <p id="watermark-opacity-hint" class="branding-params__hint">
        10–90，默认 50；数值越高水印越明显
      </p>
    </div>

    <div class="branding-params__field">
      <label class="branding-params__label" for="watermark-scale-range">
        缩放 {{ scalePercent }}%
      </label>
      <div class="branding-params__controls">
        <input
          id="watermark-scale-range"
          type="range"
          :min="SCALE_MIN"
          :max="SCALE_MAX"
          step="1"
          :value="scalePercent"
          :disabled="disabled"
          aria-describedby="watermark-params-error watermark-scale-hint"
          @input="onRangeInput('scale', $event)"
        >
        <input
          type="number"
          class="branding-params__number"
          aria-label="缩放数值（20 到 90）"
          :min="SCALE_MIN"
          :max="SCALE_MAX"
          step="1"
          :value="scalePercent"
          :disabled="disabled"
          :aria-invalid="visibleError ? true : undefined"
          aria-describedby="watermark-params-error"
          @change="onNumberInput('scale', $event)"
        >
      </div>
      <p id="watermark-scale-hint" class="branding-params__hint">
        20–90，默认 60；相对于目标图宽度的百分比
      </p>
    </div>

    <div class="branding-params__field">
      <span id="watermark-position-label" class="branding-params__label">位置</span>
      <p class="branding-params__position" aria-labelledby="watermark-position-label">
        居中（固定）
      </p>
      <p class="branding-params__hint">
        水印始终居中且不可关闭，以保护作品图。
      </p>
    </div>

    <p
      v-if="visibleError"
      id="watermark-params-error"
      class="branding-params__error"
      role="alert"
    >
      {{ visibleError }}
    </p>

    <p v-if="dirty" class="branding-params__dirty" role="status">
      当前设置尚未保存并刷新
    </p>
  </section>
</template>

<style scoped>
.branding-params {
  display: grid;
  gap: var(--admin-space-4);
  align-content: start;
}

.branding-params__field {
  display: grid;
  gap: var(--admin-space-1);
}

.branding-params__label {
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.branding-params__controls {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
}

.branding-params__controls input[type='range'] {
  flex: 1;
  min-height: var(--admin-touch-target);
  accent-color: var(--admin-accent-primary);
}

.branding-params__number {
  width: 5.5rem;
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  font: inherit;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
}

.branding-params__hint {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.branding-params__position {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-primary);
  font-weight: 600;
}

.branding-params__error {
  margin: 0;
  padding: var(--admin-space-2) var(--admin-space-3);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
}

.branding-params__dirty {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-warning);
  font-weight: 600;
}
</style>

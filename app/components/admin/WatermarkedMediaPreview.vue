<script setup lang="ts">
const props = defineProps<{
  assetId: string
  usage: 'design-sheet' | 'detail' | 'work-card'
}>()

const src = shallowRef<string | null>(null)
const state = shallowRef<'error' | 'idle' | 'loading' | 'ready'>('idle')

function generate() {
  state.value = 'loading'
  src.value = `/api/admin/v1/media/assets/${props.assetId}/watermarked-preview?usage=${props.usage}&v=${Date.now()}`
}

watch(() => [props.assetId, props.usage], () => {
  src.value = null
  state.value = 'idle'
})
</script>

<template>
  <section class="watermarked-preview" data-testid="watermarked-media-preview">
    <div class="watermarked-preview__head">
      <p class="watermarked-preview__title">公开水印预览</p>
      <button
        type="button"
        class="watermarked-preview__button"
        :disabled="state === 'loading'"
        @click="generate"
      >{{ state === 'loading' ? '生成中…' : src ? '重新生成' : '生成预览' }}</button>
    </div>
    <p class="watermarked-preview__note">
      使用当前站点水印，位置固定居中；与上方编辑预览互不影响。
    </p>
    <p v-if="state === 'loading'" class="watermarked-preview__state" role="status">
      正在生成带水印的公开预览…
    </p>
    <p v-else-if="state === 'error'" class="watermarked-preview__error" role="alert">
      公开水印预览生成失败，请确认素材尺寸和活动水印后重试。
    </p>
    <img
      v-if="src"
      v-show="state === 'ready'"
      class="watermarked-preview__image"
      :src="src"
      alt="活动居中水印公开效果预览"
      referrerpolicy="same-origin"
      @load="state = 'ready'"
      @error="state = 'error'"
    >
  </section>
</template>

<style scoped>
.watermarked-preview {
  display: grid;
  gap: var(--admin-space-2);
  padding-top: var(--admin-space-2);
  border-top: 1px solid var(--admin-border-secondary);
}

.watermarked-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-2);
}

.watermarked-preview__title,
.watermarked-preview__note,
.watermarked-preview__state,
.watermarked-preview__error {
  margin: 0;
  font-size: var(--admin-font-xs);
}

.watermarked-preview__title {
  font-weight: 600;
}

.watermarked-preview__note,
.watermarked-preview__state {
  color: var(--admin-text-tertiary);
  line-height: var(--admin-line-normal);
}

.watermarked-preview__error {
  color: var(--admin-status-error);
}

.watermarked-preview__button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-accent-primary);
  font: inherit;
  font-size: var(--admin-font-xs);
  cursor: pointer;
}

.watermarked-preview__button:disabled {
  opacity: 0.55;
  cursor: default;
}

.watermarked-preview__image {
  width: 100%;
  max-height: 22rem;
  object-fit: contain;
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-subtle);
}
</style>

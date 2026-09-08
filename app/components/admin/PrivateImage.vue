<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const props = defineProps<{ src?: string | null, alt: string }>()
const emit = defineEmits<{ load: [event: Event] }>()
const { imageUrl, loading, failed, onLoad, onError, retry } = useAdminPrivateImage(() => props.src)
</script>

<template>
  <img
    v-if="!failed"
    v-bind="$attrs"
    :src="imageUrl"
    :alt="alt"
    :aria-busy="loading || undefined"
    referrerpolicy="no-referrer"
    @load="onLoad(); emit('load', $event)"
    @error="onError"
  >
  <button
    v-else
    v-bind="$attrs"
    type="button"
    class="private-image-retry"
    :aria-label="`${alt}：重新加载`"
    @click.stop.prevent="retry"
  >
    图片加载失败，重新加载
  </button>
</template>

<style scoped>
.private-image-retry {
  position: relative;
  z-index: 4;
  min-width: 44px;
  min-height: 44px;
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  padding: 0.5rem;
  background: var(--admin-bg-subtle);
  color: var(--admin-text-secondary);
  font: inherit;
  cursor: pointer;
}
.private-image-retry:focus-visible {
  outline: 2px solid var(--admin-border-focus);
  outline-offset: 2px;
}
</style>

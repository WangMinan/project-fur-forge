<script setup lang="ts">
/**
 * 返图缩略图。
 *
 * 来源是受控管理预览（认证管理 Host + no-store），不是公开 URL，
 * 也不暴露私有 Object Key：浏览器只拿到 assetId。
 * 使用 contain，不把竖图裁成方块。
 */
const props = withDefaults(defineProps<{
  assetId: string | null
  name: string
  /** 服务端缩放宽度：列表格子只有几十像素，不需要原图。 */
  width?: number
}>(), {
  width: 96,
})

const failed = ref(false)

const previewSrc = computed(() => (
  props.assetId
    ? `/api/admin/v1/media/assets/${props.assetId}/preview?w=${props.width}`
    : null
))

watch(previewSrc, () => {
  failed.value = false
})
</script>

<template>
  <span class="return-thumb">
    <img
      v-if="previewSrc && !failed"
      class="return-thumb__image"
      :src="previewSrc"
      :alt="`${name}的返图缩略图`"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    >
    <span v-else class="return-thumb__empty">
      {{ previewSrc ? '预览失败' : '无图' }}
    </span>
  </span>
</template>

<style scoped>
.return-thumb {
  /* 与作品管理表格一致的固定小格子：竖图不会把行拉高。 */
  flex: none;
  display: grid;
  place-items: center;
  width: 3rem;
  aspect-ratio: 1;
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-subtle);
  overflow: hidden;
}

.return-thumb__image {
  width: 100%;
  height: 100%;
  /* 保持原比例：返图有大量竖图与极端长图。 */
  object-fit: contain;
}

.return-thumb__empty {
  padding: var(--admin-space-1);
  color: var(--admin-text-tertiary);
  font-size: 0.625rem;
  text-align: center;
}
</style>

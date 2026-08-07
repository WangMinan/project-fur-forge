<script setup lang="ts">
import type { AdminReturnPhotoDto } from '~~/shared/types/contracts'

/**
 * 返图列表缩略图。
 *
 * 来源是受控管理预览（认证管理 Host + no-store），不是公开 URL，
 * 也不暴露私有 Object Key：浏览器只拿到 assetId。
 * 使用 contain，不把竖图裁成方块。
 */
const props = defineProps<{
  item: AdminReturnPhotoDto
}>()

const failed = ref(false)

/**
 * 请求服务端缩放后的低分辨率缩略图（96px 宽）。
 * 列表里几十像素的格子不需要多 MB 原图，这样能明显省下 OSS 流量。
 */
const previewSrc = computed(() => (
  props.item.asset
    ? `/api/admin/v1/media/assets/${props.item.asset.assetId}/preview?w=96`
    : null
))
</script>

<template>
  <span class="return-thumb">
    <img
      v-if="previewSrc && !failed"
      class="return-thumb__image"
      :src="previewSrc"
      :alt="`${item.work.characterName}的返图缩略图`"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    >
    <span v-else class="return-thumb__empty">
      {{ previewSrc ? '预览失败' : '未上传' }}
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

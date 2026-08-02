<script setup lang="ts">
import type { PublicWorkGalleryItemDto } from '~~/shared/types/contracts'

/**
 * 作品详情图集：主图 + 有序缩略图，只消费公开 detail 衍生图。
 * SSR 直接渲染第一张；切换仅替换主图，不自动播放、不引入覆盖层。
 */
const props = defineProps<{
  gallery: PublicWorkGalleryItemDto[]
  workName: string
}>()

const activeIndex = ref(0)
const activeItem = computed(() => props.gallery[activeIndex.value] ?? props.gallery[0])
</script>

<template>
  <div class="work-gallery" data-testid="work-gallery">
    <div class="work-gallery__stage">
      <ResponsivePicture
        v-if="activeItem"
        :key="activeItem.assetId"
        class="work-gallery__image"
        :sources="activeItem.sources"
        :alt="activeItem.alt"
        loading="eager"
        fetchpriority="high"
        sizes="(min-width: 1024px) 58vw, 100vw"
      />
    </div>

    <div
      v-if="gallery.length > 1"
      class="work-gallery__thumbs"
      role="group"
      :aria-label="`${workName}图集，共 ${gallery.length} 张`"
    >
      <button
        v-for="(media, index) in gallery"
        :key="media.assetId"
        type="button"
        class="work-gallery__thumb"
        :aria-pressed="index === activeIndex"
        :aria-label="`查看第 ${index + 1} 张，共 ${gallery.length} 张`"
        @click="activeIndex = index"
      >
        <ResponsivePicture
          :sources="media.sources"
          :alt="index === activeIndex ? media.alt : ''"
          sizes="96px"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.work-gallery__stage {
  background: var(--image-placeholder);
  overflow: hidden;
}

/*
 * PC 端限制主图高度：纵向作品图应在一屏内完整可见，
 * 宽度随原始纵横比自适应、水平居中，不做裁切。
 */
@media (min-width: 1024px) {
  .work-gallery__stage {
    display: flex;
    justify-content: center;
  }

  .work-gallery__stage :deep(.work-gallery__image) {
    width: auto;
    max-width: 100%;
  }

  .work-gallery__stage :deep(.responsive-picture__image) {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: clamp(20rem, calc(100vh - 15rem), 46rem);
    margin: 0 auto;
  }
}

.work-gallery__thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.work-gallery__thumb {
  width: 4.5rem;
  padding: 0;
  background: var(--image-placeholder);
  border: 2px solid transparent;
  border-radius: var(--radius-xs);
  cursor: pointer;
  overflow: hidden;
}

.work-gallery__thumb :deep(.responsive-picture) {
  aspect-ratio: 1;
  height: 100%;
}

.work-gallery__thumb :deep(.responsive-picture__image) {
  height: 100%;
  object-fit: cover;
}

.work-gallery__thumb:hover {
  border-color: var(--public-accent-decorative);
}

.work-gallery__thumb[aria-pressed='true'] {
  border-color: var(--public-accent-primary);
}

@media (min-width: 768px) {
  .work-gallery__thumb {
    width: 5.5rem;
  }
}
</style>

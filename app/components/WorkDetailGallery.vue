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

/**
 * T34-F2：同一组件复用到上一件/下一件作品时，必须把选中项校正回有效范围，
 * 否则第二张缩略图的索引会带到只有一张图的下一件作品上。
 */
const galleryIdentity = computed(() =>
  props.gallery.map(item => item.assetId).join('|'))

watch(galleryIdentity, () => {
  activeIndex.value = 0
})

watch(() => props.gallery.length, (length) => {
  if (activeIndex.value > length - 1) {
    activeIndex.value = length > 0 ? length - 1 : 0
  }
})

const activeItem = computed(() => props.gallery[activeIndex.value] ?? props.gallery[0])

/**
 * 方向由公开衍生图的固有 width/height 决定：
 * 横图使用宽舞台，竖图限宽并居中，占位背景只覆盖图片矩形附近。
 */
const activeOrientation = computed(() => {
  const image = activeItem.value?.sources.fallback.at(-1)
  if (!image) {
    return 'landscape'
  }
  return image.height > image.width ? 'portrait' : 'landscape'
})

const activeImageStyle = computed(() => {
  const image = activeItem.value?.sources.fallback.at(-1)
  const ratio = image ? image.width / image.height : 4 / 3
  return {
    '--gallery-aspect-ratio': String(ratio),
    aspectRatio: image ? `${image.width} / ${image.height}` : '4 / 3',
  }
})
</script>

<template>
  <div class="work-gallery" data-testid="work-gallery">
    <div
      class="work-gallery__stage"
      :class="`work-gallery__stage--${activeOrientation}`"
      :data-orientation="activeOrientation"
    >
      <ResponsivePicture
        v-if="activeItem"
        :key="activeItem.assetId"
        class="work-gallery__image"
        :sources="activeItem.sources"
        :alt="activeItem.alt"
        :style="activeImageStyle"
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
/*
 * 主图在自己那一列内居中，缩略图固定在右侧竖排：横图与竖图共用同一套规则，
 * 不再出现「横图靠左、竖图居中」的跳动。两种方向都用 contain，不裁掉作品。
 * 窄屏回落为单列，缩略图横排在主图下方。
 */
.work-gallery {
  display: flex;
  flex-wrap: wrap;
  /* 主图与缩略图作为一组整体居中：缩略图紧贴主图右侧，不被推到远处。 */
  justify-content: center;
  align-items: flex-start;
  gap: var(--space-3);
}

.work-gallery__stage {
  display: flex;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
}

/*
 * 高度上限决定实际尺寸：宽度 = 上限高度 × 图片自身比例。竖图因此不会顶穿一屏，
 * 横图也能用足可用宽度。占位背景只包裹图片矩形本身，不铺满整栏。
 */
.work-gallery__stage :deep(.work-gallery__image) {
  width: calc(clamp(20rem, calc(100vh - 15rem), 46rem) * var(--gallery-aspect-ratio));
  max-width: 100%;
  background: var(--image-placeholder);
  border-radius: var(--radius-image);
  overflow: hidden;
}

.work-gallery__stage :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.work-gallery__thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* 桌面：缩略图竖排在主图右侧。 */
@media (min-width: 768px) {
  .work-gallery {
    flex-wrap: nowrap;
    gap: var(--space-4);
  }

  .work-gallery__stage {
    flex: 0 1 auto;
  }

  .work-gallery__thumbs {
    flex: none;
    flex-direction: column;
    flex-wrap: nowrap;
  }
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

<script setup lang="ts">
import type { PublicWorkGalleryItemDto } from '~~/shared/types/contracts'

/**
 * 作品详情图集：主图 + 有序缩略图。横图使用宽舞台；竖图收窄到图片
 * 自身的视觉宽度，不用满栏灰色背景填充两侧。
 */
const props = defineProps<{
  gallery: PublicWorkGalleryItemDto[]
  workName: string
}>()

const activeIndex = ref(0)
const activeItem = computed(() => props.gallery[activeIndex.value] ?? props.gallery[0])
const activeFallback = computed(() => activeItem.value?.sources.fallback.at(-1))
const activeOrientation = computed(() => {
  const image = activeFallback.value
  if (!image) {
    return 'landscape'
  }
  return image.height > image.width ? 'portrait' : 'landscape'
})

watch(
  () => props.gallery.map(item => item.assetId).join(':'),
  () => {
    activeIndex.value = 0
  },
)
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
  display: flex;
  justify-content: center;
  overflow: hidden;
}

.work-gallery__stage--landscape {
  background: var(--image-placeholder);
}

.work-gallery__stage--portrait {
  width: fit-content;
  max-width: 100%;
  margin-inline: auto;
  background: transparent;
}

.work-gallery__stage :deep(.work-gallery__image) {
  width: auto;
  max-width: 100%;
}

.work-gallery__stage :deep(.responsive-picture__image) {
  width: auto;
  height: auto;
  max-width: 100%;
  margin: 0 auto;
  background: var(--image-placeholder);
}

.work-gallery__stage--portrait :deep(.responsive-picture__image) {
  max-height: min(78svh, 52rem);
}

@media (min-width: 1024px) {
  .work-gallery__stage :deep(.responsive-picture__image) {
    max-height: clamp(20rem, calc(100vh - 15rem), 46rem);
  }

  .work-gallery__stage--portrait {
    max-width: min(100%, 40rem);
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

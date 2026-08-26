<script setup lang="ts">
import type { PublicWorkGalleryItemDto } from '~~/shared/types/contracts'

/**
 * 作品详情图集：主图 + 有序缩略图，只消费公开 detail 衍生图。
 * SSR 直接渲染第一张；切换仅替换主图，不自动播放、不引入覆盖层。
 */
const props = defineProps<{
  gallery: PublicWorkGalleryItemDto[]
  initialAssetId?: string | undefined
  workName: string
}>()

function initialIndex() {
  const index = props.gallery.findIndex(item => item.assetId === props.initialAssetId)
  return index >= 0 ? index : 0
}

const activeIndex = shallowRef(initialIndex())
const isSingle = computed(() => props.gallery.length === 1)

/**
 * T34-F2：同一组件复用到上一件/下一件作品时，必须把选中项校正回有效范围，
 * 否则第二张缩略图的索引会带到只有一张图的下一件作品上。
 */
const galleryIdentity = computed(() =>
  props.gallery.map(item => item.assetId).join('|'))

watch(galleryIdentity, () => {
  activeIndex.value = initialIndex()
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
    aspectRatio: isSingle.value && image ? `${image.width} / ${image.height}` : 'auto',
  }
})
</script>

<template>
  <div
    class="work-gallery"
    :class="{ 'work-gallery--single': isSingle }"
    data-testid="work-gallery"
  >
    <div
      class="work-gallery__stage"
      :class="`work-gallery__stage--${activeOrientation}`"
      :data-orientation="activeOrientation"
    >
      <!--
        切换主图时做淡入淡出。out-in 会先等旧图移出再放新图，中间露出占位底色；
        默认的同时模式让两张图重叠交叉淡化，视觉上是一次连续过渡。
      -->
      <Transition name="work-gallery-fade">
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
      </Transition>
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
.work-gallery {
  display: grid;
  align-items: flex-start;
  gap: var(--space-3);
}

.work-gallery__stage {
  position: relative;
  width: 100%;
  height: clamp(18rem, 58svh, 34rem);
  min-width: 0;
  overflow: hidden;
  background: var(--public-media-canvas);
  border-radius: var(--radius-image);
}

.work-gallery__stage :deep(.work-gallery__image) {
  position: absolute;
  inset: 0;
}

.work-gallery-fade-enter-active,
.work-gallery-fade-leave-active {
  transition: opacity var(--motion-duration-state) var(--motion-ease-standard);
}

.work-gallery-fade-enter-from,
.work-gallery-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .work-gallery-fade-enter-active,
  .work-gallery-fade-leave-active {
    transition: none;
  }
}

.work-gallery__stage :deep(.work-gallery__image) {
  width: 100%;
  height: 100%;
}

.work-gallery__stage :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: var(--radius-image);
}

.work-gallery--single .work-gallery__stage {
  position: static;
  display: grid;
  place-items: center;
  height: auto;
  overflow: visible;
  background: transparent;
}

.work-gallery--single .work-gallery__stage :deep(.work-gallery__image) {
  position: static;
  inset: auto;
  width: min(
    100%,
    calc(clamp(20rem, calc(100vh - 15rem), 46rem) * var(--gallery-aspect-ratio))
  );
  height: auto;
  overflow: hidden;
  background: var(--image-placeholder);
  border-radius: var(--radius-image);
}

.work-gallery__thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

@media (max-width: 767px) {
  .work-gallery__stage {
    height: clamp(17rem, 92vw, 24rem);
  }

  .work-gallery__thumbs {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: thin;
  }

}

@media (min-width: 768px) {
  .work-gallery {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-4);
  }

  .work-gallery__stage {
    height: clamp(24rem, calc(100svh - 20rem), 38rem);
  }

  .work-gallery--single {
    grid-template-columns: minmax(0, 1fr);
  }

  .work-gallery__thumbs {
    flex-direction: column;
    flex-wrap: nowrap;
  }
}

.work-gallery__thumb {
  width: 4.5rem;
  min-height: 4.5rem;
  aspect-ratio: 1;
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

.work-gallery__thumb:focus-visible {
  outline: 3px solid var(--public-focus-ring);
  outline-offset: 3px;
}

.work-gallery__thumb:active {
  border-color: var(--public-accent-active);
}

.work-gallery__thumb[aria-pressed='true'] {
  border-color: var(--public-accent-primary);
}

@media (max-width: 767px) {
  .work-gallery__thumb {
    flex: 0 0 clamp(3.5rem, 16vw, 4.5rem);
    width: clamp(3.5rem, 16vw, 4.5rem);
  }
}

@media (min-width: 768px) {
  .work-gallery__thumb {
    width: 5.5rem;
    min-height: 5.5rem;
  }
}
</style>

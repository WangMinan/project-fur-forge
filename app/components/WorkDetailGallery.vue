<script setup lang="ts">
import type { FixtureMedia } from '~~/shared/fixtures/visual-home'

/**
 * 作品详情图集：主图 + 有序缩略图。
 * SSR 直接渲染第一张；切换仅替换主图，不自动播放、不引入覆盖层。
 */
const props = defineProps<{
  gallery: FixtureMedia[]
  workName: string
}>()

const activeIndex = ref(0)
const activeMedia = computed(() => props.gallery[activeIndex.value] ?? props.gallery[0])
</script>

<template>
  <div class="work-gallery" data-testid="work-gallery">
    <div class="work-gallery__stage">
      <ResponsiveAsset
        v-if="activeMedia"
        :key="activeMedia.src"
        class="work-gallery__image"
        :src="activeMedia.src"
        :alt="activeMedia.alt"
        :width="activeMedia.width"
        :height="activeMedia.height"
        :focal-desktop="activeMedia.focal.desktop"
        :focal-mobile="activeMedia.focal.mobile"
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
        :key="media.src"
        type="button"
        class="work-gallery__thumb"
        :aria-pressed="index === activeIndex"
        :aria-label="`查看第 ${index + 1} 张，共 ${gallery.length} 张`"
        @click="activeIndex = index"
      >
        <ResponsiveAsset
          :src="media.src"
          :alt="index === activeIndex ? media.alt : ''"
          :width="media.width"
          :height="media.height"
          :focal-desktop="media.focal.desktop"
          :focal-mobile="media.focal.mobile"
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

.work-gallery__image {
  width: 100%;
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

  .work-gallery__image {
    width: auto;
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

.work-gallery__thumb :deep(.responsive-asset) {
  aspect-ratio: 1;
  height: 100%;
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

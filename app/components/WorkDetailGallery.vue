<script setup lang="ts">
import type { PublicWorkGalleryItemDto } from '~~/shared/types/contracts'

/**
 * 作品详情图集：主图 + 有序缩略图，只消费公开 detail 衍生图。
 * SSR 直接渲染第一张；切换仅替换主图，不自动播放、不引入覆盖层。
 */
const props = defineProps<{
  gallery: PublicWorkGalleryItemDto[]
  viewTransitionName?: string | undefined
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
    viewTransitionName: props.viewTransitionName,
  }
})

/** 舞台比例跟随当前图片，写在舞台上让高度变化可过渡。 */
const stageStyle = computed(() => ({
  '--stage-aspect-ratio': activeImageStyle.value['--gallery-aspect-ratio'],
}))
</script>

<template>
  <div class="work-gallery" data-testid="work-gallery">
    <div
      class="work-gallery__stage"
      :class="`work-gallery__stage--${activeOrientation}`"
      :style="stageStyle"
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
/*
 * 两列：左侧舞台吃掉全部剩余宽度，右侧缩略图列定宽。
 *
 * 舞台宽度与当前图片宽度无关，所以缩略图列的位置固定，不会随竖图/横图切换左右
 * 移动；同时横图能用满整个舞台宽度，不被截断，也不浪费屏幕宽度。
 * 窄屏回落为单列，缩略图横排在主图下方。
 */
.work-gallery {
  /* 图片与舞台共用同一个高度上限，两者的高度因此恒等。 */
  --gallery-max-height: clamp(20rem, calc(100vh - 15rem), 46rem);

  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-3);
}

/*
 * grid 单格：交叉淡化期间新旧两张图占同一格并叠在一起，不会并排把布局挤宽。
 * 不设 overflow: hidden——圆角在图片自身上，裁切只会切掉宽图。
 *
 * 竖图与横图高度不同，切换方向时舞台高度必然变化。高度不由内容算（auto →
 * auto 不是计算值变化，无法过渡），而是由当前图片的比例算：舞台自己带
 * aspect-ratio 并用同一个高度上限收口，得到的高度与图片一致，且 aspect-ratio
 * 可以过渡，于是高度变化与淡化同时进行，不再是一次瞬间跳格。
 */
.work-gallery__stage {
  position: relative;
  display: grid;
  grid-template-areas: 'stage';
  flex: 1 1 auto;
  min-width: 0;
  aspect-ratio: var(--stage-aspect-ratio, 4 / 3);
  max-height: var(--gallery-max-height);
  transition: aspect-ratio var(--motion-duration-content) var(--motion-ease-standard);
}

.work-gallery__stage :deep(.work-gallery__image) {
  grid-area: stage;
  place-self: center;
}

/* 淡化与高度同时长，两件事同起同落，读作一次动作。 */
.work-gallery-fade-enter-active,
.work-gallery-fade-leave-active {
  transition: opacity var(--motion-duration-content) var(--motion-ease-standard);
}

/*
 * 离场图移出文档流，只保留水平居中（`margin-inline: auto` + 左右 inset）。
 * 不写 `inset: 0`：那会同时约束上下边，把离场竖图压扁到新的舞台高度。
 */
.work-gallery-fade-leave-active {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  margin-inline: auto;
}

.work-gallery-fade-enter-from,
.work-gallery-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .work-gallery__stage,
  .work-gallery-fade-enter-active,
  .work-gallery-fade-leave-active {
    transition: none;
  }
}

/*
 * 尺寸取「高度上限换算出的宽度」与「舞台可用宽度」的较小值：
 * 竖图受高度上限约束，不顶穿一屏；横图一路放大到铺满舞台宽度，既不被截断
 * 也不浪费屏幕宽度。占位背景只包裹图片矩形本身，不铺满整栏。
 */
.work-gallery__stage :deep(.work-gallery__image) {
  width: min(100%, calc(var(--gallery-max-height) * var(--gallery-aspect-ratio)));
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

/*
 * 桌面：缩略图列定宽贴在右边缘，舞台吃掉剩余宽度。
 *
 * 缩略图位置因此与当前图片宽度无关，切换竖图/横图时不会左右移动；舞台是整块
 * 剩余宽度，横图能一直放大到铺满它为止。
 */
@media (min-width: 768px) {
  .work-gallery {
    flex-wrap: nowrap;
    gap: var(--space-4);
  }

  .work-gallery__thumbs {
    flex: 0 0 auto;
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

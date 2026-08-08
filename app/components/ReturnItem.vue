<script setup lang="ts">
import type { PublicReturnPhotoDto } from '~~/shared/types/contracts'

/**
 * 返图墙单项：只有无水印原比例图片。
 *
 * 纯净瀑布流：不标设定名称、日期、授权记录或社交信息——
 * 返图墙的主体就是图片本身。整项是一个链接，指向该设定的返图页；
 * 无障碍名称由图片 alt 提供。
 */
const props = withDefaults(defineProps<{
  item: PublicReturnPhotoDto
  loading?: 'lazy' | 'eager'
  sizes?: string | undefined
}>(), {
  loading: 'lazy',
  sizes: undefined,
})

const failed = ref(false)

/**
 * CSS Grid row-span 的行数。
 *
 * 行高在样式里等于「列宽 / 100」，因此 `100 * 高 / 宽` 正好等于图片高度
 * 占用的行数，与视口无关。再加上项间距的固定行数配额。
 * 全部在 SSR 时算好，无 JavaScript 也能得到正确布局。
 */
const GAP_ROWS = 6

const spanRows = computed(() => {
  const { height, width } = props.item.image
  const imageRows = Math.max(1, Math.round(100 * height / width))
  return imageRows + GAP_ROWS
})
</script>

<template>
  <li
    class="return-item"
    :style="{ '--return-span': spanRows }"
  >
    <NuxtLink
      class="return-item__link"
      :to="item.character.href"
      :data-return-id="item.id"
    >
      <span class="return-item__frame">
        <ResponsivePicture
          v-if="!failed"
          class="return-item__picture"
          :sources="item.image.sources"
          :alt="item.image.alt"
          :sizes="sizes"
          :loading="loading"
          @error="failed = true"
        />
        <span v-else class="return-item__broken">图片暂时无法显示</span>
      </span>
    </NuxtLink>
  </li>
</template>

<style scoped>
.return-item {
  /* 行跨度由固有宽高比决定，因此图片保持原比例，不做统一强裁。 */
  grid-row-end: span var(--return-span);
}

.return-item__link {
  display: block;
  color: var(--public-text-primary);
}

.return-item__frame {
  display: block;
  overflow: hidden;
  /* 与 /works 作品卡统一的圆角矩形。 */
  border-radius: var(--radius-image);
  background: var(--image-placeholder);
}

.return-item__picture {
  display: block;
}

.return-item__broken {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 6rem;
  padding: var(--space-4);
  color: var(--public-text-tertiary);
  font-size: var(--font-size-sm);
  text-align: center;
}
</style>

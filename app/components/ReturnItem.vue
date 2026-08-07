<script setup lang="ts">
import type { PublicReturnPhotoDto } from '~~/shared/types/contracts'

/**
 * 返图墙单项：无水印原比例图片 + 图片下方的关联作品入口。
 *
 * 整项只有一个主链接（指向作品详情），避免图片链接与作品链接嵌套。
 * 不显示返图者昵称、主页、日期、授权记录或社交信息。
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
 * 占用的行数，与视口无关。再加上 caption 与项间距的固定行数配额。
 * 全部在 SSR 时算好，无 JavaScript 也能得到正确布局。
 */
const CAPTION_ROWS = 13
const GAP_ROWS = 6

const spanRows = computed(() => {
  const { height, width } = props.item.image
  const imageRows = Math.max(1, Math.round(100 * height / width))
  return imageRows + CAPTION_ROWS + GAP_ROWS
})
</script>

<template>
  <li
    class="return-item"
    :style="{ '--return-span': spanRows }"
  >
    <NuxtLink
      class="return-item__link"
      :to="item.work.href"
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
      <span class="return-item__caption">{{ item.work.characterName }}</span>
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

.return-item__link:hover {
  color: var(--public-text-primary);
}

.return-item__frame {
  display: block;
  overflow: hidden;
  border-radius: var(--return-radius);
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

.return-item__caption {
  display: block;
  margin-top: var(--return-caption-gap);
  color: var(--return-caption-color);
  font-size: var(--return-caption-size);
  line-height: var(--line-height-normal);
  overflow-wrap: anywhere;
}

.return-item__link:hover .return-item__caption,
.return-item__link:focus-visible .return-item__caption {
  color: var(--public-text-primary);
}
</style>

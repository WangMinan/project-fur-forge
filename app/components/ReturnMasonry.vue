<script setup lang="ts">
import type { PublicReturnPhotoDto } from '~~/shared/types/contracts'

/**
 * 返图墙瀑布流。
 *
 * 布局用确定性的 CSS Grid row-span，而不是 `column-count`
 * 或 `grid-auto-flow: dense`：
 * - 自动放置按行主序填充，DOM 顺序、Tab 顺序、屏幕阅读顺序
 *   与视觉阅读顺序一致；
 * - 行高固定为「列宽 / 100」，每项跨 `100 * 高 / 宽` 行加固定配额，
 *   因此图片保持原始宽高比，且不同列自然形成不等高排列；
 * - 行间距为 0，项间距由每项自己的行配额提供，
 *   这样跨行元素的高度不会被 row-gap 放大；
 * - 全部尺寸在 SSR 时确定，无 JavaScript 也能正确布局，且不产生 CLS。
 */
defineProps<{
  items: PublicReturnPhotoDto[]
}>()

/** 首屏若干张用 eager，其余懒加载。 */
const EAGER_COUNT = 4

/**
 * `sizes` 只能写合法的媒体条件 + 长度：HTML 的 sizes 属性不解析 `var()`，
 * 写了 CSS 变量会让浏览器整条失效并退回 100vw，
 * 结果给 300px 左右的格子下载最大变体，白白浪费流量。
 *
 * 这里的数值对应各断点下的实际列宽：
 * 桌面内容宽上限 90rem、4 列、gap 20px → 约 316px；
 * 平板 3 列、gap 16px → 约 33vw；手机 2 列、gap 12px → 约 50vw。
 */
const SIZES = [
  '(min-width: 1280px) 320px',
  '(min-width: 768px) 33vw',
  '(min-width: 340px) 50vw',
  '100vw',
].join(', ')
</script>

<template>
  <div class="return-wall">
    <ul class="return-wall__grid">
      <ReturnItem
        v-for="(item, index) in items"
        :key="item.id"
        :item="item"
        :sizes="SIZES"
        :loading="index < EAGER_COUNT ? 'eager' : 'lazy'"
      />
    </ul>
  </div>
</template>

<style scoped>
.return-wall {
  /* row 单位需要按“列宽”缩放，因此把容器查询锚定在外层。 */
  container-type: inline-size;
}

.return-wall__grid {
  --return-columns: 2;
  --return-gap: var(--return-gap-mobile);

  display: grid;
  grid-template-columns: repeat(var(--return-columns), minmax(0, 1fr));
  column-gap: var(--return-gap);
  /* 行间距必须为 0：跨行元素的高度不能被 row-gap 累加放大。 */
  row-gap: 0;
  /* 行高 = 列宽 / 100，因此 100 * 高 / 宽 正好是图片占用的行数。 */
  grid-auto-rows: calc(
    (100cqw - (var(--return-columns) - 1) * var(--return-gap))
    / var(--return-columns) / 100
  );
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 339px) {
  .return-wall__grid {
    --return-columns: 1;
  }
}

@media (min-width: 768px) {
  .return-wall__grid {
    --return-columns: 3;
    --return-gap: var(--return-gap-tablet);
  }
}

@media (min-width: 1280px) {
  .return-wall__grid {
    --return-columns: 4;
    --return-gap: var(--return-gap-desktop);
  }
}
</style>

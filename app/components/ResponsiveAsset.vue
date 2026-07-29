<script setup lang="ts">
/**
 * 只消费预生成的公开衍生图 URL，输出带尺寸与焦点的 <img>。
 * 不追加任何转换查询参数；OSS 是唯一像素转换权威。
 */
const props = withDefaults(defineProps<{
  src: string
  alt: string
  width: number
  height: number
  focalDesktop?: string
  focalMobile?: string
  sizes?: string | undefined
  loading?: 'lazy' | 'eager'
  fetchpriority?: 'high' | 'auto' | 'low'
}>(), {
  focalDesktop: '50% 50%',
  focalMobile: '50% 50%',
  sizes: undefined,
  loading: 'lazy',
  fetchpriority: 'auto',
})

const styleVars = computed(() => ({
  '--asset-ratio': `${props.width} / ${props.height}`,
  '--asset-focal-desktop': props.focalDesktop,
  '--asset-focal-mobile': props.focalMobile,
}))
</script>

<template>
  <img
    class="responsive-asset"
    :style="styleVars"
    :src="src"
    :alt="alt"
    :width="width"
    :height="height"
    :sizes="sizes"
    :loading="loading"
    :fetchpriority="fetchpriority"
    decoding="async"
  >
</template>

<style scoped>
.responsive-asset {
  width: 100%;
  height: auto;
  aspect-ratio: var(--asset-ratio);
  background: var(--image-placeholder);
  object-fit: cover;
  object-position: var(--asset-focal-mobile);
}

@media (min-width: 768px) {
  .responsive-asset {
    object-position: var(--asset-focal-desktop);
  }
}
</style>

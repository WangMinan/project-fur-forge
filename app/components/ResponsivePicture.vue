<script setup lang="ts">
import type { PublicSourceSetDto } from '~~/shared/types/contracts'

/**
 * 公开图片唯一原语：只消费服务端预生成的 PublicSourceSetDto。
 * <source> 顺序固定（交接契约）：有竖版时先竖版 WebP/Fallback（media portrait），
 * 再横版 WebP，最后 <img> 用横版/主 fallback 最大宽度项。
 * 不追加任何转换查询参数；OSS 是唯一像素转换权威。
 */
const props = withDefaults(defineProps<{
  sources: PublicSourceSetDto
  portraitSources?: PublicSourceSetDto | undefined
  alt: string
  sizes?: string | undefined
  loading?: 'lazy' | 'eager'
  fetchpriority?: 'high' | 'auto' | 'low'
}>(), {
  portraitSources: undefined,
  sizes: undefined,
  loading: 'lazy',
  fetchpriority: 'auto',
})

/**
 * 单图解码/网络失败向上通知。
 * `<img>` 的 error 事件不冒泡，因此必须在 img 上显式绑定再转发，
 * 调用方才能做局部降级而不影响整页。
 */
const emit = defineEmits<{ error: [] }>()

const fallbackImg = computed(() => pickFallbackImg(props.sources))
const portraitFallbackImg = computed(() =>
  props.portraitSources ? pickFallbackImg(props.portraitSources) : undefined,
)
const webpSrcset = computed(() => buildSrcset(props.sources.webp))
const fallbackSrcset = computed(() => buildSrcset(props.sources.fallback))
const portraitWebpSrcset = computed(() =>
  props.portraitSources ? buildSrcset(props.portraitSources.webp) : undefined,
)
const portraitFallbackSrcset = computed(() =>
  props.portraitSources ? buildSrcset(props.portraitSources.fallback) : undefined,
)
</script>

<template>
  <picture class="responsive-picture">
    <template v-if="portraitSources">
      <source
        type="image/webp"
        media="(orientation: portrait)"
        :srcset="portraitWebpSrcset"
        :sizes="sizes"
        :width="portraitFallbackImg?.width"
        :height="portraitFallbackImg?.height"
      >
      <source
        media="(orientation: portrait)"
        :srcset="portraitFallbackSrcset"
        :sizes="sizes"
        :width="portraitFallbackImg?.width"
        :height="portraitFallbackImg?.height"
      >
    </template>
    <source
      type="image/webp"
      :srcset="webpSrcset"
      :sizes="sizes"
      :width="fallbackImg.width"
      :height="fallbackImg.height"
    >
    <img
      class="responsive-picture__image"
      :src="fallbackImg.src"
      :srcset="fallbackSrcset"
      :sizes="sizes"
      :width="fallbackImg.width"
      :height="fallbackImg.height"
      :alt="alt"
      :loading="loading"
      :fetchpriority="fetchpriority"
      decoding="async"
      @error="emit('error')"
    >
  </picture>
</template>

<style scoped>
.responsive-picture {
  display: block;
  width: 100%;
}

.responsive-picture__image {
  display: block;
  width: 100%;
  height: auto;
}
</style>

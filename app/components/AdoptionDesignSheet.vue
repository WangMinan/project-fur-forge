<script setup lang="ts">
import type { PublicDesignSheetDto } from '~~/shared/types/contracts'

const props = defineProps<{
  designSheet: PublicDesignSheetDto
}>()

const previewMatchedSources = computed(() => ({
  webp: props.designSheet.sources.webp.slice(0, 1),
  fallback: props.designSheet.sources.fallback.slice(0, 1),
}))
</script>

<template>
  <div class="design-sheet" data-testid="public-design-sheet">
    <ResponsivePicture
      :sources="previewMatchedSources"
      :alt="props.designSheet.alt"
      loading="eager"
      fetchpriority="high"
      sizes="(min-width: 1024px) 58vw, 100vw"
    />
  </div>
</template>

<style scoped>
.design-sheet {
  width: 100%;
  overflow: hidden;
  background: var(--image-placeholder);
}

.design-sheet :deep(.responsive-picture__image) {
  width: 100%;
  height: auto;
  object-fit: contain;
}
</style>

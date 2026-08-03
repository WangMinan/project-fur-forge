<script setup lang="ts">
import type { PublicDesignSheetDto } from '~~/shared/types/contracts'

defineProps<{
  designSheet: PublicDesignSheetDto
}>()
</script>

<template>
  <div class="design-sheet" data-testid="public-design-sheet">
    <ResponsivePicture
      :sources="designSheet.sources"
      :alt="designSheet.alt"
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

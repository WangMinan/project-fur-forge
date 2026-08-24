<script setup lang="ts">
defineProps<{
  characterName: string
  species: string
}>()
</script>

<template>
  <span class="work-identity">
    <span class="work-identity__name">{{ characterName }}</span>
    <span class="work-identity__details">
      <span class="work-identity__separator" aria-hidden="true"> · </span>
      <span class="work-identity__species">{{ species }}</span>
    </span>
  </span>
</template>

<style scoped>
/**
 * 名称与物种同字号：层级只靠字体与颜色区分，不靠字号大小差。
 * 三处调用方（/works、/adoptions、首页领养幕）共用本组件，
 * 因此字号只在这里定义一次，避免各页出现不同大小。
 *
 * 用 center 而不是 baseline 对齐：名称是宋体、物种是黑体，两种字体的
 * 汉字字面相对拉丁基线的位置不同，baseline 对齐会让物种看起来偏高。
 * 同时把行高统一到两个子元素上，保证两个行盒等高。
 */
.work-identity {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: var(--font-size-md);
  line-height: var(--line-height-heading);
}

.work-identity__name {
  font-family: var(--font-public-display);
}

.work-identity__details {
  color: var(--public-text-secondary);
  white-space: nowrap;
}

.work-identity__separator {
  white-space: pre;
}
</style>

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
 */
.work-identity {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  font-size: var(--font-size-md);
}

.work-identity__name {
  font-family: var(--font-public-display);
  line-height: var(--line-height-heading);
}

.work-identity__details {
  color: var(--public-text-secondary);
  white-space: nowrap;
}

.work-identity__separator {
  white-space: pre;
}
</style>

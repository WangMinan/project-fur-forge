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
.work-identity {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
}

.work-identity__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-md);
  line-height: var(--line-height-heading);
}

.work-identity__details {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.work-identity__separator {
  white-space: pre;
}
</style>

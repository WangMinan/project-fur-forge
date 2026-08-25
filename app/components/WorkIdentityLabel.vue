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
  display: grid;
  gap: var(--space-1);
  max-width: 100%;
}

.work-identity__name {
  min-width: 0;
  font-family: var(--font-public-display);
  font-size: clamp(1rem, 1.7vw, 1.25rem);
  font-weight: 600;
  line-height: var(--line-height-heading);
  overflow-wrap: anywhere;
}

.work-identity__details {
  display: block;
  min-width: 0;
  max-width: 100%;
  color: rgb(255 255 255 / 0.82);
  font-size: var(--font-size-xs);
}

.work-identity__species {
  min-width: 0;
  overflow-wrap: anywhere;
}

.work-identity__separator {
  display: none;
}
</style>

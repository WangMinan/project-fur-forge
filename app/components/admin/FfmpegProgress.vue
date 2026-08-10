<script setup lang="ts">
const props = defineProps<{
  label: string
}>()

const elapsedSeconds = shallowRef(0)
let timer: ReturnType<typeof setInterval> | null = null

const elapsedLabel = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return minutes > 0
    ? `${minutes} 分 ${seconds.toString().padStart(2, '0')} 秒`
    : `${seconds} 秒`
})

onMounted(() => {
  timer = setInterval(() => {
    elapsedSeconds.value += 1
  }, 1_000)
})

onScopeDispose(() => {
  if (timer !== null) {
    clearInterval(timer)
  }
})
</script>

<template>
  <div
    class="ffmpeg-progress"
    data-testid="ffmpeg-progress"
  >
    <span class="ffmpeg-progress__label" role="status" aria-live="polite">{{ props.label }}</span>
    <span class="ffmpeg-progress__elapsed" aria-hidden="true">已等待 {{ elapsedLabel }}</span>
    <progress
      class="ffmpeg-progress__bar"
      :aria-label="props.label"
    />
  </div>
</template>

<style scoped>
.ffmpeg-progress {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--admin-space-1) var(--admin-space-3);
  width: 100%;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.ffmpeg-progress__label {
  min-width: 0;
}

.ffmpeg-progress__elapsed {
  color: var(--admin-text-tertiary);
  white-space: nowrap;
}

.ffmpeg-progress__bar {
  grid-column: 1 / -1;
  width: 100%;
  height: 0.5rem;
  accent-color: var(--admin-accent-primary);
}
</style>

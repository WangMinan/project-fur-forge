<script setup lang="ts">
const rootRef = useTemplateRef<HTMLElement>('rootRef')
const observed = shallowRef(false)
const revealed = shallowRef(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  const root = rootRef.value
  if (!root || !('IntersectionObserver' in window)) {
    revealed.value = true
    return
  }

  observed.value = true
  observer = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) {
      return
    }
    revealed.value = true
    observer?.disconnect()
    observer = null
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -8% 0px',
  })
  observer.observe(root)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    ref="rootRef"
    class="home-motion-reveal"
    :class="{
      'home-motion-reveal--observed': observed,
      'home-motion-reveal--visible': revealed,
    }"
    :data-reveal-state="revealed ? 'visible' : observed ? 'waiting' : 'static'"
  >
    <slot />
  </div>
</template>

<style scoped>
/* SSR 与无 JavaScript 默认可见；只有客户端成功挂载观察器后才进入等待态。 */
.home-motion-reveal--observed:not(.home-motion-reveal--visible) {
  opacity: 0;
  transform: translateY(1.25rem);
}

.home-motion-reveal--visible {
  opacity: 1;
  transform: translateY(0);
}

.home-motion-reveal--observed {
  transition:
    opacity 620ms var(--easing-standard),
    transform 620ms var(--easing-standard);
}

@media (prefers-reduced-motion: reduce) {
  .home-motion-reveal--observed,
  .home-motion-reveal--observed:not(.home-motion-reveal--visible) {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>

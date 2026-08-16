<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'

const route = useRoute()
const requestUrl = useRequestURL()
const canonical = computed(() => new URL(route.path, requestUrl.origin).href)
const sharingImage = computed(() => new URL('/brand/og-default.png', requestUrl.origin).href)
const mainRef = useTemplateRef<HTMLElement>('mainRef')
const pendingMainFocus = shallowRef(false)

watch(() => route.path, (path, previousPath) => {
  pendingMainFocus.value = path !== previousPath && !route.hash
})

function onMainEntered() {
  if (!pendingMainFocus.value) {
    return
  }
  pendingMainFocus.value = false
  mainRef.value?.focus({ preventScroll: true })
}

useSeoMeta({
  ogSiteName: PROJECT_NAME,
  ogUrl: canonical,
  ogImage: sharingImage,
  twitterCard: 'summary_large_image',
  twitterImage: sharingImage,
})

useHead(() => ({
  link: [{ rel: 'canonical', href: canonical.value }],
  script: [{
    key: 'organization-json-ld',
    type: 'application/ld+json',
    textContent: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: PROJECT_NAME,
      url: new URL('/', requestUrl.origin).href,
    }),
  }],
}))
</script>

<template>
  <div class="public-layout">
    <a href="#main-content" class="skip-link">跳到主要内容</a>
    <PublicHeader />
    <main
      id="main-content"
      ref="mainRef"
      class="public-layout__content"
      tabindex="-1"
    >
      <Transition
        name="public-main"
        mode="out-in"
        @after-enter="onMainEntered"
      >
        <div :key="route.path" class="public-layout__route">
          <slot />
        </div>
      </Transition>
    </main>
    <PublicFooter />
  </div>
</template>

<style scoped>
.public-layout {
  min-height: 100vh;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
}

.public-layout__content {
  min-height: 60vh;
}

.public-layout__route {
  min-height: inherit;
}

.public-main-enter-active {
  transition:
    opacity 300ms var(--easing-standard),
    transform 300ms var(--easing-standard);
}

.public-main-leave-active {
  pointer-events: none;
  transition:
    opacity 170ms var(--easing-exit),
    transform 170ms var(--easing-exit);
}

.public-main-enter-from {
  opacity: 0;
  transform: translateY(0.75rem);
}

.public-main-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}

@media (prefers-reduced-motion: reduce) {
  .public-main-enter-active,
  .public-main-leave-active {
    transition: none;
  }

  .public-main-enter-from,
  .public-main-leave-to {
    transform: none;
  }
}
</style>

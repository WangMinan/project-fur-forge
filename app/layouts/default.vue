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

/**
 * Nuxt 默认 scrollBehavior 在 `to.path === from.path` 时直接 `return false`，
 * 也就是「同路径只改 query」保持当前滚动位置。作品与领养的分页、筛选和搜索
 * 全都走 query，翻到第 2 页会停在上一页的位置。跨路径仍交给 Nuxt 默认处理
 * （它会等页面加载完再滚，这里不重复实现）。
 */
watch(() => route.fullPath, (_fullPath, previousFullPath) => {
  if (!previousFullPath || route.hash) {
    return
  }
  const previousPath = previousFullPath.split(/[?#]/)[0]
  if (previousPath !== route.path) {
    return
  }
  window.scrollTo({ top: 0, behavior: 'instant' })
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

/* 切换只做位移，且只在新页面入场时做。
   此前 enter-from 与 leave-to 都淡到 opacity 0：out-in 模式下这两端衔接处
   整页透明、露出布局白底，就是顶级 tab 切换时看到的「闪一下」；
   离场那 170ms 又是新页面出现前的纯等待，看起来像「闪完再加载」。
   现在离场即时移除、入场全程不透明，画面上任何时刻都是完整内容。 */
.public-main-enter-active {
  transition: transform 300ms var(--easing-standard);
}

.public-main-leave-active {
  pointer-events: none;
}

.public-main-enter-from {
  transform: translateY(0.75rem);
}

@media (prefers-reduced-motion: reduce) {
  .public-main-enter-active {
    transition: none;
  }

  .public-main-enter-from {
    transform: none;
  }
}
</style>

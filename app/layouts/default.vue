<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'

const route = useRoute()
const requestUrl = useRequestURL()
const canonical = computed(() => new URL(route.path, requestUrl.origin).href)
const sharingImage = computed(() => new URL('/brand/og-default.png', requestUrl.origin).href)
const mainRef = useTemplateRef<HTMLElement>('mainRef')

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

/**
 * 跨路径切换后把焦点交回 main，键盘用户不必从页头重新 Tab。
 * 过渡已移交 Nuxt `pageTransition`（见 app/app.vue），这里改为在导航完成后处理，
 * 不再依赖 Transition 的 after-enter 钩子。
 */
const router = useRouter()

router.afterEach((to, from) => {
  if (to.path === from.path || to.hash) {
    return
  }
  requestAnimationFrame(() => mainRef.value?.focus({ preventScroll: true }))
})

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
      <slot />
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

/* 页面切换动效由 Nuxt pageTransition 提供，样式在 public-base.css（全局）。 */
</style>

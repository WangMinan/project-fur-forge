<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'

const route = useRoute()
const requestUrl = useRequestURL()
const canonical = computed(() => new URL(route.path, requestUrl.origin).href)
const sharingImage = computed(() => new URL('/brand/og-default.c34fe375.png', requestUrl.origin).href)
const sharingImageAlt = `${PROJECT_NAME}品牌标志`
const mainRef = useTemplateRef<HTMLElement>('mainRef')

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
  ogType: 'website',
  ogLocale: 'zh_CN',
  ogSiteName: PROJECT_NAME,
  ogUrl: canonical,
  ogImage: sharingImage,
  ogImageWidth: 1200,
  ogImageHeight: 1200,
  ogImageType: 'image/png',
  ogImageAlt: sharingImageAlt,
  twitterCard: 'summary',
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
    <Head>
      <Meta itemprop="image" :content="sharingImage" />
    </Head>
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
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100svh;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
}

.public-layout__content {
  flex: 1 0 auto;
  width: 100%;
  min-height: 60vh;
}
</style>

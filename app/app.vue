<script setup lang="ts">
const route = useRoute()
const { status } = useAdminAuth()
const sharedViewMarker = computed(() => (
  typeof route.query.view === 'string' && route.query.view.startsWith('home-')
))

/**
 * 公开端页面切换动效。必须挂在 NuxtPage 上（Suspense 内部）：layout 层自己包
 * Transition 会在新页面已渲染后才补入场起始态，表现为「加载完再闪一下才动效」。
 * 管理端不参与，避免表单页在切换时闪烁。
 */
const pageTransition = computed(() => (
  route.path.startsWith('/admin') || sharedViewMarker.value
    ? false
    : { name: 'public-page' }
))

// 会话在使用中失效（退出、改密、SessionVersion 变化）时，无论当前页面使用
// 哪种布局，都立即离开受保护区域回登录页，避免失效页面继续可用。
watch(status, (value) => {
  if (
    value === 'guest'
    && route.path.startsWith('/admin')
    && route.path !== '/admin/login'
  ) {
    navigateTo(
      {
        path: '/admin/login',
        query: { redirect: route.fullPath },
      },
      { replace: true },
    )
  }
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage :transition="pageTransition" />
  </NuxtLayout>
</template>

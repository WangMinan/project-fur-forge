<script setup lang="ts">
const route = useRoute()
const { status } = useAdminAuth()

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
    <NuxtPage />
  </NuxtLayout>
</template>

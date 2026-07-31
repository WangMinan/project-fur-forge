<script setup lang="ts">
// 管理端首页：/admin 落到作品列表；未认证由路由中间件送到登录页。
// 过渡页不继承公开站 default layout。
definePageMeta({
  layout: false,
  ssr: false,
})

await navigateTo('/admin/works', { replace: true })
</script>

<template>
  <div class="admin-surface" />
</template>

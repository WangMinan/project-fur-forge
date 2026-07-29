<script setup lang="ts">
// 管理端首页：T13 认证接入前，/admin 一律落到登录页（管理面为 CSR，客户端重定向）。
definePageMeta({
  ssr: false,
})

await navigateTo('/admin/login', { replace: true })
</script>

<template>
  <div class="admin-surface" />
</template>

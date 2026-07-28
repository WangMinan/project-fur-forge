<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'

definePageMeta({
  layout: 'admin',
})

useSeoMeta({
  title: `管理端登录 · ${PROJECT_NAME}`,
  robots: 'noindex, nofollow, noarchive',
})
</script>

<template>
  <section
    class="admin-login"
    data-testid="admin-login"
  >
    <p class="admin-login__eyebrow">
      Admin
    </p>
    <h1 class="admin-login__title">
      管理端登录
    </h1>
    <p class="admin-login__status">
      管理端最小 CSR 切片已运行，身份验证将在后续任务中接入。
    </p>
  </section>
</template>

<style scoped>
.admin-login {
  display: grid;
  min-height: 100vh;
  padding: 2rem;
  place-content: center;
  text-align: center;
}

.admin-login__eyebrow {
  margin: 0 0 0.75rem;
  color: #69717d;
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.admin-login__title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 600;
  letter-spacing: -0.035em;
}

.admin-login__status {
  max-width: 34rem;
  margin: 1rem auto 0;
  color: #69717d;
  line-height: 1.7;
}
</style>

<script setup lang="ts">
import {
  PROJECT_ENGLISH_NAME,
  PROJECT_NAME,
} from '~~/shared/constants/project'

useSeoMeta({
  title: PROJECT_NAME,
  description: '兽装工作室公开站工程底座。',
})
</script>

<template>
  <section
    class="public-home"
    data-testid="public-home"
  >
    <p class="public-home__eyebrow">
      {{ PROJECT_ENGLISH_NAME }}
    </p>
    <h1 class="public-home__title">
      {{ PROJECT_NAME }}
    </h1>
    <p class="public-home__status">
      公开站最小 SSR 切片已运行，生产视觉将在后续设计任务中完成。
    </p>
  </section>
</template>

<style scoped>
.public-home {
  display: grid;
  min-height: 100vh;
  padding: 2rem;
  place-content: center;
  text-align: center;
}

.public-home__eyebrow {
  margin: 0 0 0.75rem;
  color: #69717d;
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.public-home__title {
  margin: 0;
  font-size: clamp(2rem, 6vw, 4.5rem);
  font-weight: 600;
  letter-spacing: -0.04em;
}

.public-home__status {
  max-width: 36rem;
  margin: 1rem auto 0;
  color: #69717d;
  line-height: 1.7;
}
</style>

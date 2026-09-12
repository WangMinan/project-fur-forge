<script setup lang="ts">
import type { NuxtError } from '#app'
const { t, isEnglish } = usePublicI18n()

const props = defineProps<{
  error: NuxtError
}>()

const statusCode = computed(() => props.error.statusCode || 500)
const isNotFound = computed(() => statusCode.value === 404)
const title = computed(() =>
  isNotFound.value ? t('ui.notFound') : t('ui.pageError'),
)
const description = computed(() =>
  isNotFound.value
    ? t('ui.notFoundDescription')
    : t('ui.pageErrorDescription'),
)

useHead(() => ({
  title: `${statusCode.value} · ${title.value} · ${isEnglish.value ? 'DITE DOG' : '有点小狗工作室'}`,
}))
</script>

<template>
  <div class="error-shell public-error-enter">
    <PublicHeader brand-only />
    <main class="error-page" data-testid="public-error-page">
      <PublicEmptyState
        :eyebrow="String(statusCode)"
        :title="title"
        :description="description"
        heading="h1"
      >
        <PublicAction
          href="/"
          @click.prevent="clearError({ redirect: '/' })"
        >{{ t('ui.backHome') }}</PublicAction>
      </PublicEmptyState>
    </main>
  </div>
</template>

<style scoped>
.error-shell {
  display: grid;
  min-height: 100svh;
  background: var(--public-bg-primary);
  grid-template-rows: auto 1fr;
}

.error-page {
  display: grid;
  padding: var(--public-page-padding);
  place-content: center;
}
</style>

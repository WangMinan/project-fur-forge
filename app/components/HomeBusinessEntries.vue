<script setup lang="ts">
import type { PublicHomeEntryCardDto } from '~~/shared/types/contracts'

const props = defineProps<{
  entries: {
    adoption: PublicHomeEntryCardDto | null
    commission: PublicHomeEntryCardDto | null
  }
}>()

const commission = computed(() => props.entries.commission)

const TONE_LABELS = {
  open: '开放中',
  limited: '有限开放',
  closed: '暂不开放',
} as const
</script>

<template>
  <section
    v-if="commission"
    class="home-commission"
    aria-labelledby="home-entries-title"
    data-testid="home-business-entries"
  >
    <header class="home-commission__header">
      <p class="home-commission__eyebrow">CUSTOM COMMISSION</p>
      <h2 id="home-entries-title" class="home-commission__title">自设委托</h2>
    </header>

    <article
      class="home-commission__stage"
      :data-entry-kind="commission.kind"
      data-testid="home-business-entry"
    >
      <NuxtLink :to="commission.href" class="home-commission__media" aria-label="了解自设委托">
        <ResponsivePicture
          :sources="commission.sources"
          :alt="commission.alt"
          sizes="(min-width: 1024px) 70vw, 100vw"
        />
      </NuxtLink>

      <div class="home-commission__body">
        <div
          v-if="commission.status"
          class="home-commission__status"
          :data-tone="commission.status.tone"
        >
          <span class="home-commission__status-dot" aria-hidden="true" />
          <span>{{ commission.status.label }}</span>
          <small>{{ TONE_LABELS[commission.status.tone] }}</small>
        </div>

        <h3>{{ commission.title }}</h3>
        <p v-if="commission.summary" class="home-commission__summary">
          {{ commission.summary }}
        </p>
        <p class="home-commission__process">
          先通过站内表单提交。工作室评估后优先使用官方 QQ 私聊沟通，邮箱作为备用渠道。
        </p>
        <PublicAction to="/commission/apply">
          提交委托申请
        </PublicAction>
      </div>
    </article>
  </section>
</template>

<style scoped>
.home-commission {
  display: grid;
  gap: var(--space-6);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: clamp(var(--space-8), 8vw, var(--space-11)) var(--public-page-padding) 0;
}

.home-commission__header {
  display: grid;
  gap: var(--space-2);
}

.home-commission__eyebrow {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.16em;
}

.home-commission__title {
  font-family: var(--font-public-display);
  font-size: clamp(2.5rem, 6vw, 5.5rem);
  font-weight: 600;
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-tight);
}

.home-commission__stage {
  display: grid;
  gap: var(--space-6);
}

.home-commission__media {
  display: block;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: var(--image-placeholder);
  border-radius: var(--radius-image);
}

.home-commission__media :deep(.responsive-picture),
.home-commission__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.home-commission__media :deep(.responsive-picture__image) {
  object-fit: cover;
}

.home-commission__body {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: var(--space-4);
  max-width: 30rem;
}

.home-commission__body h3 {
  margin: 0;
  font-family: var(--font-public-display);
  font-size: clamp(2rem, 4vw, 3.75rem);
  font-weight: 600;
  line-height: var(--line-height-tight);
}

.home-commission__status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.home-commission__status small {
  color: var(--public-text-tertiary);
}

.home-commission__status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: var(--public-text-tertiary);
}

.home-commission__status[data-tone='open'] .home-commission__status-dot {
  background: var(--status-open, #2f7a4d);
}

.home-commission__status[data-tone='limited'] .home-commission__status-dot {
  background: var(--status-limited, #a8701a);
}

.home-commission__status[data-tone='closed'] .home-commission__status-dot {
  background: var(--status-closed, #8a8f98);
}

.home-commission__summary,
.home-commission__process {
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}

.home-commission__process {
  font-size: var(--font-size-sm);
}

@media (min-width: 1024px) {
  .home-commission__stage {
    grid-template-columns: minmax(0, 2.25fr) minmax(18rem, 0.75fr);
    align-items: stretch;
  }

  .home-commission__body {
    padding: var(--space-6) 0;
  }
}
</style>

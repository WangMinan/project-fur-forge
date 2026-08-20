<script setup lang="ts">
import type { PublicHomeEntryCardDto } from '~~/shared/types/contracts'
import HomeBusinessStatus from '~/components/HomeBusinessStatus.vue'

const props = defineProps<{
  entries: {
    adoption: PublicHomeEntryCardDto | null
    commission: PublicHomeEntryCardDto | null
  }
}>()

const commission = computed(() => props.entries.commission)

</script>

<template>
  <section
    v-if="commission"
    class="home-commission"
    aria-labelledby="home-entries-title"
    data-testid="home-business-entries"
  >
    <header class="home-commission__header">
      <div>
        <p class="home-commission__eyebrow">CUSTOM COMMISSION</p>
        <h2 id="home-entries-title" class="home-commission__title">自设委托</h2>
      </div>
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
        <HomeBusinessStatus
          v-if="commission.status"
          :status="commission.status"
        />

        <p class="home-commission__process">
          先通过站内表单提交。工作室评估后优先使用官方 QQ 私聊沟通。
        </p>
        <div class="home-commission__actions">
          <PublicAction to="/commission" variant="secondary">
            了解自设委托
          </PublicAction>
          <PublicAction to="/commission/apply">
            提交委托申请
          </PublicAction>
        </div>
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
  padding: var(--space-6) var(--public-page-padding) 0;
}

.home-commission__header {
  display: grid;
}

.home-commission__header > div {
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
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.home-commission__stage {
  display: grid;
  gap: var(--space-6);
}

.home-commission__media {
  display: block;
  height: var(--home-scene-media-height);
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

.home-commission__process {
  color: var(--public-text-secondary);
  line-height: var(--line-height-relaxed);
}

.home-commission__process {
  font-size: var(--font-size-sm);
}

.home-commission__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

@media (min-width: 1024px) {
  .home-commission__stage {
    grid-template-columns: minmax(18rem, 0.75fr) minmax(0, 2.25fr);
    align-items: stretch;
  }

  .home-commission__media {
    grid-column: 2;
    grid-row: 1;
  }

  .home-commission__body {
    grid-column: 1;
    grid-row: 1;
    padding: var(--space-6) 0;
  }
}
</style>

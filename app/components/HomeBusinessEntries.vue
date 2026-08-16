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
    class="home-entries"
    aria-labelledby="home-entries-title"
    data-testid="home-business-entries"
  >
    <h2 id="home-entries-title" class="home-entries__title">
      自设委托
    </h2>

    <ul class="home-entries__grid" role="list">
      <li class="home-entries__item">
        <article
          class="home-entry"
          :data-entry-kind="commission.kind"
          data-testid="home-business-entry"
        >
          <NuxtLink :to="commission.href" class="home-entry__detail">
            <span class="home-entry__media">
              <ResponsivePicture
                :sources="commission.sources"
                :alt="commission.alt"
                sizes="100vw"
              />
            </span>
          </NuxtLink>

          <span class="home-entry__body">
            <span class="home-entry__heading">
              <span class="home-entry__name">{{ commission.title }}</span>
              <span
                v-if="commission.status"
                class="home-entry__status"
                :data-tone="commission.status.tone"
              >
                <span class="home-entry__status-dot" aria-hidden="true" />
                {{ commission.status.label }}
                <span class="home-entry__status-tone">
                  （{{ TONE_LABELS[commission.status.tone] }}）
                </span>
              </span>
            </span>

            <span v-if="commission.summary" class="home-entry__summary">
              {{ commission.summary }}
            </span>

            <span class="home-entry__actions">
              <NuxtLink :to="commission.href" class="home-entry__action">
                查看详情 <span aria-hidden="true">→</span>
              </NuxtLink>
              <NuxtLink to="/commission/apply" class="home-entry__apply">
                提交委托申请
              </NuxtLink>
            </span>
          </span>
        </article>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.home-entries {
  display: grid;
  gap: var(--space-5);
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: var(--space-9) var(--public-page-padding) 0;
}

.home-entries__title {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-heading);
  letter-spacing: var(--letter-spacing-tight);
}

.home-entries__grid {
  display: grid;
  gap: var(--space-6);
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-entry {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  overflow: hidden;
  color: var(--public-text-primary);
  background: var(--public-bg-primary);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-md);
  transition:
    transform var(--duration-normal) var(--easing-standard),
    border-color var(--duration-fast) var(--easing-standard),
    box-shadow var(--duration-normal) var(--easing-standard);
}

.home-entry:hover {
  color: var(--public-text-primary);
  border-color: var(--public-accent-decorative);
}

.home-entry:focus-within {
  outline: 2px solid var(--public-accent-primary);
  outline-offset: 2px;
}

/**
 * 两卡共用同一比例。
 *
 * 这是业务入口而不是作品展示位，图片只需要点到为止：用较扁的 21:9，
 * 让入口卡不至于在首页抢过上方精选作品的视觉分量。
 */
.home-entry__media {
  display: block;
  aspect-ratio: 21 / 9;
  overflow: hidden;
  background: var(--image-placeholder);
}

.home-entry__detail {
  display: block;
  color: inherit;
}

.home-entry__media :deep(.responsive-picture),
.home-entry__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.home-entry__media :deep(.responsive-picture__image) {
  object-fit: cover;
  transition: transform var(--duration-section) var(--easing-standard);
}

@media (hover: hover) and (pointer: fine) {
  .home-entry:hover {
    transform: translateY(-0.25rem);
    box-shadow: 0 1rem 2.25rem rgb(17 20 25 / 0.12);
  }

  .home-entry:hover .home-entry__media :deep(.responsive-picture__image) {
    transform: scale(var(--image-hover-scale));
  }
}

.home-entry__body {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  padding: var(--space-5);
}

.home-entry__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-3);
}

.home-entry__name {
  font-family: var(--font-public-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: var(--line-height-heading);
}

/* 状态不只用颜色：同时给出圆点、文字标签和中文语义后缀。 */
.home-entry__status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.home-entry__status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: var(--public-text-tertiary);
}

.home-entry__status[data-tone='open'] .home-entry__status-dot {
  background: var(--status-open, #2f7a4d);
}

.home-entry__status[data-tone='limited'] .home-entry__status-dot {
  background: var(--status-limited, #a8701a);
}

.home-entry__status[data-tone='closed'] .home-entry__status-dot {
  background: var(--status-closed, #8a8f98);
}

.home-entry__status-tone {
  color: var(--public-text-tertiary);
  font-size: var(--font-size-xs);
}

.home-entry__summary {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.home-entry__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.home-entry__action,
.home-entry__apply {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  /* 移动端触控目标足够高。 */
  min-height: 2.75rem;
  color: var(--public-accent-primary);
  font-size: var(--font-size-sm);
}

.home-entry__apply {
  justify-content: center;
  min-height: 2.75rem;
  padding: 0 var(--space-5);
  color: var(--public-text-inverse);
  background: var(--public-accent-primary);
  border-radius: var(--radius-full);
  font-weight: 600;
}

.home-entry__apply:hover,
.home-entry__apply:focus-visible {
  color: var(--public-text-inverse);
  background: var(--public-accent-hover);
}

@media (min-width: 768px) {
  .home-entries__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-entry,
  .home-entry__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .home-entry:hover,
  .home-entry:hover .home-entry__media :deep(.responsive-picture__image) {
    transform: none;
  }
}
</style>

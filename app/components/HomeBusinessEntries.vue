<script setup lang="ts">
import type { PublicHomeEntryCardDto } from '~~/shared/types/contracts'

/**
 * T34-F2 统一业务入口：委托投递与领养共用一张卡的比例、间距、文字层级和交互。
 * 每张卡内部同时给出图片、标题、当前状态、一行短说明和单一行动入口；
 * 整张卡是唯一可访问链接，不出现嵌套链接。
 */
const props = defineProps<{
  entries: {
    adoption: PublicHomeEntryCardDto | null
    commission: PublicHomeEntryCardDto | null
  }
}>()

const cards = computed(() => [
  props.entries.commission,
  props.entries.adoption,
].filter((card): card is PublicHomeEntryCardDto => card !== null))

const TONE_LABELS = {
  open: '开放中',
  limited: '有限开放',
  closed: '暂不开放',
} as const
</script>

<template>
  <section
    v-if="cards.length > 0"
    class="home-entries"
    aria-labelledby="home-entries-title"
    data-testid="home-business-entries"
  >
    <h2 id="home-entries-title" class="home-entries__title">
      委托投递
    </h2>

    <ul class="home-entries__grid" role="list">
      <li v-for="card in cards" :key="card.kind" class="home-entries__item">
        <NuxtLink
          :to="card.href"
          class="home-entry"
          :data-entry-kind="card.kind"
          data-testid="home-business-entry"
        >
          <span class="home-entry__media">
            <ResponsivePicture
              :sources="card.sources"
              :alt="card.alt"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </span>

          <span class="home-entry__body">
            <span class="home-entry__heading">
              <span class="home-entry__name">{{ card.title }}</span>
              <span
                v-if="card.status"
                class="home-entry__status"
                :data-tone="card.status.tone"
              >
                <span class="home-entry__status-dot" aria-hidden="true" />
                {{ card.status.label }}
                <span class="home-entry__status-tone">
                  （{{ TONE_LABELS[card.status.tone] }}）
                </span>
              </span>
            </span>

            <span v-if="card.summary" class="home-entry__summary">
              {{ card.summary }}
            </span>

            <span class="home-entry__action">
              查看详情 <span aria-hidden="true">→</span>
            </span>
          </span>
        </NuxtLink>
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
}

.home-entry:hover {
  color: var(--public-text-primary);
  border-color: var(--public-accent-decorative);
}

.home-entry:focus-visible {
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

.home-entry__media :deep(.responsive-picture),
.home-entry__media :deep(.responsive-picture__image) {
  width: 100%;
  height: 100%;
}

.home-entry__media :deep(.responsive-picture__image) {
  object-fit: cover;
  transition: transform var(--duration-section) var(--easing-standard);
}

.home-entry:hover .home-entry__media :deep(.responsive-picture__image) {
  transform: scale(var(--image-hover-scale));
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

.home-entry__action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  /* 移动端触控目标足够高。 */
  min-height: 2.75rem;
  color: var(--public-accent-primary);
  font-size: var(--font-size-sm);
}

@media (min-width: 768px) {
  .home-entries__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-entries__grid > :only-child {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-entry__media :deep(.responsive-picture__image) {
    transition: none;
  }

  .home-entry:hover .home-entry__media :deep(.responsive-picture__image) {
    transform: none;
  }
}
</style>

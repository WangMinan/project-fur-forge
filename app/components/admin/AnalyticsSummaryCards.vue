<script setup lang="ts">
import type { AnalyticsOverviewDto } from '~~/shared/types/contracts'

defineProps<{
  ranges: AnalyticsOverviewDto['ranges']
}>()

const periods = [
  { key: 'today', label: '今日' },
  { key: 'sevenDays', label: '近 7 日' },
  { key: 'thirtyDays', label: '近 30 日' },
] as const
</script>

<template>
  <section class="analytics-summary" aria-labelledby="analytics-summary-title">
    <h2 id="analytics-summary-title" class="analytics-summary__heading">访问摘要</h2>
    <div class="analytics-summary__grid">
      <article v-for="period in periods" :key="period.key" class="analytics-summary__card">
        <h3 class="analytics-summary__period">{{ period.label }}</h3>
        <p class="analytics-summary__primary">
          <strong>{{ ranges[period.key].pageViews }}</strong>
          <span>次页面浏览</span>
        </p>
        <dl class="analytics-summary__facts">
          <div>
            <dt>大约会话</dt>
            <dd>{{ ranges[period.key].approximateSessions }}</dd>
          </div>
          <div>
            <dt>联系行动</dt>
            <dd>{{ ranges[period.key].contactActions }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>

<style scoped>
.analytics-summary,
.analytics-summary__card {
  display: grid;
  gap: var(--admin-space-3);
}

.analytics-summary__heading,
.analytics-summary__period,
.analytics-summary__primary,
.analytics-summary__facts {
  margin: 0;
}

.analytics-summary__heading {
  font-size: var(--admin-font-md);
}

.analytics-summary__grid {
  display: grid;
  gap: var(--admin-space-3);
}

.analytics-summary__card {
  padding: var(--admin-space-5);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
}

.analytics-summary__period {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.analytics-summary__primary {
  display: flex;
  align-items: baseline;
  gap: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.analytics-summary__primary strong {
  color: var(--admin-text-primary);
  font-size: 2rem;
  line-height: var(--admin-line-tight);
}

.analytics-summary__facts {
  display: flex;
  gap: var(--admin-space-5);
}

.analytics-summary__facts div {
  display: grid;
  gap: var(--admin-space-1);
}

.analytics-summary__facts dt {
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
}

.analytics-summary__facts dd {
  margin: 0;
  font-weight: 600;
}

@media (min-width: 768px) {
  .analytics-summary__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>

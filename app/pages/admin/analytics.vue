<script setup lang="ts">
import type { AnalyticsOverviewDto } from '~~/shared/types/contracts'
import type { DeepReadonly } from 'vue'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '访问概览',
  robots: 'noindex, nofollow',
})

const { analytics, load, pageStatus } = useAdminAnalytics()

function pageRankingItems(value: DeepReadonly<AnalyticsOverviewDto>) {
  return value.topPages.map(item => ({
    key: item.routeKey,
    label: item.label,
    value: item.views,
  }))
}

function contentRankingItems(
  items: DeepReadonly<AnalyticsOverviewDto['topWorks']>,
) {
  return items.map(item => ({
    href: item.href,
    key: item.id,
    label: item.label,
    value: item.views,
  }))
}

function contactRankingItems(value: DeepReadonly<AnalyticsOverviewDto>) {
  return value.contactActions.map(item => ({
    key: item.actionKey,
    label: item.label,
    value: item.count,
  }))
}

onMounted(() => void load())
</script>

<template>
  <AdminShell current="analytics">
    <div class="analytics-page" data-testid="analytics-page">
      <header class="analytics-page__header">
        <div>
          <h1 class="analytics-page__title">访问概览</h1>
          <p class="analytics-page__meta">
            统计时区：中国标准时间（Asia/Shanghai）；原始事件保留 90 天。
          </p>
        </div>
        <button
          type="button"
          class="analytics-page__refresh"
          :disabled="pageStatus === 'loading'"
          @click="load"
        >{{ pageStatus === 'loading' ? '刷新中…' : '刷新' }}</button>
      </header>

      <div v-if="pageStatus === 'loading' && !analytics" class="analytics-page__state" role="status">
        正在加载访问统计…
      </div>
      <div v-else-if="pageStatus === 'error' && !analytics" class="analytics-page__state" role="alert">
        <p>访问统计加载失败。</p>
        <button type="button" class="analytics-page__refresh" @click="load">重试</button>
      </div>

      <template v-else-if="analytics">
        <p v-if="pageStatus === 'error'" class="analytics-page__warning" role="alert">
          刷新失败，当前显示上一次加载的结果。
        </p>
        <AdminAnalyticsSummaryCards :ranges="analytics.ranges" />

        <section class="analytics-page__rankings" aria-label="近 30 日排名">
          <AdminAnalyticsRankingList
            title="页面访问·近 30 日"
            empty-text="近 30 日还没有页面访问。"
            :items="pageRankingItems(analytics)"
          />
          <AdminAnalyticsRankingList
            title="作品详情·近 30 日"
            empty-text="近 30 日还没有作品详情访问。"
            :items="contentRankingItems(analytics.topWorks)"
          />
          <AdminAnalyticsRankingList
            title="返图设定·近 30 日"
            empty-text="近 30 日还没有返图设定访问。"
            :items="contentRankingItems(analytics.topReturnCharacters)"
          />
          <AdminAnalyticsRankingList
            title="联系行动·近 30 日"
            empty-text="近 30 日还没有联系行动。"
            :items="contactRankingItems(analytics)"
          />
        </section>
      </template>
    </div>
  </AdminShell>
</template>

<style scoped>
.analytics-page {
  display: grid;
  gap: var(--admin-space-5);
  max-width: var(--admin-content-max);
}

.analytics-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--admin-space-4);
  flex-wrap: wrap;
}

.analytics-page__title,
.analytics-page__meta,
.analytics-page__state p,
.analytics-page__privacy h2,
.analytics-page__privacy p,
.analytics-page__warning {
  margin: 0;
}

.analytics-page__title {
  font-size: var(--admin-font-xl);
  line-height: var(--admin-line-tight);
}

.analytics-page__meta {
  margin-top: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.analytics-page__refresh {
  min-height: var(--admin-touch-target);
  padding: 0 var(--admin-space-4);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.analytics-page__refresh:disabled {
  cursor: default;
  opacity: 0.6;
}

.analytics-page__state,
.analytics-page__privacy {
  display: grid;
  justify-items: start;
  gap: var(--admin-space-3);
  padding: var(--admin-space-5);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.analytics-page__warning {
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-warning-soft);
  color: var(--admin-status-warning);
  font-size: var(--admin-font-sm);
}

.analytics-page__rankings {
  display: grid;
  gap: var(--admin-space-3);
}

.analytics-page__privacy h2 {
  color: var(--admin-text-primary);
  font-size: var(--admin-font-md);
}

@media (min-width: 1024px) {
  .analytics-page__rankings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

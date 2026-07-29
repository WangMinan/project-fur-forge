<script setup lang="ts">
import { adminWorkFixtures, summarizeAssets } from '~~/shared/fixtures/visual-admin'
import {
  BUSINESS_STATUS_LABELS,
  PUBLICATION_STATUS_LABELS,
  SUIT_TYPE_LABELS,
  WORK_PURPOSE_LABELS,
} from '~/utils/work-labels'
import { formatCnyMinorUnits } from '~/utils/format'

definePageMeta({
  ssr: false,
})

useSeoMeta({
  title: '作品管理',
  robots: 'noindex, nofollow',
})

const route = useRoute()
const showEmptyState = computed(() => route.query.state === 'empty')

const works = adminWorkFixtures

const PUBLICATION_TONES = {
  draft: 'warning',
  published: 'success',
  unpublished: 'neutral',
} as const

const BUSINESS_TONES = {
  preparing: 'info',
  available: 'success',
  event_sale: 'info',
  scheduled: 'info',
  in_production: 'info',
  delivered: 'neutral',
} as const
</script>

<template>
  <AdminShell current="works">
    <div class="works-page">
      <header class="works-page__header">
        <h1 class="works-page__title">作品</h1>
        <p class="works-page__meta">
          共 {{ showEmptyState ? 0 : works.length }} 件 · 夹具演示数据（T17 接入真实保存）
        </p>
      </header>

      <div v-if="showEmptyState" class="works-page__empty">
        <p class="works-page__empty-title">暂无作品</p>
        <p class="works-page__empty-text">真实保存能力将随 T17 接入，当前仅展示夹具数据。</p>
      </div>

      <template v-else>
        <table class="works-table">
          <caption class="sr-only">作品列表（夹具演示数据）</caption>
          <thead>
            <tr>
              <th scope="col">作品</th>
              <th scope="col">用途</th>
              <th scope="col">发布状态</th>
              <th scope="col">业务状态</th>
              <th scope="col">价格</th>
              <th scope="col">图片</th>
              <th scope="col"><span class="sr-only">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="work in works" :key="work.dto.id">
              <td>
                <div class="works-table__work">
                  <span class="works-table__thumb">
                    <img
                      v-if="work.thumb"
                      :src="work.thumb.src"
                      :alt="work.thumb.alt"
                      width="56"
                      height="75"
                      loading="lazy"
                    >
                  </span>
                  <span class="works-table__name">
                    <NuxtLink :to="`/admin/works/${work.dto.id}`" class="works-table__link">
                      {{ work.dto.characterName }}
                    </NuxtLink>
                    <span class="works-table__species">
                      {{ work.dto.species }} · {{ SUIT_TYPE_LABELS[work.dto.suitType] }}
                      <template v-if="work.isFeatured">· 精选</template>
                    </span>
                  </span>
                </div>
              </td>
              <td>{{ WORK_PURPOSE_LABELS[work.dto.purpose] }}</td>
              <td>
                <AdminStatusBadge
                  :tone="PUBLICATION_TONES[work.dto.publicationStatus]"
                  :label="PUBLICATION_STATUS_LABELS[work.dto.publicationStatus]"
                />
              </td>
              <td>
                <AdminStatusBadge
                  v-if="work.dto.purpose === 'adoption' && work.dto.businessStatus"
                  :tone="BUSINESS_TONES[work.dto.businessStatus]"
                  :label="BUSINESS_STATUS_LABELS[work.dto.businessStatus]"
                />
                <span v-else class="works-table__dash">—</span>
              </td>
              <td>
                <template v-if="work.dto.purpose === 'adoption' && work.dto.priceCnyMinor != null">
                  {{ formatCnyMinorUnits(work.dto.priceCnyMinor) }}
                </template>
                <span v-else class="works-table__dash">—</span>
              </td>
              <td>
                <span class="works-table__media">
                  {{ summarizeAssets(work.assets).ready }}/{{ work.assets.length }} READY
                  <template v-if="summarizeAssets(work.assets).failed > 0">
                    · <span class="works-table__media-failed">{{ summarizeAssets(work.assets).failed }} 失败</span>
                  </template>
                  <template v-else-if="summarizeAssets(work.assets).processing > 0">
                    · {{ summarizeAssets(work.assets).processing }} 处理中
                  </template>
                </span>
              </td>
              <td>
                <NuxtLink :to="`/admin/works/${work.dto.id}`" class="works-table__edit">编辑</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>

        <ul class="works-cards" role="list">
          <li v-for="work in works" :key="work.dto.id" class="works-card">
            <span class="works-card__thumb">
              <img
                v-if="work.thumb"
                :src="work.thumb.src"
                :alt="work.thumb.alt"
                width="64"
                height="85"
                loading="lazy"
              >
            </span>
            <div class="works-card__body">
              <p class="works-card__name">
                {{ work.dto.characterName }}
                <span class="works-card__meta">{{ work.dto.species }} · {{ SUIT_TYPE_LABELS[work.dto.suitType] }}</span>
              </p>
              <p class="works-card__row">
                {{ WORK_PURPOSE_LABELS[work.dto.purpose] }}
                <AdminStatusBadge
                  :tone="PUBLICATION_TONES[work.dto.publicationStatus]"
                  :label="PUBLICATION_STATUS_LABELS[work.dto.publicationStatus]"
                />
                <AdminStatusBadge
                  v-if="work.dto.purpose === 'adoption' && work.dto.businessStatus"
                  :tone="BUSINESS_TONES[work.dto.businessStatus]"
                  :label="BUSINESS_STATUS_LABELS[work.dto.businessStatus]"
                />
              </p>
              <p class="works-card__row works-card__row--muted">
                {{ summarizeAssets(work.assets).ready }}/{{ work.assets.length }} 图片 READY
                <template v-if="work.dto.purpose === 'adoption' && work.dto.priceCnyMinor != null">
                  · {{ formatCnyMinorUnits(work.dto.priceCnyMinor) }}
                </template>
                <template v-if="work.isFeatured">· 精选</template>
              </p>
            </div>
            <NuxtLink :to="`/admin/works/${work.dto.id}`" class="works-card__edit">编辑</NuxtLink>
          </li>
        </ul>
      </template>
    </div>
  </AdminShell>
</template>

<style scoped>
.works-page {
  max-width: var(--admin-content-max);
}

.works-page__header {
  display: flex;
  align-items: baseline;
  gap: var(--admin-space-4);
  flex-wrap: wrap;
  margin-bottom: var(--admin-space-5);
}

.works-page__title {
  margin: 0;
  font-size: var(--admin-font-xl);
  font-weight: 600;
  line-height: var(--admin-line-tight);
}

.works-page__meta {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.works-page__empty {
  background: var(--admin-bg-primary);
  border: 1px dashed var(--admin-border-primary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-8);
  text-align: center;
}

.works-page__empty-title {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.works-page__empty-text {
  margin: var(--admin-space-2) 0 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.works-table {
  display: none;
  width: 100%;
  border-collapse: collapse;
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
}

.works-table th {
  text-align: left;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  color: var(--admin-text-secondary);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-bottom: 1px solid var(--admin-border-secondary);
  white-space: nowrap;
}

.works-table td {
  padding: var(--admin-space-3) var(--admin-space-4);
  border-bottom: 1px solid var(--admin-border-secondary);
  font-size: var(--admin-font-sm);
  vertical-align: middle;
}

.works-table tbody tr:last-child td {
  border-bottom: none;
}

.works-table tbody tr:hover {
  background: var(--admin-bg-workspace);
}

.works-table__work {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
}

.works-table__thumb {
  flex: none;
  width: 3.5rem;
  height: 4.7rem;
  border-radius: var(--admin-radius-sm);
  overflow: hidden;
  background: var(--admin-bg-subtle);
}

.works-table__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.works-table__name {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.works-table__link {
  font-weight: 600;
  color: var(--admin-text-primary);
}

.works-table__link:hover {
  color: var(--admin-accent-primary);
}

.works-table__species {
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.works-table__dash {
  color: var(--admin-text-tertiary);
}

.works-table__media {
  white-space: nowrap;
  color: var(--admin-text-secondary);
}

.works-table__media-failed {
  color: var(--admin-status-error);
  font-weight: 600;
}

.works-table__edit {
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-touch-target);
  color: var(--admin-accent-primary);
  font-weight: 600;
  white-space: nowrap;
}

.works-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--admin-space-3);
}

.works-card {
  display: flex;
  gap: var(--admin-space-3);
  align-items: flex-start;
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  padding: var(--admin-space-3);
}

.works-card__thumb {
  flex: none;
  width: 4rem;
  height: 5.3rem;
  border-radius: var(--admin-radius-sm);
  overflow: hidden;
  background: var(--admin-bg-subtle);
}

.works-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.works-card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
}

.works-card__name {
  margin: 0;
  font-weight: 600;
}

.works-card__meta {
  display: block;
  font-weight: 400;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.works-card__row {
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
  font-size: var(--admin-font-sm);
}

.works-card__row--muted {
  font-size: var(--admin-font-xs);
  color: var(--admin-text-secondary);
}

.works-card__edit {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-touch-target);
  color: var(--admin-accent-primary);
  font-weight: 600;
}

@media (min-width: 1024px) {
  .works-table {
    display: table;
  }

  .works-cards {
    display: none;
  }
}
</style>

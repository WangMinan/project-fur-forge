<script setup lang="ts">
import type {
  HeroOrientation,
  HeroPlacement,
} from '~~/shared/types/contracts'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '大图管理',
  robots: 'noindex, nofollow',
})

interface OrientationSummary {
  enabledCount: number
  hasOperation: boolean
  limit: number
  orientation: HeroOrientation
  status: 'error' | 'loading' | 'ready'
}

const PLACEMENTS = [
  { key: 'home', label: '首页大图' },
  { key: 'commission', label: '委托页大图' },
] as const
const ORIENTATIONS = [
  { key: 'landscape', label: '横版', frame: '桌面 16:9' },
  { key: 'portrait', label: '竖版', frame: '手机 9:16' },
] as const

const route = useRoute()
const legacyTab = computed(() => {
  const value = typeof route.query.tab === 'string' ? route.query.tab : ''
  const [placement, orientation] = value.split('-')
  return {
    placement: placement === 'commission' ? 'commission' : 'home',
    orientation: orientation === 'portrait' ? 'portrait' : 'landscape',
  } as const
})
const placement = computed<HeroPlacement>(() => (
  route.query.placement === 'commission'
    ? 'commission'
    : route.query.placement === 'home'
      ? 'home'
      : legacyTab.value.placement
))
const orientation = computed<HeroOrientation>(() => (
  route.query.orientation === 'portrait'
    ? 'portrait'
    : route.query.orientation === 'landscape'
      ? 'landscape'
      : legacyTab.value.orientation
))
const summaries = reactive<Record<HeroOrientation, OrientationSummary>>({
  landscape: {
    enabledCount: 0,
    hasOperation: false,
    limit: 5,
    orientation: 'landscape',
    status: 'loading',
  },
  portrait: {
    enabledCount: 0,
    hasOperation: false,
    limit: 5,
    orientation: 'portrait',
    status: 'loading',
  },
})

function placementTo(next: HeroPlacement) {
  return {
    path: '/admin/site/home',
    query: { placement: next, orientation: orientation.value },
  }
}

function orientationTo(next: HeroOrientation) {
  return {
    path: '/admin/site/home',
    query: {
      placement: placement.value,
      orientation: next,
    },
  }
}

function updateSummary(summary: OrientationSummary) {
  summaries[summary.orientation] = summary
}

watch(placement, () => {
  for (const current of Object.values(summaries)) {
    current.enabledCount = 0
    current.hasOperation = false
    current.limit = placement.value === 'commission' ? 1 : 5
    current.status = 'loading'
  }
})
</script>

<template>
  <AdminShell current="home">
    <div class="hero-admin admin-list-page" data-testid="home-admin">
      <AdminPageHeader title="大图管理" />

      <div class="hero-admin__toolbar">
        <div class="hero-admin__placement">
          <label class="admin-list-toolbar__label" for="hero-placement">使用页面</label>
          <AdminSelect
            id="hero-placement"
            :model-value="placement"
            :options="PLACEMENTS.map(item => ({ value: item.key, label: item.label }))"
            @update:model-value="navigateTo(placementTo($event))"
          />
        </div>
        <div class="hero-admin__formats">
          <span class="admin-list-toolbar__label">画幅 · 已启用数量</span>
          <nav class="hero-admin__orientation-tabs" aria-label="设备画框与图片方向">
            <NuxtLink
              v-for="item in ORIENTATIONS"
              :key="item.key"
              class="hero-admin__orientation-tab"
              :to="orientationTo(item.key)"
              :aria-current="orientation === item.key ? 'page' : undefined"
            >
              <span class="hero-admin__frame-icon" :data-orientation="item.key" aria-hidden="true" />
              <span>{{ item.label }}</span>
              <span>{{ item.frame }}</span>
              <span class="hero-admin__count">
                {{ summaries[item.key].status === 'loading' ? '加载中…'
                  : summaries[item.key].status === 'error' ? '读取失败'
                    : `${summaries[item.key].enabledCount}/${summaries[item.key].limit}` }}
              </span>
              <span v-if="summaries[item.key].hasOperation" class="hero-admin__operation">处理中</span>
            </NuxtLink>
          </nav>
        </div>
      </div>

      <div
        class="hero-admin__editors"
        :data-placement="placement"
        :data-active-orientation="orientation"
      >
        <div
          v-for="item in ORIENTATIONS"
          v-show="orientation === item.key"
          :key="`${placement}-${item.key}`"
          class="hero-admin__editor"
          :data-selected="orientation === item.key"
        >
          <AdminHeroCollectionEditor
            :placement="placement"
            :orientation="item.key"
            @summary="updateSummary"
          />
        </div>
      </div>
    </div>
  </AdminShell>
</template>

<style scoped>
.hero-admin__toolbar {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: var(--admin-space-5) var(--admin-space-7);
  margin-bottom: var(--admin-space-5);
}
.hero-admin__placement { flex: 0 1 15rem; min-width: 12rem; }
.hero-admin__formats { min-width: 0; }
.hero-admin__orientation-tabs { display: flex; gap: var(--admin-space-3); }
.hero-admin__orientation-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--admin-space-2);
  min-height: var(--admin-touch-target);
  padding: var(--admin-space-2) var(--admin-space-3);
  border-bottom: 2px solid transparent;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}
.hero-admin__orientation-tab[aria-current='page'] { color: var(--admin-accent-primary); border-bottom-color: currentcolor; }
.hero-admin__count { font-variant-numeric: tabular-nums; }
.hero-admin__operation { color: var(--admin-status-info); }
.hero-admin__frame-icon { flex: none; width: 1.25rem; height: 0.8rem; border: 1px solid currentcolor; border-radius: 2px; }
.hero-admin__frame-icon[data-orientation='portrait'] { width: 0.8rem; height: 1.25rem; }
.hero-admin__editors, .hero-admin__editor { min-width: 0; }
@media (hover: hover) {
  .hero-admin__orientation-tab:hover { color: var(--admin-accent-primary); background: var(--ui-bg-hover); }
}
@media (max-width: 767px) {
  .hero-admin__toolbar { gap: var(--admin-space-4); }
  .hero-admin__placement, .hero-admin__formats { flex: 1 1 100%; }
  .hero-admin__orientation-tabs { gap: var(--admin-space-2); }
  .hero-admin__orientation-tab { flex: 1; padding-inline: var(--admin-space-2); flex-wrap: wrap; }
}
</style>

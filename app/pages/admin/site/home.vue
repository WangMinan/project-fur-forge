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
  ready: boolean
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
    ready: false,
  },
  portrait: {
    enabledCount: 0,
    hasOperation: false,
    limit: 5,
    orientation: 'portrait',
    ready: false,
  },
})

function placementTo(next: HeroPlacement) {
  return next === 'home'
    ? '/admin/site/home'
    : {
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
    current.ready = false
  }
})
</script>

<template>
  <AdminShell current="home">
    <div class="hero-admin" data-testid="home-admin">
      <header class="hero-admin__header">
        <h1>大图管理</h1>
        <p>首页每个方向独立维护 1–5 张轮播；委托页横版与竖版各自维护一个可下架替换的单槽。</p>
      </header>

      <nav class="hero-admin__placement-tabs" aria-label="大图页面">
        <NuxtLink
          v-for="item in PLACEMENTS"
          :key="item.key"
          class="hero-admin__placement-tab"
          :to="placementTo(item.key)"
          :aria-current="placement === item.key ? 'page' : undefined"
        >{{ item.label }}</NuxtLink>
      </nav>

      <section class="hero-admin__workspace" :aria-label="placement === 'home' ? '首页大图' : '委托页大图'">
        <header class="hero-admin__workspace-head">
          <div>
            <h2>{{ placement === 'home' ? '首页大图' : '委托页大图' }}</h2>
            <p class="hero-admin__summary" role="status">
              横版 {{ summaries.landscape.enabledCount }}/{{ summaries.landscape.limit }}
              <span aria-hidden="true">·</span>
              竖版 {{ summaries.portrait.enabledCount }}/{{ summaries.portrait.limit }}
              <template v-if="summaries.landscape.hasOperation || summaries.portrait.hasOperation">
                <span aria-hidden="true">·</span> 有长任务进行中
              </template>
            </p>
          </div>
        </header>

        <nav class="hero-admin__orientation-tabs" aria-label="设备画框与图片方向">
          <NuxtLink
            v-for="item in ORIENTATIONS"
            :key="item.key"
            class="hero-admin__orientation-tab"
            :to="orientationTo(item.key)"
            :aria-current="orientation === item.key ? 'page' : undefined"
          >
            <span>{{ item.label }}</span>
            <small>{{ item.frame }}</small>
            <span class="hero-admin__orientation-state">
              {{ summaries[item.key].ready ? '已就绪' : '待检查' }}
            </span>
          </NuxtLink>
        </nav>

        <div
          class="hero-admin__editors"
          :data-placement="placement"
          :data-active-orientation="orientation"
        >
          <div
            v-for="item in ORIENTATIONS"
            v-show="placement === 'commission' || orientation === item.key"
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
      </section>
    </div>
  </AdminShell>
</template>

<style scoped>
.hero-admin,
.hero-admin__workspace {
  display: grid;
  gap: var(--admin-space-4);
}

.hero-admin {
  max-width: 92rem;
}

.hero-admin__header,
.hero-admin__workspace-head > div {
  display: grid;
  gap: var(--admin-space-1);
}

.hero-admin h1,
.hero-admin h2,
.hero-admin p {
  margin: 0;
}

.hero-admin__header p,
.hero-admin__summary {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.hero-admin__placement-tabs,
.hero-admin__orientation-tabs {
  display: grid;
  gap: var(--admin-space-1);
  padding: var(--admin-space-1);
  background: var(--admin-bg-subtle);
  border-radius: var(--admin-radius-md);
}

.hero-admin__placement-tabs,
.hero-admin__orientation-tabs {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.hero-admin__placement-tab,
.hero-admin__orientation-tab {
  display: grid;
  min-height: var(--admin-touch-target);
  padding: var(--admin-space-2) var(--admin-space-3);
  color: var(--admin-text-secondary);
  border: 1px solid transparent;
  border-radius: var(--admin-radius-sm);
  font-size: var(--admin-font-sm);
  font-weight: 600;
  place-items: center;
  text-align: center;
}

.hero-admin__orientation-tab {
  grid-template-columns: auto auto;
  gap: 0 var(--admin-space-2);
}

.hero-admin__orientation-tab small,
.hero-admin__orientation-state {
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
  font-weight: 400;
}

.hero-admin__orientation-state {
  grid-column: 1 / -1;
}

.hero-admin__placement-tab[aria-current='page'],
.hero-admin__orientation-tab[aria-current='page'] {
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
  border-color: var(--admin-border-primary);
  box-shadow: 0 1px 3px rgb(25 31 42 / 0.1);
}

.hero-admin__workspace,
.hero-admin__editors,
.hero-admin__editor {
  min-width: 0;
}

.hero-admin__editor[data-selected='true'] :deep(.hero-collection-editor) {
  border-color: var(--admin-accent-decorative);
}

@media (min-width: 960px) {
  .hero-admin__editors[data-placement='commission'] {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--admin-space-4);
    align-items: start;
  }
}
</style>

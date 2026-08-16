<script setup lang="ts">
import type {
  HeroOrientation,
  HeroPlacement,
} from '~~/shared/types/contracts'
import type { HeroCollectionItemInput } from '~/composables/useAdminHeroCollection'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '大图管理',
  robots: 'noindex, nofollow',
})

const TABS = [
  { key: 'home-landscape', label: '首页大图 / 横版', placement: 'home', orientation: 'landscape' },
  { key: 'home-portrait', label: '首页大图 / 竖版', placement: 'home', orientation: 'portrait' },
  { key: 'commission-landscape', label: '委托页大图 / 横版', placement: 'commission', orientation: 'landscape' },
  { key: 'commission-portrait', label: '委托页大图 / 竖版', placement: 'commission', orientation: 'portrait' },
] as const

const route = useRoute()
const activeTab = computed(() => (
  TABS.find(tab => tab.key === route.query.tab) ?? TABS[0]
))
const placement = computed<HeroPlacement>(() => activeTab.value.placement)
const orientation = computed<HeroOrientation>(() => activeTab.value.orientation)
const {
  collection,
  conflictNotice,
  createItem,
  deleteItem,
  feedback,
  load,
  loadPreview,
  mutating,
  operations,
  pageStatus,
  previewPending,
  previews,
  reorder,
  retryOperation,
  startOperation,
  updateItem,
} = useAdminHeroCollection(placement, orientation)

const actionError = ref<string | null>(null)
const showDraft = ref(false)
const enabledItems = computed(() => (
  collection.value?.items
    .filter(item => item.enabled)
    .toSorted((left, right) => left.sortOrder - right.sortOrder) ?? []
))
const nextSortOrder = computed(() => {
  const used = new Set(enabledItems.value.map(item => item.sortOrder))
  return [0, 1, 2, 3, 4].find(value => !used.has(value)) ?? 4
})
const dialogOpen = computed(() => Boolean(actionError.value || conflictNotice.value))

watch(activeTab, () => {
  showDraft.value = false
  actionError.value = null
})

function moveState(id: string) {
  const index = enabledItems.value.findIndex(item => item.id === id)
  return {
    canMoveUp: index > 0,
    canMoveDown: index >= 0 && index < enabledItems.value.length - 1,
  }
}

async function onCreate(payload: HeroCollectionItemInput) {
  actionError.value = await createItem(payload)
  if (!actionError.value) {
    showDraft.value = false
  }
}

async function onMove(id: string, direction: -1 | 1) {
  const ids = enabledItems.value.map(item => item.id)
  const index = ids.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= ids.length) {
    return
  }
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  actionError.value = await reorder(ids)
}

async function run(action: () => Promise<string | null>) {
  actionError.value = await action()
}

function closeDialog() {
  actionError.value = null
  conflictNotice.value = null
}

onMounted(() => void load())
</script>

<template>
  <AdminShell current="home">
    <div class="hero-admin" data-testid="home-admin">
      <header class="hero-admin__header">
        <h1>大图管理</h1>
        <p>四个集合独立上传、排序、适配、预览与发布；每次写入只更新当前集合版本。</p>
      </header>

      <nav class="hero-admin__tabs" aria-label="大图集合">
        <NuxtLink
          v-for="tab in TABS"
          :key="tab.key"
          class="hero-admin__tab"
          :to="tab === TABS[0]
            ? '/admin/site/home'
            : { path: '/admin/site/home', query: { tab: tab.key } }"
          :aria-current="activeTab.key === tab.key ? 'page' : undefined"
        >{{ tab.label }}</NuxtLink>
      </nav>

      <Transition name="hero-collection" mode="out-in">
        <section :key="activeTab.key" class="hero-admin__collection" :aria-label="activeTab.label">
          <p v-if="pageStatus === 'loading'" role="status">正在加载{{ activeTab.label }}…</p>
          <p v-else-if="pageStatus === 'error'" role="alert">加载失败，请刷新重试。</p>
          <template v-else-if="collection">
            <header class="hero-admin__collection-head">
              <div>
                <h2>{{ activeTab.label }}</h2>
                <p role="status">已启用 {{ enabledItems.length }} / 5 · collection v{{ collection.version }}</p>
              </div>
              <button
                v-if="!showDraft"
                type="button"
                :disabled="mutating"
                @click="showDraft = true"
              >新增大图项</button>
            </header>

            <p v-if="collection.items.length === 0 && !showDraft" class="hero-admin__empty">
              当前集合为空。上传与方向匹配的图片后可发布。
            </p>

            <TransitionGroup name="hero-item-list" tag="div" class="hero-admin__items">
              <AdminHeroCollectionItemCard
                v-for="item in collection.items"
                :key="item.id"
                :item="item"
                :placement="placement"
                :orientation="orientation"
                :collection-version="collection.version"
                :mutating="mutating"
                :operation="operations[item.id] ?? null"
                :feedback="feedback[item.id] ?? null"
                :preview="previews[item.id] ?? null"
                :preview-pending="previewPending[item.id] ?? false"
                :can-move-up="moveState(item.id).canMoveUp"
                :can-move-down="moveState(item.id).canMoveDown"
                @update="payload => run(() => updateItem(item.id, payload))"
                @delete="run(() => deleteItem(item.id))"
                @enable="run(() => startOperation(item.id, 'enable'))"
                @disable="run(() => startOperation(item.id, 'disable'))"
                @upscale="run(() => startOperation(item.id, 'upscale'))"
                @load-preview="run(() => loadPreview(item.id))"
                @retry-operation="run(() => retryOperation(item.id))"
                @move="direction => onMove(item.id, direction)"
                @conflict="load()"
              />
              <AdminHeroCollectionItemCard
                v-if="showDraft"
                key="hero-item-draft"
                :item="null"
                :placement="placement"
                :orientation="orientation"
                :collection-version="collection.version"
                :default-sort-order="nextSortOrder"
                :mutating="mutating"
                @create="onCreate"
                @conflict="load()"
              />
            </TransitionGroup>
          </template>
        </section>
      </Transition>

      <AdminConfirmDialog
        :open="dialogOpen"
        title="操作未完成"
        confirm-label="知道了"
        :show-cancel="false"
        @confirm="closeDialog"
        @cancel="closeDialog"
      >
        <p v-if="actionError" role="alert">{{ actionError }}</p>
        <p v-if="conflictNotice" role="alert">{{ conflictNotice }}</p>
      </AdminConfirmDialog>
    </div>
  </AdminShell>
</template>

<style scoped>
.hero-admin,
.hero-admin__collection,
.hero-admin__items {
  display: grid;
  gap: var(--admin-space-4);
}

.hero-admin {
  max-width: 72rem;
}

.hero-admin__header,
.hero-admin__collection-head div {
  display: grid;
  gap: var(--admin-space-1);
}

.hero-admin h1,
.hero-admin h2,
.hero-admin p {
  margin: 0;
}

.hero-admin__header p,
.hero-admin__collection-head p,
.hero-admin__empty {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.hero-admin__tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--admin-space-1);
  padding: var(--admin-space-1);
  background: var(--admin-bg-subtle);
  border-radius: var(--admin-radius-md);
}

.hero-admin__tab {
  display: grid;
  min-height: var(--admin-touch-target);
  padding: var(--admin-space-2) var(--admin-space-3);
  color: var(--admin-text-secondary);
  border-radius: var(--admin-radius-sm);
  font-size: var(--admin-font-xs);
  font-weight: 600;
  place-items: center;
  text-align: center;
}

.hero-admin__tab[aria-current='page'] {
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
  box-shadow: 0 1px 3px rgb(25 31 42 / 0.1);
}

.hero-admin__collection-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-3);
}

.hero-admin__collection-head button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  font: inherit;
  cursor: pointer;
}

.hero-item-list-move {
  transition: transform var(--admin-duration-normal) var(--admin-easing);
}

.hero-collection-enter-active,
.hero-collection-leave-active {
  transition: opacity var(--admin-duration-fast) var(--admin-easing);
}

.hero-collection-enter-from,
.hero-collection-leave-to {
  opacity: 0;
}

@media (min-width: 900px) {
  .hero-admin__tabs {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-item-list-move,
  .hero-collection-enter-active,
  .hero-collection-leave-active {
    transition: none;
  }
}
</style>

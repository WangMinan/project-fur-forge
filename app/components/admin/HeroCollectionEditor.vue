<script setup lang="ts">
import type {
  HeroOrientation,
  HeroPlacement,
} from '~~/shared/types/contracts'
import type { HeroCollectionItemInput } from '~/composables/useAdminHeroCollection'

const props = defineProps<{
  orientation: HeroOrientation
  placement: HeroPlacement
}>()

const emit = defineEmits<{
  summary: [summary: {
    enabledCount: number
    hasOperation: boolean
    limit: number
    orientation: HeroOrientation
    ready: boolean
  }]
}>()

const {
  collection,
  conflictNotice,
  createItem,
  deleteItem,
  feedback,
  load,
  mutating,
  operations,
  pageStatus,
  reorder,
  retryOperation,
  startOperation,
  updateItem,
} = useAdminHeroCollection(() => props.placement, () => props.orientation)

const actionError = shallowRef<string | null>(null)
const showDraft = shallowRef(false)
const slotLimit = computed(() => props.placement === 'commission' ? 1 : 5)
const enabledItems = computed(() => (
  collection.value?.items
    .filter(item => item.enabled)
    .toSorted((left, right) => left.sortOrder - right.sortOrder) ?? []
))
const nextSortOrder = computed(() => {
  if (props.placement === 'commission') {
    return 0
  }
  const used = new Set(enabledItems.value.map(item => item.sortOrder))
  return [0, 1, 2, 3, 4].find(value => !used.has(value)) ?? 4
})
const dialogOpen = computed(() => Boolean(actionError.value || conflictNotice.value))
const orientationLabel = computed(() => props.orientation === 'landscape' ? '横版' : '竖版')

watchEffect(() => {
  emit('summary', {
    enabledCount: enabledItems.value.length,
    hasOperation: Object.values(operations.value).some(isPublicationInProgress),
    limit: slotLimit.value,
    orientation: props.orientation,
    ready: pageStatus.value === 'ready'
      && (props.placement === 'commission' || enabledItems.value.length > 0),
  })
})

function moveState(id: string) {
  if (props.placement === 'commission') {
    return { canMoveDown: false, canMoveUp: false }
  }
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
  <section
    class="hero-collection-editor"
    :data-orientation="orientation"
    :aria-label="`${placement === 'home' ? '首页' : '委托页'}${orientationLabel}大图`"
  >
    <p v-if="pageStatus === 'loading'" role="status">正在加载{{ orientationLabel }}大图…</p>
    <p v-else-if="pageStatus === 'error'" role="alert">{{ orientationLabel }}大图加载失败，请刷新重试。</p>
    <template v-else-if="collection">
      <header class="hero-collection-editor__head">
        <div>
          <h2>{{ orientationLabel }}大图</h2>
          <p role="status">
            {{ orientation === 'landscape' ? '桌面 16:9' : '手机 9:16' }} ·
            已启用 {{ enabledItems.length }} / {{ slotLimit }}
          </p>
        </div>
        <AdminAction
          v-if="!showDraft"
          variant="primary"
          :disabled="mutating"
          @click="showDraft = true"
        >新增大图项</AdminAction>
      </header>

      <p v-if="collection.items.length === 0 && !showDraft" class="hero-collection-editor__empty">
        当前方向为空。上传与方向匹配的图片后可发布。
      </p>

      <TransitionGroup name="hero-item-list" tag="div" class="hero-collection-editor__items">
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
          :can-move-up="moveState(item.id).canMoveUp"
          :can-move-down="moveState(item.id).canMoveDown"
          @update="payload => run(() => updateItem(item.id, payload))"
          @delete="run(() => deleteItem(item.id))"
          @enable="run(() => startOperation(item.id, 'enable'))"
          @disable="run(() => startOperation(item.id, 'disable'))"
          @upscale="run(() => startOperation(item.id, 'upscale'))"
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
  </section>
</template>

<style scoped>
.hero-collection-editor,
.hero-collection-editor__items {
  display: grid;
  gap: var(--admin-space-4);
}

.hero-collection-editor {
  min-width: 0;
  padding: var(--admin-space-4);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
}

.hero-collection-editor__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-3);
}

.hero-collection-editor__head div {
  display: grid;
  gap: var(--admin-space-1);
}

.hero-collection-editor h2,
.hero-collection-editor p {
  margin: 0;
}

.hero-collection-editor__head p,
.hero-collection-editor__empty {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.hero-item-list-move {
  transition: transform var(--admin-duration-normal) var(--admin-easing);
}

@media (prefers-reduced-motion: reduce) {
  .hero-item-list-move { transition: none; }
}
</style>

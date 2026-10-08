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
    status: 'error' | 'loading' | 'ready'
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
const addButton = useTemplateRef<{ $el: HTMLButtonElement }>('addButton')
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
const orientationLabel = computed(() => props.orientation === 'landscape' ? '横版' : '竖版')

watchEffect(() => {
  emit('summary', {
    enabledCount: enabledItems.value.length,
    hasOperation: Object.values(operations.value).some(isPublicationInProgress),
    limit: slotLimit.value,
    orientation: props.orientation,
    status: pageStatus.value,
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

async function cancelDraft() {
  showDraft.value = false
  await nextTick()
  addButton.value?.$el.focus()
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

onMounted(() => void load())
</script>

<template>
  <section
    class="hero-collection-editor"
    :data-orientation="orientation"
    :aria-label="`${placement === 'home' ? '首页' : '委托页'}${orientationLabel}大图`"
  >
    <p v-if="pageStatus === 'loading'" role="status">正在加载{{ orientationLabel }}大图…</p>
    <div v-else-if="pageStatus === 'error'" class="hero-collection-editor__empty" role="alert">
      <p>{{ orientationLabel }}大图加载失败。</p>
      <AdminAction @click="load">重试</AdminAction>
    </div>
    <template v-else-if="collection">
      <header class="hero-collection-editor__head">
        <p>{{ placement === 'home' ? '按顺序轮播，最多启用 5 张图片。' : '当前画幅最多启用 1 张图片。' }}</p>
        <AdminAction
          v-if="!showDraft"
          ref="addButton"
          variant="primary"
          :disabled="mutating"
          @click="showDraft = true"
        >新增图片</AdminAction>
      </header>
      <div v-if="actionError || conflictNotice" class="admin-feedback" role="alert">
        <p v-if="actionError">{{ actionError }}</p>
        <p v-if="conflictNotice">{{ conflictNotice }}</p>
      </div>

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
          @enable="payload => run(() => startOperation(item.id, 'enable', payload))"
          @disable="run(() => startOperation(item.id, 'disable'))"
          @upscale="payload => run(() => startOperation(item.id, 'upscale', payload))"
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
          @cancel="cancelDraft"
          @conflict="load()"
        />
      </TransitionGroup>
    </template>

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
}

.hero-collection-editor__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--admin-space-3);
  flex-wrap: wrap;
}

.hero-collection-editor p {
  margin: 0;
}

.hero-collection-editor__head p,
.hero-collection-editor__empty {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.hero-collection-editor__empty {
  display: grid;
  justify-items: center;
  gap: var(--admin-space-3);
  padding: var(--admin-space-7);
  background: var(--admin-bg-primary);
  border: 1px dashed var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
}

.hero-item-list-move {
  transition: transform var(--admin-duration-normal) var(--admin-easing);
}

@media (prefers-reduced-motion: reduce) {
  .hero-item-list-move { transition: none; }
}
</style>

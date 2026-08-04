<script setup lang="ts">
import { workListResponseSchema } from '~~/shared/schemas/work'
import type { WorkListItemDto } from '~~/shared/types/contracts'
import type { HeroSlideInput } from '~/composables/useAdminHome'

// T20 首页管理：口号/自动轮播设置 + 轮播项 CRUD/排序/启停 + 活动水印预览。
// 所有写操作携带 expectedVersion；409 统一重载并提示。
definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '首页管理',
  robots: 'noindex, nofollow',
})

const adminApi = useAdminApi()
const {
  conflictNotice,
  createSlide,
  deleteSlide,
  disableSlide,
  enableSlide,
  feedback,
  home,
  load,
  mutating,
  operations,
  pageStatus,
  loadPreview,
  previewPending,
  previews,
  reorderEnabled,
  retryPublication,
  saveSettings,
  updateSlide,
} = useAdminHome()

const works = ref<WorkListItemDto[]>([])
const actionError = ref<string | null>(null)
const showDraft = ref(false)

const errorDialogOpen = computed(() =>
  Boolean(actionError.value || conflictNotice.value),
)

const tagline = ref('')
const contactEmail = ref('')
const contactQq = ref('')
const autoRotate = ref(false)
const intervalSeconds = ref(6)

function closeErrorDialog() {
  actionError.value = null
  conflictNotice.value = null
}

function settingsSnapshot() {
  return JSON.stringify({
    tagline: tagline.value,
    contactEmail: contactEmail.value,
    contactQq: contactQq.value,
    autoRotate: autoRotate.value,
    intervalSeconds: intervalSeconds.value,
  })
}

const settingsBaseline = ref(settingsSnapshot())

function syncSettings() {
  const current = home.value
  if (!current) {
    return
  }
  tagline.value = current.tagline
  contactEmail.value = current.contactEmail
  contactQq.value = current.contactQq
  autoRotate.value = current.autoRotate
  intervalSeconds.value = Math.round(current.autoRotateIntervalMs / 1_000)
  settingsBaseline.value = settingsSnapshot()
}

const settingsDirty = computed(() =>
  home.value !== null && settingsSnapshot() !== settingsBaseline.value,
)

const settingsValid = computed(() => {
  const text = tagline.value.trim()
  return text.length >= 1 && text.length <= 120
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contactEmail.value.trim())
    && contactEmail.value.trim().length <= 254
    && /^[1-9]\d{4,11}$/u.test(contactQq.value.trim())
    && Number.isInteger(intervalSeconds.value)
    && intervalSeconds.value >= 6 && intervalSeconds.value <= 300
})

watch(home, (value) => {
  if (!value) {
    return
  }
  if (!settingsDirty.value) {
    syncSettings()
  }
  else {
    // 表单有未保存修改时只推进基线（版本随快照更新），保留用户输入；
    // 自己保存成功时服务端值与表单一致，基线推进后自然回到非 dirty。
    settingsBaseline.value = JSON.stringify({
      tagline: value.tagline,
      contactEmail: value.contactEmail,
      contactQq: value.contactQq,
      autoRotate: value.autoRotate,
      intervalSeconds: Math.round(value.autoRotateIntervalMs / 1_000),
    })
  }
})

const slides = computed(() => home.value?.slides ?? [])
const enabledSlides = computed(() =>
  slides.value.filter(slide => slide.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder),
)
const nextEnabledSortOrder = computed(() => {
  const used = new Set(enabledSlides.value.map(slide => slide.sortOrder))
  return [0, 1, 2, 3, 4].find(order => !used.has(order)) ?? 5
})

function moveStateFor(slideId: string) {
  const index = enabledSlides.value.findIndex(slide => slide.id === slideId)
  return {
    canMoveUp: index > 0,
    canMoveDown: index !== -1 && index < enabledSlides.value.length - 1,
  }
}

async function onSaveSettings() {
  if (!settingsDirty.value || !settingsValid.value) {
    return
  }
  actionError.value = await saveSettings({
    tagline: tagline.value.trim(),
    contactEmail: contactEmail.value.trim(),
    contactQq: contactQq.value.trim(),
    autoRotate: autoRotate.value,
    autoRotateIntervalMs: intervalSeconds.value * 1_000,
  })
}

async function onCreate(payload: HeroSlideInput) {
  actionError.value = await createSlide(payload)
  if (actionError.value === null) {
    showDraft.value = false
  }
}

async function onSave(id: string, payload: HeroSlideInput) {
  actionError.value = await updateSlide(id, payload)
}

async function onDelete(id: string) {
  actionError.value = await deleteSlide(id)
}

async function onDisable(id: string) {
  actionError.value = await disableSlide(id)
}

async function onEnable(id: string) {
  actionError.value = await enableSlide(id)
}

async function onRetry(id: string) {
  actionError.value = await retryPublication(id)
}

async function onMove(id: string, direction: -1 | 1) {
  const ids = enabledSlides.value.map(slide => slide.id)
  const index = ids.indexOf(id)
  const target = index + direction
  if (index === -1 || target < 0 || target >= ids.length) {
    return
  }
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  actionError.value = await reorderEnabled(ids)
}

async function onPreview(id: string) {
  actionError.value = await loadPreview(id)
}

async function loadWorks() {
  try {
    const result = await adminApi('/api/admin/v1/works', {
      schema: workListResponseSchema,
    })
    works.value = result.data
  }
  catch {
    // 作品列表只用于关联选择：加载失败时保留空选项，不阻塞页面主体。
  }
}

onMounted(() => {
  void load()
  void loadWorks()
})
</script>

<template>
  <AdminShell current="home">
    <div class="home-admin" data-testid="home-admin">
      <header class="home-admin__header">
        <h1 class="home-admin__title">首页管理</h1>
        <p class="home-admin__meta">
          首页轮播最多启用 5 项；启用时会按当前活动水印生成公开衍生图。
        </p>
      </header>

      <div v-if="pageStatus === 'loading'" class="home-admin__state" role="status">
        正在加载首页配置…
      </div>
      <div v-else-if="pageStatus === 'error'" class="home-admin__state" role="alert">
        首页配置加载失败，请刷新重试。
      </div>

      <template v-else-if="home">
        <section class="home-admin__card" aria-labelledby="home-settings-title">
          <h2 id="home-settings-title" class="home-admin__card-title">首屏设置</h2>
          <div class="home-admin__settings">
            <div class="home-admin__field home-admin__field--wide">
              <label class="home-admin__label" for="home-tagline">首页口号</label>
              <input
                id="home-tagline"
                v-model="tagline"
                class="home-admin__input"
                type="text"
                maxlength="120"
                :disabled="mutating"
              >
            </div>
            <div class="home-admin__field">
              <label class="home-admin__label" for="home-contact-email">业务邮箱</label>
              <input
                id="home-contact-email"
                v-model="contactEmail"
                class="home-admin__input"
                type="email"
                maxlength="254"
                autocomplete="email"
                :disabled="mutating"
              >
            </div>
            <div class="home-admin__field">
              <label class="home-admin__label" for="home-contact-qq">QQ</label>
              <input
                id="home-contact-qq"
                v-model="contactQq"
                class="home-admin__input"
                type="text"
                inputmode="numeric"
                pattern="[1-9][0-9]{4,11}"
                maxlength="12"
                :disabled="mutating"
              >
            </div>
            <div class="home-admin__field home-admin__field--inline">
              <label class="home-admin__label" for="home-auto-rotate">自动轮播</label>
              <input
                id="home-auto-rotate"
                v-model="autoRotate"
                type="checkbox"
                :disabled="mutating"
              >
            </div>
            <div class="home-admin__field">
              <label class="home-admin__label" for="home-interval">自动轮播间隔（秒，6–300）</label>
              <input
                id="home-interval"
                v-model.number="intervalSeconds"
                class="home-admin__input home-admin__input--narrow"
                type="number"
                min="6"
                max="300"
                step="1"
                :disabled="mutating || !autoRotate"
              >
            </div>
            <div class="home-admin__settings-actions">
              <button
                type="button"
                class="home-admin__button home-admin__button--primary"
                :disabled="mutating || !settingsDirty || !settingsValid"
                @click="onSaveSettings"
              >{{ mutating ? '保存中…' : '保存设置' }}</button>
            </div>
          </div>
        </section>

        <section class="home-admin__card" aria-labelledby="home-slides-title">
          <div class="home-admin__slides-head">
            <h2 id="home-slides-title" class="home-admin__card-title">轮播项</h2>
            <p class="home-admin__slides-meta" role="status">
              已启用 {{ enabledSlides.length }} / 5
            </p>
            <button
              v-if="!showDraft"
              type="button"
              class="home-admin__button"
              :disabled="mutating"
              @click="showDraft = true"
            >新增轮播项</button>
          </div>

          <p v-if="slides.length === 0 && !showDraft" class="home-admin__empty">
            还没有轮播项。新增一项并上传横竖两版图片后，即可启用到首页。
          </p>

          <div class="home-admin__slides">
            <AdminHomeSlideCard
              v-for="slide in slides"
              :key="slide.id"
              :slide="slide"
              :works="works"
              :home-version="home.version"
              :mutating="mutating"
              :operation="operations[slide.id] ?? null"
              :feedback="feedback[slide.id] ?? null"
              :preview="previews[slide.id] ?? null"
              :preview-pending="previewPending[slide.id] ?? false"
              :can-move-up="moveStateFor(slide.id).canMoveUp"
              :can-move-down="moveStateFor(slide.id).canMoveDown"
              @save="payload => onSave(slide.id, payload)"
              @delete="onDelete(slide.id)"
              @enable="onEnable(slide.id)"
              @disable="onDisable(slide.id)"
              @move="direction => onMove(slide.id, direction)"
              @load-preview="onPreview(slide.id)"
              @retry-publication="onRetry(slide.id)"
              @conflict="load()"
            />
            <AdminHomeSlideCard
              v-if="showDraft"
              :slide="null"
              :works="works"
              :home-version="home.version"
              :default-sort-order="nextEnabledSortOrder"
              :mutating="mutating"
              @create="onCreate"
              @conflict="load()"
            />
          </div>
        </section>

      </template>

      <AdminConfirmDialog
        :open="errorDialogOpen"
        title="操作未完成"
        confirm-label="知道了"
        :show-cancel="false"
        @confirm="closeErrorDialog"
        @cancel="closeErrorDialog"
      >
        <p v-if="actionError" role="alert">{{ actionError }}</p>
        <p v-if="conflictNotice" role="alert">{{ conflictNotice }}</p>
      </AdminConfirmDialog>
    </div>
  </AdminShell>
</template>

<style scoped>
.home-admin {
  display: grid;
  gap: var(--admin-space-4);
  max-width: 72rem;
}

.home-admin__header {
  display: grid;
  gap: var(--admin-space-1);
}

.home-admin__title {
  margin: 0;
  font-size: var(--admin-font-lg);
  font-weight: 700;
}

.home-admin__meta {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.home-admin__state {
  padding: var(--admin-space-6);
  text-align: center;
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.home-admin__card {
  display: grid;
  gap: var(--admin-space-3);
  padding: var(--admin-space-4);
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.home-admin__card-title {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.home-admin__settings {
  display: grid;
  gap: var(--admin-space-3);
}

@media (min-width: 768px) {
  .home-admin__settings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
  }

  .home-admin__field--wide,
  .home-admin__settings-actions {
    grid-column: 1 / -1;
  }

  .home-admin__settings-actions {
    justify-content: flex-end;
  }
}

.home-admin__field--inline {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  min-height: var(--admin-control-height);
}

.home-admin__field--inline .home-admin__label {
  margin: 0;
}

.home-admin__label {
  display: block;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  margin-bottom: var(--admin-space-1);
}

.home-admin__input {
  width: 100%;
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  font: inherit;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
}

.home-admin__input--narrow {
  max-width: 8rem;
}

.home-admin__settings-actions {
  display: flex;
  align-items: center;
}

.home-admin__button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font-size: var(--admin-font-xs);
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.home-admin__button:hover:not(:disabled) {
  background: var(--admin-bg-subtle);
}

.home-admin__button:disabled {
  opacity: 0.55;
  cursor: default;
}

.home-admin__button--primary {
  background: var(--admin-accent-primary);
  border-color: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font-weight: 600;
}

.home-admin__slides-head {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  flex-wrap: wrap;
}

.home-admin__slides-meta {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.home-admin__slides-head .home-admin__button {
  margin-left: auto;
}

.home-admin__empty {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-tertiary);
}

.home-admin__slides {
  display: grid;
  gap: var(--admin-space-3);
}
</style>

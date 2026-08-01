<script setup lang="ts">
import {
  managedWorkResponseSchema,
  publicSafeWorkPreviewResponseSchema,
} from '~~/shared/schemas/work'
import type {
  ManagedWorkDto,
  PublicSafeWorkPreviewDto,
} from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'
import type { WorkBasicsForm } from '~/components/admin/WorkBasicsFields.vue'
import {
  SUIT_TYPE_LABELS,
  WORK_PURPOSE_LABELS,
} from '~/utils/work-labels'

definePageMeta({
  layout: 'admin',
  // 同组件实例内切换作品 ID 时按路径重建页面：表单、dirty 基线与发布检查整体重置。
  key: route => route.path,
  ssr: false,
})

useSeoMeta({
  title: '编辑作品',
  robots: 'noindex, nofollow',
})

const route = useRoute()
const workId = String(route.params.id)
const adminApi = useAdminApi()
const { status: authStatus } = useAdminAuth()

const pageStatus = ref<'error' | 'loading' | 'not-found' | 'ready'>('loading')
const work = ref<ManagedWorkDto | null>(null)
const form = ref<WorkBasicsForm>({
  characterName: '',
  featureTags: [],
  ownerContact: '',
  ownerDisplay: '有点小狗工作室',
  purpose: 'commission',
  slug: '',
  species: '',
  suitType: 'full',
})
const baseline = ref('')

const saving = ref(false)
const saveError = ref<string | null>(null)
const savedNotice = ref<string | null>(null)
const conflictOpen = ref(false)

const preview = ref<PublicSafeWorkPreviewDto | null>(null)
const previewError = ref<string | null>(null)

const photoState = ref({ busy: false, dirty: false })

function snapshotOf(value: WorkBasicsForm) {
  return JSON.stringify({
    characterName: value.characterName.trim(),
    featureTags: value.featureTags.map(tag => tag.trim()),
    ownerContact: value.ownerContact.trim(),
    ownerDisplay: value.ownerDisplay,
    purpose: value.purpose,
    slug: value.slug.trim(),
    species: value.species.trim(),
    suitType: value.suitType,
  })
}

function applyWork(next: ManagedWorkDto) {
  work.value = next
  form.value = {
    characterName: next.characterName,
    featureTags: [...next.featureTags],
    ownerContact: next.private.ownerContact ?? '',
    ownerDisplay: next.ownerDisplay,
    purpose: next.purpose,
    slug: next.slug,
    species: next.species,
    suitType: next.suitType,
  }
  baseline.value = snapshotOf(form.value)
}

const locked = computed(() => work.value?.publicationStatus === 'published')

const isDirty = computed(() =>
  work.value !== null && snapshotOf(form.value) !== baseline.value,
)

const leaveGuardActive = computed(() =>
  isDirty.value || photoState.value.dirty || photoState.value.busy,
)

async function loadWork(options: { initial?: boolean } = {}) {
  // 初次进入显示整页加载；发布/冲突后的后台刷新保持当前界面（不重建面板）。
  if (options.initial || pageStatus.value !== 'ready') {
    pageStatus.value = 'loading'
  }
  conflictOpen.value = false
  saveError.value = null
  try {
    const result = await adminApi(`/api/admin/v1/works/${workId}`, {
      schema: managedWorkResponseSchema,
    })
    applyWork(result.data)
    pageStatus.value = 'ready'
    void loadPreview()
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    pageStatus.value = error instanceof AdminApiError && error.status === 404
      ? 'not-found'
      : 'error'
  }
}

async function loadPreview() {
  previewError.value = null
  try {
    const result = await adminApi(`/api/admin/v1/works/${workId}/public-preview`, {
      schema: publicSafeWorkPreviewResponseSchema,
    })
    preview.value = result.data
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    previewError.value = '公开预览加载失败。'
  }
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function validate(): string | null {
  const value = form.value
  if (!value.characterName.trim() || !value.species.trim()) {
    return '角色名与物种为必填项。'
  }
  if (!SLUG_PATTERN.test(value.slug.trim())) {
    return '链接别名只能使用小写字母、数字与连字符，且不能以连字符开头或结尾。'
  }
  const tags = value.featureTags.map(tag => tag.trim())
  if (tags.some(tag => tag.length === 0) && value.featureTags.length > 0) {
    return '作品属性不能为空条目，请删除空行。'
  }
  if (new Set(tags).size !== tags.length) {
    return '作品属性不得重复。'
  }
  return null
}

async function saveWork() {
  if (saving.value || !work.value || locked.value) {
    return
  }
  saveError.value = validate()
  savedNotice.value = null
  if (saveError.value) {
    return
  }
  saving.value = true
  try {
    const value = form.value
    const result = await adminApi(`/api/admin/v1/works/${workId}`, {
      method: 'PUT',
      body: {
        expectedVersion: work.value.version,
        payload: {
          slug: value.slug.trim(),
          characterName: value.characterName.trim(),
          species: value.species.trim(),
          suitType: value.suitType,
          purpose: value.purpose,
          ownerDisplay: value.ownerDisplay,
          ownerContact: value.ownerContact.trim() === '' ? null : value.ownerContact.trim(),
          featureTags: value.featureTags.map(tag => tag.trim()),
        },
      },
      schema: managedWorkResponseSchema,
    })
    applyWork(result.data)
    savedNotice.value = '已保存。'
    void loadPreview()
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      conflictOpen.value = true
      saveError.value = '作品数据已在其他地方变化，本次修改未保存。'
      return
    }
    if (error instanceof AdminApiError && error.status === 400) {
      saveError.value = '填写内容未通过校验，请检查标星字段后重试。'
      return
    }
    saveError.value = '保存失败，请稍后重试；已填写的内容不会丢失。'
  }
  finally {
    saving.value = false
  }
}

function onPhotosSaved(next: ManagedWorkDto) {
  // 出厂照保存会递增作品版本：同步本地版本与基线，避免后续保存误报 409。
  applyWork(next)
  savedNotice.value = '出厂照已保存。'
  void loadPreview()
}

function onPublicationMutated() {
  void loadWork()
}

function onConflictReload() {
  conflictOpen.value = false
  void loadWork()
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (leaveGuardActive.value) {
    event.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  void loadWork({ initial: true })
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})

onBeforeRouteLeave(() => {
  // 会话失效时必须放行：表单已无法保存，继续拦截会把用户困在失效页面。
  if (!leaveGuardActive.value || authStatus.value === 'guest') {
    return true
  }
  return window.confirm('有未保存的更改或正在进行的上传，确定离开此页面吗？')
})

useSeoMeta({
  title: computed(() =>
    work.value ? `编辑 ${work.value.characterName}` : '编辑作品',
  ),
})
</script>

<template>
  <AdminShell current="works">
    <div v-if="pageStatus === 'loading'" class="editor-state" role="status">
      正在加载作品…
    </div>

    <div v-else-if="pageStatus === 'not-found'" class="editor-state editor-state--missing">
      <p class="editor-state__title">未找到该作品</p>
      <p class="editor-state__text">作品可能已被移除，或链接有误。</p>
      <NuxtLink to="/admin/works" class="editor-state__back">返回作品列表</NuxtLink>
    </div>

    <div v-else-if="pageStatus === 'error'" class="editor-state editor-state--missing">
      <p class="editor-state__title" role="alert">作品加载失败</p>
      <p class="editor-state__text">请检查网络连接后重试。</p>
      <button type="button" class="editor-state__retry" @click="loadWork()">重试</button>
    </div>

    <div v-else-if="work" class="editor">
      <header class="editor__header">
        <div class="editor__heading">
          <NuxtLink to="/admin/works" class="editor__back">← 作品</NuxtLink>
          <h1 class="editor__title">{{ work.characterName }}</h1>
          <AdminStatusBadge
            :tone="isDirty || photoState.dirty ? 'warning' : 'neutral'"
            :label="isDirty || photoState.dirty ? '有未保存更改' : '未更改'"
          />
        </div>
        <div class="editor__actions">
          <button
            type="button"
            class="editor__button editor__button--secondary"
            :disabled="!isDirty || saving || locked"
            @click="saveWork"
          >{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </header>

      <div v-if="conflictOpen" class="editor__conflict" role="alert">
        <p class="editor__conflict-text">
          作品已在其他地方被修改（版本冲突）。重新加载会放弃当前未保存的编辑；
          继续编辑则保留本地内容，下次保存仍可能冲突。
        </p>
        <div class="editor__conflict-actions">
          <button
            type="button"
            class="editor__button editor__button--secondary"
            @click="onConflictReload"
          >重新加载（放弃本地更改）</button>
          <button
            type="button"
            class="editor__button editor__button--secondary"
            @click="conflictOpen = false"
          >继续编辑</button>
        </div>
      </div>

      <p v-if="locked" class="editor__locked" role="status">
        作品已发布：基础信息与出厂照为只读。如需修改，请先在右侧下架。
      </p>

      <p v-if="saveError && !conflictOpen" class="editor__notice editor__notice--error" role="alert">
        {{ saveError }}
      </p>
      <p v-else-if="savedNotice" class="editor__notice" role="status">{{ savedNotice }}</p>

      <div class="editor__layout">
        <div class="editor__main">
          <AdminWorkBasicsFields v-model="form" :disabled="locked || saving" />
          <AdminStudioPhotoSection
            :work="work"
            :locked="locked"
            @saved="onPhotosSaved"
            @conflict="conflictOpen = true"
            @state-change="photoState = $event"
          />
        </div>

        <aside class="editor__aside">
          <AdminPublicationPanel
            :work="work"
            :busy="saving || photoState.busy"
            @mutated="onPublicationMutated"
            @conflict="conflictOpen = true"
          />

          <section class="preview-card" aria-labelledby="preview-title" data-testid="public-preview">
            <div class="editor-card__head">
              <h2 id="preview-title" class="editor-card__title">公开预览</h2>
              <button type="button" class="preview-card__refresh" @click="loadPreview">刷新</button>
            </div>
            <p v-if="previewError" class="preview-card__error" role="alert">{{ previewError }}</p>
            <template v-else-if="preview">
              <dl class="preview-card__facts">
                <div class="preview-card__fact">
                  <dt>角色名</dt>
                  <dd>{{ preview.characterName }}</dd>
                </div>
                <div class="preview-card__fact">
                  <dt>物种 / 装型</dt>
                  <dd>{{ preview.species }} · {{ SUIT_TYPE_LABELS[preview.suitType] }}</dd>
                </div>
                <div class="preview-card__fact">
                  <dt>用途</dt>
                  <dd>{{ WORK_PURPOSE_LABELS[preview.purpose] }}</dd>
                </div>
                <div class="preview-card__fact">
                  <dt>角色主人</dt>
                  <dd>{{ preview.ownerDisplay }}</dd>
                </div>
                <div class="preview-card__fact">
                  <dt>公开地址</dt>
                  <dd class="preview-card__slug">/works/{{ preview.slug }}</dd>
                </div>
                <div class="preview-card__fact">
                  <dt>属性</dt>
                  <dd>{{ preview.featureTags.length > 0 ? preview.featureTags.join('、') : '无' }}</dd>
                </div>
                <div class="preview-card__fact">
                  <dt>出厂照</dt>
                  <dd>
                    {{ preview.studioPhotos.length }} 张
                    <span
                      :class="preview.mediaReady
                        ? 'preview-card__ready'
                        : 'preview-card__not-ready'"
                    >
                      {{ preview.mediaReady ? '· 媒体就绪' : '· 媒体未就绪' }}
                    </span>
                  </dd>
                </div>
              </dl>
              <p class="preview-card__note">
                以上为公开安全数据：不含联系人、私有 Key 或签名 URL。
                公开详情页真实投影由 T19 接入。
              </p>
            </template>
            <p v-else class="preview-card__loading" role="status">正在加载公开预览…</p>
          </section>
        </aside>
      </div>
    </div>
  </AdminShell>
</template>

<style scoped>
.editor {
  max-width: var(--admin-content-max);
}

.editor-state {
  max-width: var(--admin-reading-max);
  margin: var(--admin-space-8) auto;
  text-align: center;
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-8);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
}

.editor-state--missing {
  border-style: dashed;
}

.editor-state__title {
  margin: 0;
  font-size: var(--admin-font-md);
  font-weight: 600;
  color: var(--admin-text-primary);
}

.editor-state__text {
  margin: var(--admin-space-2) 0 var(--admin-space-4);
}

.editor-state__back {
  color: var(--admin-accent-primary);
  font-weight: 600;
}

.editor-state__retry {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-accent-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.editor__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--admin-space-4);
  flex-wrap: wrap;
  margin-bottom: var(--admin-space-5);
}

.editor__heading {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  flex-wrap: wrap;
}

.editor__back {
  font-size: var(--admin-font-base);
  color: var(--admin-text-secondary);
  min-height: var(--admin-touch-target);
  display: inline-flex;
  align-items: center;
}

.editor__back:hover {
  color: var(--admin-text-primary);
}

.editor__title {
  margin: 0;
  font-size: var(--admin-font-base);
  font-weight: 600;
  line-height: var(--admin-line-tight);
}

.editor__heading :deep(.admin-badge) {
  min-height: var(--admin-control-height-sm);
  font-size: var(--admin-font-base);
}

.editor__actions {
  display: flex;
  gap: var(--admin-space-2);
}

.editor__conflict {
  margin: 0 0 var(--admin-space-5);
  padding: var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-warning-soft);
  display: grid;
  gap: var(--admin-space-3);
}

.editor__conflict-text {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-status-warning);
  line-height: var(--admin-line-normal);
}

.editor__conflict-actions {
  display: flex;
  gap: var(--admin-space-2);
  flex-wrap: wrap;
}

.editor__locked {
  margin: 0 0 var(--admin-space-5);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-info-soft);
  color: var(--admin-status-info);
  font-size: var(--admin-font-sm);
}

.editor__notice {
  margin: 0 0 var(--admin-space-5);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-info-soft);
  color: var(--admin-status-info);
  font-size: var(--admin-font-sm);
}

.editor__notice--error {
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
}

.editor__layout {
  display: grid;
  gap: var(--admin-space-5);
}

.editor__main {
  display: grid;
  gap: var(--admin-space-5);
  align-content: start;
  min-width: 0;
}

.editor__aside {
  display: grid;
  gap: var(--admin-space-5);
  align-content: start;
}

.preview-card {
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  padding: var(--admin-space-5);
}

.preview-card__refresh {
  border: none;
  background: none;
  padding: 0 var(--admin-space-2);
  min-height: var(--admin-touch-target);
  font: inherit;
  font-size: var(--admin-font-sm);
  color: var(--admin-accent-primary);
  cursor: pointer;
}

.preview-card__error {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-status-error);
}

.preview-card__loading {
  margin: 0;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-secondary);
}

.preview-card__facts {
  margin: 0;
  display: grid;
  gap: var(--admin-space-2);
}

.preview-card__fact {
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  gap: var(--admin-space-2);
  font-size: var(--admin-font-sm);
}

.preview-card__fact dt {
  color: var(--admin-text-tertiary);
}

.preview-card__fact dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.preview-card__slug {
  font-family: var(--font-admin-mono);
}

.preview-card__ready {
  color: var(--admin-status-success);
}

.preview-card__not-ready {
  color: var(--admin-status-warning);
}

.preview-card__note {
  margin: var(--admin-space-4) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
  line-height: var(--admin-line-normal);
}

@media (min-width: 1280px) {
  .editor__layout {
    grid-template-columns: 1fr var(--admin-editor-preview-width);
    align-items: start;
  }

  .editor__aside {
    position: sticky;
    top: var(--admin-space-6);
  }
}
</style>

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
import type { WorkBasicsForm } from '~/utils/work-form'
import {
  emptyWorkForm,
  hasWorkFormError,
  toWorkFieldsPayload,
  validateWorkForm,
  workFormFromDto,
  workFormSnapshot,
} from '~/utils/work-form'
import { workApiErrorText } from '~/utils/work-errors'
import {
  ADOPTION_STATUS_LABELS,
  WORK_PURPOSE_LABELS,
} from '~/utils/work-labels'
import { formatCnyMinorUnits } from '~/utils/format'

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
const form = ref<WorkBasicsForm>(emptyWorkForm())
const baseline = ref('')

const submitted = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const savedNotice = ref<string | null>(null)
const conflictOpen = ref(false)

const preview = ref<PublicSafeWorkPreviewDto | null>(null)
const previewError = ref<string | null>(null)

const adoptionCoverState = ref({ busy: false, dirty: false })
const designSheetState = ref({ busy: false, dirty: false })
const photoState = ref({ busy: false, dirty: false })
const adoptionCoverSection = useTemplateRef<{ save: () => Promise<boolean> }>('adoptionCoverSection')
const designSheetSection = useTemplateRef<{ save: () => Promise<boolean> }>('designSheetSection')
const studioPhotoSection = useTemplateRef<{ save: () => Promise<boolean> }>('studioPhotoSection')

function applyWork(next: ManagedWorkDto) {
  work.value = next
  form.value = workFormFromDto(next)
  baseline.value = workFormSnapshot(form.value)
  submitted.value = false
}

function applyMediaWork(next: ManagedWorkDto) {
  const preserveBasics = isDirty.value
  work.value = next
  if (!preserveBasics) {
    form.value = workFormFromDto(next)
    baseline.value = workFormSnapshot(form.value)
    submitted.value = false
  }
}

const locked = computed(() => work.value?.publicationStatus === 'published')

const errors = computed(() => validateWorkForm(form.value))
const invalid = computed(() => hasWorkFormError(errors.value))

const isDirty = computed(() =>
  work.value !== null
  && workFormSnapshot(form.value) !== baseline.value,
)

const leaveGuardActive = computed(() =>
  isDirty.value
  || adoptionCoverState.value.dirty
  || adoptionCoverState.value.busy
  || designSheetState.value.dirty
  || designSheetState.value.busy
  || photoState.value.dirty
  || photoState.value.busy,
)

const mediaBusy = computed(() =>
  adoptionCoverState.value.busy
  || designSheetState.value.busy
  || photoState.value.busy,
)

const mediaDirty = computed(() =>
  adoptionCoverState.value.dirty
  || designSheetState.value.dirty
  || photoState.value.dirty,
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

async function saveWork(): Promise<boolean> {
  if (saving.value || !work.value) {
    return false
  }
  submitted.value = true
  savedNotice.value = null
  if (invalid.value) {
    saveError.value = '填写内容未通过校验，请修正下方标注的字段后重试。'
    return false
  }
  saveError.value = null
  saving.value = true
  try {
    const payload = toWorkFieldsPayload(form.value)
    const presentationOnly = locked.value
    const result = await adminApi(
      presentationOnly
        ? `/api/admin/v1/works/${workId}/presentation`
        : `/api/admin/v1/works/${workId}`,
      {
        method: 'PUT',
        body: {
          expectedVersion: work.value.version,
          payload: presentationOnly
            ? { featured: payload.featured }
            : payload,
        },
        schema: managedWorkResponseSchema,
      },
    )
    applyWork(result.data)
    savedNotice.value = presentationOnly
      ? '首页精选设置已保存，公开端已更新。'
      : '已保存。'
    void loadPreview()
    return true
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return false
    }
    saveError.value = workApiErrorText(
      error,
      '保存失败，请稍后重试；已填写的内容不会丢失。',
    )
    if (
      error instanceof AdminApiError
      && error.status === 409
      && error.reason === 'VERSION_CONFLICT'
    ) {
      saveError.value = null
      conflictOpen.value = true
    }
    return false
  }
  finally {
    saving.value = false
  }
}

async function saveBeforePublish(): Promise<boolean> {
  if (isDirty.value && !(await saveWork())) {
    return false
  }
  await nextTick()
  if (adoptionCoverState.value.dirty && !(await adoptionCoverSection.value?.save())) {
    return false
  }
  await nextTick()
  if (designSheetState.value.dirty && !(await designSheetSection.value?.save())) {
    return false
  }
  await nextTick()
  if (photoState.value.dirty && !(await studioPhotoSection.value?.save())) {
    return false
  }
  return true
}

function onPhotosSaved(next: ManagedWorkDto) {
  // 媒体保存使用服务端新版本，同时保留其他分区尚未保存的输入。
  applyMediaWork(next)
  savedNotice.value = '出厂照已保存。'
  void loadPreview()
}

function onDesignSheetSaved(next: ManagedWorkDto) {
  applyMediaWork(next)
  savedNotice.value = '领养设定图已保存。'
  void loadPreview()
}

function onAdoptionCoverSaved(next: ManagedWorkDto) {
  applyMediaWork(next)
  savedNotice.value = '领养横版封面已保存。'
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
      <AdminAction @click="loadWork()">重试</AdminAction>
    </div>

    <div v-else-if="work" class="editor">
      <header class="editor__header">
        <div class="editor__heading">
          <NuxtLink to="/admin/works" class="editor__back">← 作品</NuxtLink>
          <h1 class="editor__title">{{ work.characterName }}</h1>
          <AdminStatusBadge
            :tone="isDirty || mediaDirty ? 'warning' : 'neutral'"
            :label="isDirty || mediaDirty ? '有未保存更改' : '未更改'"
          />
        </div>
        <div class="editor__actions">
          <AdminAction
            :disabled="!isDirty || saving"
            :loading="saving"
            loading-label="保存中…"
            @click="saveWork"
          >{{ locked ? '保存首页精选' : '保存' }}</AdminAction>
        </div>
      </header>

      <p v-if="locked" class="editor__locked" role="status">
        作品已发布：基础信息与图片为只读，需要先下架。首页精选仍可直接修改，具体顺序在作品管理的“首页精选”Tab 调整。
      </p>
      <p v-if="savedNotice" class="editor__notice" role="status">{{ savedNotice }}</p>

      <div class="editor__layout">
        <div class="editor__main">
          <AdminWorkBasicsFields
            v-model="form"
            :disabled="locked || saving"
            :ordering-disabled="saving"
            :errors="errors"
            :show-errors="submitted"
          />
          <AdminAdoptionCoverSection
            v-if="work.purpose === 'adoption'"
            ref="adoptionCoverSection"
            :work="work"
            :locked="locked"
            @saved="onAdoptionCoverSaved"
            @conflict="conflictOpen = true"
            @state-change="adoptionCoverState = $event"
          />
          <AdminDesignSheetSection
            v-if="work.purpose === 'adoption'"
            ref="designSheetSection"
            :work="work"
            :locked="locked"
            @saved="onDesignSheetSaved"
            @conflict="conflictOpen = true"
            @state-change="designSheetState = $event"
          />
          <AdminStudioPhotoSection
            ref="studioPhotoSection"
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
            :busy="saving || mediaBusy"
            :dirty="isDirty || mediaDirty"
            :save-before-publish="saveBeforePublish"
            @mutated="onPublicationMutated"
            @conflict="conflictOpen = true"
          />

          <section class="preview-card" aria-labelledby="preview-title" data-testid="public-preview">
            <div class="editor-card__head">
              <h2 id="preview-title" class="editor-card__title">公开预览</h2>
              <AdminAction class="preview-card__refresh" variant="text" @click="loadPreview">刷新</AdminAction>
            </div>
            <p v-if="previewError" class="preview-card__error" role="alert">{{ previewError }}</p>
            <template v-else-if="preview">
              <dl class="preview-card__facts">
                <div class="preview-card__fact">
                  <dt>角色名</dt>
                  <dd>{{ preview.characterName }}</dd>
                </div>
                <div class="preview-card__fact">
                  <dt>物种</dt>
                  <dd>{{ preview.species }}</dd>
                </div>
                <div class="preview-card__fact">
                  <dt>用途</dt>
                  <dd>{{ WORK_PURPOSE_LABELS[preview.purpose] }}</dd>
                </div>
                <template v-if="preview.purpose === 'adoption'">
                  <div class="preview-card__fact">
                    <dt>领养状态</dt>
                    <dd>
                      {{ preview.adoptionStatus
                        ? ADOPTION_STATUS_LABELS[preview.adoptionStatus]
                        : '待负责人人工确认（禁止发布）' }}
                    </dd>
                  </div>
                  <div class="preview-card__fact">
                    <dt>价格</dt>
                    <dd>
                      {{ preview.priceCnyMinor === null
                        ? '不公开价格'
                        : formatCnyMinorUnits(preview.priceCnyMinor) }}
                    </dd>
                  </div>
                </template>
                <div class="preview-card__fact">
                  <dt>首页精选</dt>
                  <dd>{{ preview.featured ? '已加入（顺序在精选 Tab 调整）' : '未加入' }}</dd>
                </div>
                <div class="preview-card__fact">
                  <dt>公开地址</dt>
                  <dd class="preview-card__slug">/works/{{ preview.slug }}</dd>
                </div>
                <div class="preview-card__fact">
                  <dt>领养横版封面 / 设定图</dt>
                  <dd v-if="preview.purpose === 'adoption'">
                    {{ preview.adoptionCover ? '封面 1 张' : '无封面' }}
                    · {{ preview.designSheet ? '设定图 1 张' : '无设定图' }}
                    · 二者至少其一
                  </dd>
                  <dd v-else>不适用</dd>
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
            </template>
            <p v-else class="preview-card__loading" role="status">正在加载公开预览…</p>
          </section>
        </aside>
      </div>

      <AdminConfirmDialog
        :open="conflictOpen"
        title="作品版本已变化"
        confirm-label="重新加载（放弃本地更改）"
        cancel-label="继续编辑"
        @confirm="onConflictReload"
        @cancel="conflictOpen = false"
      >
        <p role="alert">
          作品已在其他地方被修改（版本冲突）。重新加载会放弃当前未保存的编辑；
          继续编辑则保留本地内容，下次保存仍可能冲突。
        </p>
      </AdminConfirmDialog>

      <AdminConfirmDialog
        :open="saveError !== null && !conflictOpen"
        title="保存未完成"
        confirm-label="知道了"
        :show-cancel="false"
        @confirm="saveError = null"
        @cancel="saveError = null"
      >
        <p role="alert">{{ saveError }}</p>
      </AdminConfirmDialog>
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
  min-height: var(--admin-touch-target);
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

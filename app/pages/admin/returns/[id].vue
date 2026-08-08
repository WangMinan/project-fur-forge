<script setup lang="ts">
import { adminReturnCharacterResponseSchema } from '~~/shared/schemas/return-photo'
import { workListResponseSchema } from '~~/shared/schemas/work'
import type {
  AdminReturnCharacterDto,
  WorkListItemDto,
} from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'

/**
 * T35-F1 设定编辑：名称 / 昵称 / 可选关联作品 + 这个设定的多张返图。
 *
 * 页面不出现公开衍生预览：返图公开图无水印、内容与私有原图一致，
 * 再放一份预览没有信息量。也不出现作品水印参数或返图排序。
 */
definePageMeta({
  layout: 'admin',
  ssr: false,
})

const route = useRoute()
const adminApi = useAdminApi()
const characterId = computed(() => String(route.params.id))

const status = ref<'error' | 'loading' | 'ready'>('loading')
const record = ref<AdminReturnCharacterDto | null>(null)
const works = ref<WorkListItemDto[]>([])

/** 表单草稿：409 冲突时保留，不被服务端值静默覆盖。 */
const form = reactive({
  consentNote: '',
  consentSource: '' as '' | 'qq' | 'email' | 'other',
  consentConfirmedAt: '',
  name: '',
  nickname: '',
  slug: '',
  workId: '',
})

const saving = ref(false)
const actionError = ref<string | null>(null)
const savedAt = ref<number | null>(null)
const conflict = ref<AdminReturnCharacterDto | null>(null)

/**
 * 有未保存更改：与作品编辑页一致，页头据此显示状态标记并启用保存按钮。
 * 比较表单与服务端值本身，不额外维护一份基线快照。
 */
const dirty = computed(() => {
  const current = record.value
  if (!current) {
    return false
  }
  return form.name !== current.name
    || form.nickname !== (current.nickname ?? '')
    || form.slug !== current.slug
    || form.workId !== (current.work?.workId ?? '')
    || form.consentSource !== (current.authorization.source ?? '')
    || form.consentNote !== (current.authorization.note ?? '')
    || form.consentConfirmedAt !== (
      current.authorization.confirmedAt?.slice(0, 10) ?? ''
    )
})

useSeoMeta({
  title: computed(() => (
    record.value ? `返图管理 · ${record.value.name}` : '返图管理'
  )),
  robots: 'noindex, nofollow',
})

function applyToForm(value: AdminReturnCharacterDto) {
  form.name = value.name
  form.nickname = value.nickname ?? ''
  form.slug = value.slug
  form.workId = value.work?.workId ?? ''
  form.consentSource = value.authorization.source ?? ''
  form.consentNote = value.authorization.note ?? ''
  form.consentConfirmedAt = value.authorization.confirmedAt
    ? value.authorization.confirmedAt.slice(0, 10)
    : ''
}

async function load(options: { keepDraft?: boolean } = {}) {
  try {
    const response = await adminApi(
      `/api/admin/v1/returns/${characterId.value}`,
      { schema: adminReturnCharacterResponseSchema },
    )
    record.value = response.data
    if (!options.keepDraft) {
      applyToForm(response.data)
    }
    status.value = 'ready'
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    status.value = 'error'
  }
}

async function reloadForConflict() {
  try {
    const response = await adminApi(
      `/api/admin/v1/returns/${characterId.value}`,
      { schema: adminReturnCharacterResponseSchema },
    )
    conflict.value = response.data
    record.value = response.data
  }
  catch {
    conflict.value = null
  }
}

const upload = useReturnPhotoUpload({
  onConflict: () => {
    void reloadForConflict()
  },
  onUploaded: async () => {
    // 上传完成后服务端已经新增了一张返图，重新读取设定。
    await load({ keepDraft: true })
  },
})

onMounted(async () => {
  await load()
  try {
    const response = await adminApi('/api/admin/v1/works', {
      schema: workListResponseSchema,
    })
    works.value = response.data
  }
  catch {
    works.value = []
  }
})

async function save() {
  const current = record.value
  if (!current || saving.value) {
    return
  }
  saving.value = true
  actionError.value = null
  conflict.value = null
  try {
    const response = await adminApi(
      `/api/admin/v1/returns/${current.id}`,
      {
        method: 'PUT',
        body: {
          expectedVersion: current.version,
          payload: {
            slug: form.slug.trim(),
            name: form.name.trim(),
            nickname: form.nickname.trim() === '' ? null : form.nickname.trim(),
            workId: form.workId === '' ? null : form.workId,
            authorization: {
              source: form.consentSource === '' ? null : form.consentSource,
              confirmedAt: form.consentConfirmedAt === ''
                ? null
                : new Date(`${form.consentConfirmedAt}T00:00:00Z`).toISOString(),
              note: form.consentNote.trim() === ''
                ? null
                : form.consentNote.trim(),
            },
          },
        },
        schema: adminReturnCharacterResponseSchema,
      },
    )
    record.value = response.data
    applyToForm(response.data)
    savedAt.value = Date.now()
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.status === 409) {
      if (error.reason === 'RETURN_CHARACTER_SLUG_TAKEN') {
        actionError.value = '这个网址名称已经被其他设定使用，请换一个。'
      }
      else {
        actionError.value = '这个设定已在别处修改。下面显示的是最新内容，你填写的内容仍然保留。'
        await reloadForConflict()
      }
      return
    }
    actionError.value = error instanceof AdminApiError
      && error.reason === 'RETURN_PHOTO_WORK_NOT_FOUND'
      ? '选择的作品不存在，请重新选择。'
      : '保存失败，请检查填写内容后重试。'
  }
  finally {
    saving.value = false
  }
}

function onPickFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const current = record.value
  if (!file || !current) {
    return
  }
  void upload.start(file, {
    characterId: current.id,
    version: current.version,
  })
  input.value = ''
}
</script>

<template>
  <AdminShell current="returns">
    <section class="return-editor">
      <!-- 页头结构与 /admin/works/[id] 一致：返回链接、标题、状态同一行，
           右上角放主操作。 -->
      <header class="return-editor__header">
        <div class="return-editor__heading">
          <NuxtLink to="/admin/returns" class="return-editor__back">
            ← 返图管理
          </NuxtLink>
          <h1 class="return-editor__title">
            {{ record ? record.name : '设定' }}
          </h1>
          <AdminStatusBadge
            v-if="record"
            :tone="dirty ? 'warning' : 'neutral'"
            :label="dirty ? '有未保存更改' : '未更改'"
          />
        </div>
        <div v-if="record" class="return-editor__actions">
          <button
            type="button"
            class="return-editor__save"
            :disabled="!dirty || saving"
            @click="save"
          >{{ saving ? '保存中…' : '保存修改' }}</button>
        </div>
      </header>

      <p v-if="savedAt && !dirty" class="return-editor__saved" role="status">
        已保存
      </p>

      <p v-if="status === 'loading'" class="return-editor__state" role="status">
        正在加载…
      </p>
      <p v-else-if="status === 'error'" class="return-editor__state" role="alert">
        加载失败，请刷新页面后重试。
      </p>

      <template v-else-if="record">
        <p v-if="actionError" class="return-editor__error" role="alert">
          {{ actionError }}
        </p>

        <AdminReturnCharacterCard
          v-model:form="form"
          :conflict="conflict"
          :works="works"
        />

        <AdminReturnPhotoList
          :record="record"
          :upload="upload"
          @pick-file="onPickFile"
          @changed="load({ keepDraft: true })"
        />

        <!-- 删除入口只在设定列表里：与作品管理一致，详情页不放危险操作。 -->
      </template>
    </section>
  </AdminShell>
</template>

<style scoped>
.return-editor {
  max-width: var(--admin-content-max);
}

/* 与 /admin/works/[id] 同一套页头排布。 */
.return-editor__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--admin-space-4);
  flex-wrap: wrap;
  margin-bottom: var(--admin-space-5);
}

.return-editor__heading {
  display: flex;
  align-items: center;
  gap: var(--admin-space-3);
  flex-wrap: wrap;
}

.return-editor__back {
  display: inline-flex;
  align-items: center;
  min-height: var(--admin-touch-target);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-base);
}

.return-editor__back:hover {
  color: var(--admin-text-primary);
}

.return-editor__title {
  margin: 0;
  font-size: var(--admin-font-base);
  font-weight: 600;
  line-height: var(--admin-line-tight);
}

.return-editor__actions {
  display: flex;
  gap: var(--admin-space-2);
}

.return-editor__save {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-5);
  border: none;
  border-radius: var(--admin-radius-md);
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font: inherit;
  font-size: var(--admin-font-sm);
  cursor: pointer;
}

.return-editor__save:disabled {
  opacity: 0.55;
  cursor: default;
}

.return-editor__saved {
  margin-bottom: var(--admin-space-4);
  color: var(--admin-status-success);
  font-size: var(--admin-font-xs);
}

.return-editor__state {
  margin-top: var(--admin-space-6);
  padding: var(--admin-space-7);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  text-align: center;
}

.return-editor__error {
  margin-top: var(--admin-space-4);
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.admin-card {
  margin-top: var(--admin-space-5);
  padding: var(--admin-space-5);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  background: var(--admin-bg-primary);
}

.admin-card--danger {
  border-color: var(--admin-status-error-soft);
}

.admin-card__title {
  font-size: var(--admin-font-md);
  font-weight: 600;
}

.admin-card__hint {
  margin-top: var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.return-danger__button {
  min-height: var(--admin-control-height);
  margin-top: var(--admin-space-4);
  padding: 0 var(--admin-space-5);
  border: 1px solid var(--admin-danger);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-danger);
  font: inherit;
  font-size: var(--admin-font-sm);
  cursor: pointer;
}

.return-danger__button:disabled {
  opacity: 0.5;
  cursor: default;
}

.return-danger__confirm {
  margin-top: var(--admin-space-4);
  padding: var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  font-size: var(--admin-font-sm);
  line-height: var(--admin-line-normal);
}

.return-danger__confirm-actions {
  display: flex;
  gap: var(--admin-space-3);
  margin-top: var(--admin-space-3);
}

.return-danger__confirm-actions button:last-child {
  min-height: var(--admin-control-height);
  padding: 0 var(--admin-space-4);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
  cursor: pointer;
}
</style>

<script setup lang="ts">
import {
  adminUpdateListResponseSchema,
  adminUpdateResponseSchema,
  deleteUpdateResponseSchema,
  UPDATE_TYPE_VALUES,
} from '~~/shared/schemas/update'
import type {
  AdminUpdateDto,
  UpdateFields,
  UpdateType,
} from '~~/shared/types/contracts'
import { AdminApiError } from '~/composables/useAdminApi'
import {
  formatUpdateDateTime,
  UPDATE_PUBLICATION_LABELS,
  UPDATE_TYPE_LABELS,
} from '~/utils/update-labels'

definePageMeta({
  layout: 'admin',
  ssr: false,
})

useSeoMeta({
  title: '动态管理',
  robots: 'noindex, nofollow',
})

interface UpdateForm {
  content: string
  title: string
  type: UpdateType
}

const emptyForm = (): UpdateForm => ({
  type: UPDATE_TYPE_VALUES[0],
  title: '',
  content: '',
})

const adminApi = useAdminApi()
const status = ref<'error' | 'loading' | 'ready'>('loading')
const items = ref<AdminUpdateDto[]>([])
const form = reactive<UpdateForm>(emptyForm())
const editing = ref<AdminUpdateDto | null>(null)
const submitting = ref(false)
const actionPendingId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const deleteTarget = ref<AdminUpdateDto | null>(null)

const formTitle = computed(() => editing.value ? '编辑动态' : '新增动态')
const canSubmit = computed(() => (
  form.title.trim() !== ''
  && form.content.trim() !== ''
  && !submitting.value
))

function replaceItem(updated: AdminUpdateDto) {
  const index = items.value.findIndex(item => item.id === updated.id)
  if (index < 0) {
    items.value = [updated, ...items.value]
    return
  }
  items.value.splice(index, 1, updated)
}

function resetForm() {
  Object.assign(form, emptyForm())
  editing.value = null
}

function startEdit(item: AdminUpdateDto) {
  editing.value = item
  Object.assign(form, {
    type: item.type,
    title: item.title,
    content: item.content,
  })
  nextTick(() => {
    document.querySelector<HTMLElement>('#update-form-title')?.focus()
  })
}

async function load() {
  status.value = 'loading'
  try {
    const response = await adminApi('/api/admin/v1/updates', {
      schema: adminUpdateListResponseSchema,
    })
    items.value = response.data
    status.value = 'ready'
  }
  catch {
    status.value = 'error'
  }
}

onMounted(() => {
  void load()
})

function payload(): UpdateFields {
  return {
    type: form.type,
    title: form.title.trim(),
    content: form.content.trim(),
  }
}

async function submit() {
  if (!canSubmit.value) {
    return
  }
  submitting.value = true
  actionError.value = null
  try {
    const current = editing.value
    const response = current
      ? await adminApi(`/api/admin/v1/updates/${current.id}`, {
          method: 'PUT',
          body: { expectedVersion: current.version, payload: payload() },
          schema: adminUpdateResponseSchema,
        })
      : await adminApi('/api/admin/v1/updates', {
          method: 'POST',
          body: payload(),
          schema: adminUpdateResponseSchema,
        })
    replaceItem(response.data)
    resetForm()
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    if (error instanceof AdminApiError && error.reason === 'VERSION_CONFLICT') {
      actionError.value = '这条动态已在别处修改。已保留当前填写内容，请先刷新列表并核对后再保存。'
      return
    }
    actionError.value = '动态保存失败，请检查标题和正文后重试。'
  }
  finally {
    submitting.value = false
  }
}

async function changePublication(item: AdminUpdateDto) {
  if (actionPendingId.value) {
    return
  }
  actionPendingId.value = item.id
  actionError.value = null
  const publish = item.publicationStatus !== 'published'
  try {
    const response = await adminApi(
      `/api/admin/v1/updates/${item.id}/${publish ? 'publish' : 'unpublish'}`,
      {
        method: 'POST',
        body: { expectedVersion: item.version, payload: {} },
        schema: adminUpdateResponseSchema,
      },
    )
    replaceItem(response.data)
    if (editing.value?.id === response.data.id) {
      editing.value = response.data
    }
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    actionError.value = error instanceof AdminApiError
      && error.reason === 'VERSION_CONFLICT'
      ? '这条动态已在别处修改，发布状态没有改变。请刷新列表后重试。'
      : `${publish ? '发布' : '下架'}失败，请稍后重试。`
    await load()
  }
  finally {
    actionPendingId.value = null
  }
}

async function deleteSelected() {
  const target = deleteTarget.value
  if (!target || actionPendingId.value) {
    return
  }
  actionPendingId.value = target.id
  actionError.value = null
  try {
    await adminApi(`/api/admin/v1/updates/${target.id}`, {
      method: 'DELETE',
      body: { expectedVersion: target.version, payload: {} },
      schema: deleteUpdateResponseSchema,
    })
    items.value = items.value.filter(item => item.id !== target.id)
    if (editing.value?.id === target.id) {
      resetForm()
    }
    deleteTarget.value = null
  }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      return
    }
    deleteTarget.value = null
    actionError.value = error instanceof AdminApiError
      && error.reason === 'VERSION_CONFLICT'
      ? '这条动态已在别处修改，未删除。请刷新列表后重试。'
      : '删除失败，请稍后重试。'
    await load()
  }
  finally {
    actionPendingId.value = null
  }
}
</script>

<template>
  <AdminShell current="updates">
    <section class="admin-list-page updates-admin">
      <header class="admin-list-page__header">
        <h1 class="admin-list-page__title">动态管理</h1>
        <p v-if="status === 'ready'" class="admin-list-page__meta">
          共 {{ items.length }} 条
        </p>
      </header>

      <div class="updates-admin__layout">
        <form class="updates-form" @submit.prevent="submit">
          <header class="updates-form__header">
            <h2>{{ formTitle }}</h2>
            <button
              v-if="editing"
              type="button"
              class="updates-form__cancel"
              @click="resetForm"
            >取消编辑</button>
          </header>

          <label class="updates-form__field">
            <span>类型</span>
            <select v-model="form.type">
              <option v-for="type in UPDATE_TYPE_VALUES" :key="type" :value="type">
                {{ UPDATE_TYPE_LABELS[type] }}
              </option>
            </select>
          </label>

          <label class="updates-form__field">
            <span>标题</span>
            <input
              id="update-form-title"
              v-model="form.title"
              type="text"
              maxlength="200"
              required
            >
          </label>

          <label class="updates-form__field">
            <span>正文</span>
            <textarea
              v-model="form.content"
              rows="9"
              maxlength="20000"
              required
            />
            <small>纯文本，换行会在公开页面保留。</small>
          </label>

          <button class="updates-form__submit" type="submit" :disabled="!canSubmit">
            {{ submitting ? '保存中…' : editing ? '保存修改' : '保存为草稿' }}
          </button>
        </form>

        <div class="updates-admin__list">
          <p v-if="actionError" class="updates-admin__alert" role="alert">
            {{ actionError }}
          </p>
          <p v-if="status === 'loading'" class="updates-admin__state" role="status">
            正在加载…
          </p>
          <div v-else-if="status === 'error'" class="updates-admin__state" role="alert">
            <p>加载失败，请稍后重试。</p>
            <button type="button" @click="load">重新加载</button>
          </div>
          <p v-else-if="items.length === 0" class="updates-admin__state">
            还没有动态。请先在左侧保存一条草稿。
          </p>

          <article
            v-for="item in items"
            v-else
            :key="item.id"
            class="update-row"
            :data-update-id="item.id"
          >
            <header class="update-row__header">
              <div>
                <p class="update-row__meta">
                  <span>{{ UPDATE_TYPE_LABELS[item.type] }}</span>
                  <AdminStatusBadge
                    :label="UPDATE_PUBLICATION_LABELS[item.publicationStatus]"
                    :tone="item.publicationStatus === 'published'
                      ? 'success'
                      : item.publicationStatus === 'unpublished' ? 'warning' : 'neutral'"
                  />
                </p>
                <h2>{{ item.title }}</h2>
              </div>
              <time :datetime="item.updatedAt">
                更新于 {{ formatUpdateDateTime(item.updatedAt) }}
              </time>
            </header>
            <p class="update-row__content">{{ item.content }}</p>
            <p v-if="item.publishedAt" class="update-row__published">
              发布时间：{{ formatUpdateDateTime(item.publishedAt) }}
            </p>
            <div class="update-row__actions">
              <button type="button" @click="startEdit(item)">编辑</button>
              <button
                type="button"
                :disabled="actionPendingId !== null"
                @click="changePublication(item)"
              >{{ actionPendingId === item.id
                ? '处理中…'
                : item.publicationStatus === 'published' ? '下架' : '发布' }}</button>
              <button
                type="button"
                class="update-row__delete"
                :disabled="actionPendingId !== null"
                @click="deleteTarget = item"
              >删除</button>
            </div>
          </article>
        </div>
      </div>

      <AdminConfirmDialog
        :open="deleteTarget !== null"
        :title="deleteTarget ? `删除「${deleteTarget.title}」？` : '删除动态？'"
        confirm-label="确认删除"
        tone="danger"
        @confirm="deleteSelected"
        @cancel="deleteTarget = null"
      >
        <p>这条动态会永久删除；如果已经发布，也会立即从公开页面消失。此操作无法撤销。</p>
      </AdminConfirmDialog>
    </section>
  </AdminShell>
</template>

<style scoped>
.updates-admin__layout {
  display: grid;
  gap: var(--admin-space-6);
}

.updates-form,
.update-row,
.updates-admin__state {
  padding: var(--admin-space-5);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-lg);
  background: var(--admin-bg-primary);
}

.updates-form {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-5);
  align-self: start;
}

.updates-form__header,
.update-row__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--admin-space-3);
}

.updates-form__header h2,
.update-row h2 {
  margin: 0;
  font-size: var(--admin-font-md);
  line-height: var(--admin-line-tight);
}

.updates-form__cancel,
.update-row__actions button,
.updates-admin__state button {
  min-height: var(--admin-touch-target);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  cursor: pointer;
}

.updates-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-2);
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.updates-form__field input,
.updates-form__field select,
.updates-form__field textarea {
  width: 100%;
  min-height: var(--admin-control-height);
  padding: var(--admin-space-3);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-md);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-base);
  font-weight: 400;
}

.updates-form__field select {
  padding-block: 0;
}

.updates-form__field textarea {
  resize: vertical;
  line-height: var(--admin-line-normal);
}

.updates-form__field small {
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
  font-weight: 400;
}

.updates-form__submit {
  min-height: var(--admin-control-height);
  border: none;
  border-radius: var(--admin-radius-md);
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.updates-form__submit:disabled,
.update-row__actions button:disabled {
  opacity: 0.55;
  cursor: default;
}

.updates-admin__list {
  display: flex;
  flex-direction: column;
  gap: var(--admin-space-4);
  min-width: 0;
}

.updates-admin__alert {
  margin: 0;
  padding: var(--admin-space-3) var(--admin-space-4);
  border-radius: var(--admin-radius-md);
  background: var(--admin-status-error-soft);
  color: var(--admin-status-error);
  line-height: var(--admin-line-normal);
}

.updates-admin__state {
  color: var(--admin-text-secondary);
  text-align: center;
}

.updates-admin__state p {
  margin: 0 0 var(--admin-space-3);
}

.update-row__header time,
.update-row__published {
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
  white-space: nowrap;
}

.update-row__meta {
  display: flex;
  align-items: center;
  gap: var(--admin-space-2);
  margin: 0 0 var(--admin-space-2);
  color: var(--admin-text-secondary);
  font-size: var(--admin-font-xs);
}

.update-row__content {
  margin: var(--admin-space-4) 0 0;
  overflow-wrap: anywhere;
  color: var(--admin-text-secondary);
  line-height: var(--admin-line-normal);
  white-space: pre-line;
}

.update-row__published {
  margin: var(--admin-space-3) 0 0;
}

.update-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--admin-space-2);
  margin-top: var(--admin-space-4);
  padding-top: var(--admin-space-3);
  border-top: 1px solid var(--admin-border-secondary);
}

.update-row__actions button:hover:not(:disabled),
.updates-form__cancel:hover,
.updates-admin__state button:hover {
  background: var(--admin-bg-subtle);
}

.update-row__actions .update-row__delete {
  margin-left: auto;
  color: var(--admin-danger);
}

@media (min-width: 960px) {
  .updates-admin__layout {
    grid-template-columns: minmax(18rem, 0.72fr) minmax(28rem, 1.28fr);
    align-items: start;
  }

  .updates-form {
    position: sticky;
    top: var(--admin-space-6);
  }
}

@media (max-width: 479px) {
  .update-row__header {
    flex-direction: column;
  }

  .update-row__header time {
    white-space: normal;
  }
}
</style>

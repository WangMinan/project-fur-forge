<script setup lang="ts">
import { completeCommissionUploadResponseSchema, createCommissionUploadResponseSchema } from '~~/shared/schemas/commission'
import type { ManualCommissionSave } from '~~/shared/schemas/manual-commission'
import { AdminApiError } from '~/composables/useAdminApi'
import { buildUploadDeclaration, DECLARATION_FAILURE_LABELS } from '~/utils/upload-declaration'
import { putFileToSignedUrl } from '~/utils/signed-put'

const props = defineProps<{ existingHref: string | null, disabled: boolean }>()
const model = defineModel<ManualCommissionSave['upload']>({ default: undefined })
const emit = defineEmits<{ busy: [value: boolean] }>()
const api = useAdminApi()
const busy = shallowRef(false)
const stage = shallowRef('')
const startedAt = shallowRef(0)
const progress = shallowRef<number | null>(null)
const error = shallowRef<string | null>(null)
const previewError = shallowRef(false)
const removeOpen = shallowRef(false)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const href = computed(() => model.value ? `/api/admin/v1/commission-upload-sessions/${model.value.id}/preview` : model.value === null ? null : props.existingHref ? `${props.existingHref}?w=1280` : null)
let xhr: XMLHttpRequest | null = null
let abandoned = false

async function select(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || props.disabled || busy.value) return
  abandoned = false
  busy.value = true
  emit('busy', true)
  error.value = null
  progress.value = null
  startedAt.value = Date.now()
  stage.value = '正在检查图片…'
  let session: NonNullable<ManualCommissionSave['upload']> | undefined
  let failureHint = '读取图片失败，请重新选择文件。'
  try {
    if (!file.size || file.size > 20_000_000) {
      error.value = '请选择 1 字节到 20 MB 之间的图片。'
      return
    }
    const declaration = await buildUploadDeclaration(file)
    if (abandoned) return
    if (!declaration.ok) {
      error.value = DECLARATION_FAILURE_LABELS[declaration.reason]
      return
    }
    if (declaration.declaration.width < 64 || declaration.declaration.height < 64) {
      error.value = '图片边长至少需要 64 像素。'
      return
    }
    stage.value = '正在创建上传会话…'
    failureHint = '无法创建上传会话，请稍后重试。'
    const created = await api('/api/admin/v1/commission-upload-sessions', { method: 'POST', body: { expected: declaration.declaration }, schema: createCommissionUploadResponseSchema })
    session = { id: created.data.session.uploadSessionId, version: created.data.session.version, token: created.data.token }
    if (abandoned) return
    stage.value = '正在上传图片…'
    failureHint = '图片传输中断，请检查网络后重新选择图片。'
    const status = await putFileToSignedUrl(created.data.upload, file, ratio => { progress.value = ratio }, value => { xhr = value })
    if (abandoned) return
    if (status < 200 || status >= 300) {
      error.value = Date.now() >= Date.parse(created.data.upload.expiresAt)
        ? '上传签名已过期，请重新选择图片。'
        : '存储服务未接受图片，请重新选择后重试。'
      return
    }
    progress.value = null
    stage.value = '正在核验图片…'
    failureHint = '服务端未能核验图片，请重新选择后重试。'
    const completed = await api(`/api/admin/v1/commission-upload-sessions/${session.id}/complete`, {
      method: 'POST', body: { token: session.token, expectedVersion: session.version }, schema: completeCommissionUploadResponseSchema,
    })
    session.version = completed.data.session.version
    if (abandoned) return
    const old = model.value
    model.value = session
    session = undefined
    previewError.value = false
    if (old) await cancel(old)
    stage.value = '图片已核验，保存申请后生效。'
  }
  catch (failure) {
    if (failure instanceof AdminApiError && failure.reason === 'UPLOAD_SESSION_EXPIRED') {
      error.value = '图片上传会话已过期，请重新选择图片。'
    }
    else if (failure instanceof AdminApiError && failure.status === 401) {
      error.value = '登录已过期，请重新登录后再上传。'
    }
    else if (failure instanceof AdminApiError && failure.status === null) {
      error.value = '未收到服务端确认，请检查网络后重新选择图片。'
    }
    else error.value = failureHint
  }
  finally {
    xhr = null
    if (session && abandoned) await cancel(session)
    if (error.value) {
      stage.value = ''
      progress.value = null
    }
    busy.value = false
    emit('busy', false)
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function cancel(upload: NonNullable<ManualCommissionSave['upload']>) {
  await api(`/api/admin/v1/commission-upload-sessions/${upload.id}/cancel`, {
    method: 'POST', body: { token: upload.token, expectedVersion: upload.version }, schema: completeCommissionUploadResponseSchema,
  }).catch(() => { /* Unconsumed uploads remain eligible for the existing TTL cleanup. */ })
}
async function remove() {
  removeOpen.value = false
  const previous = model.value
  model.value = null
  if (previous) await cancel(previous)
  stage.value = '保存申请后移除设定图。'
}
watch(href, () => { previewError.value = false })
function stopUpload() {
  abandoned = true
  xhr?.abort()
}
function discard() {
  stopUpload()
  if (model.value && !props.disabled) {
    void cancel(model.value)
    model.value = undefined
  }
}
defineExpose({ discard })
onBeforeUnmount(stopUpload)
</script>

<template>
  <section class="editor-card commission-image" aria-labelledby="manual-image-heading">
    <div class="editor-card__head">
      <h2 id="manual-image-heading" class="editor-card__title">设定图</h2>
      <p class="editor-card__hint">{{ href ? '1/1' : '0/1' }} · 可后补</p>
    </div>
    <img v-if="href && !previewError" class="commission-image__preview" :src="href" alt="委托申请私有设定图" referrerpolicy="no-referrer" @error="previewError = true">
    <p v-else class="commission-image__empty">{{ previewError ? '设定图预览未能加载，请重试。' : '暂未上传设定图。' }}</p>
    <AdminAction v-if="previewError" :disabled="disabled" @click="previewError = false">重试预览</AdminAction>
    <label for="manual-image-file">选择设定图（JPEG、PNG、WebP，最多20 MB）</label>
    <AdminAction :disabled="disabled || busy" @click="fileInput?.click()">{{ href ? '更换设定图' : '选择设定图' }}</AdminAction>
    <input id="manual-image-file" ref="fileInput" hidden type="file" accept="image/jpeg,image/png,image/webp" :disabled="disabled || busy" @change="select">
    <AdminTaskProgress
      v-if="busy || error" label="设定图上传" :stage="stage" :status="error ? 'error' : 'active'"
      :mode="progress === null ? 'indeterminate' : 'determinate'" :value="progress" :max="1"
      :detail="error && href ? error + ' 当前设定图仍保留。' : error" :started-at="startedAt" show-elapsed
    />
    <p v-else-if="stage" role="status">{{ stage }}</p>
    <AdminAction v-if="href" :disabled="disabled || busy" @click="removeOpen = true">移除设定图</AdminAction>
    <AdminConfirmDialog :open="removeOpen" title="移除设定图？" confirm-label="移除，保存后生效" cancel-label="保留图片" tone="danger" @confirm="remove" @cancel="removeOpen = false">
      <p>保存申请后将移除设定图。没有设定图时不能导出制作单。</p>
    </AdminConfirmDialog>
  </section>
</template>

<style scoped>
.commission-image { display: grid; align-content: start; gap: var(--admin-space-3); min-width: 0; }
.commission-image > p { margin: 0; }
.commission-image .editor-card__head { margin-bottom: 0; }
.commission-image__preview { width: 100%; max-height: 28rem; object-fit: contain; border-radius: var(--admin-radius-md); background: var(--admin-bg-subtle); }
.commission-image__empty { padding: var(--admin-space-5); background: var(--admin-bg-subtle); border-radius: var(--admin-radius-md); color: var(--admin-text-secondary); }
.commission-image :deep(.admin-action) { justify-self: start; }
</style>

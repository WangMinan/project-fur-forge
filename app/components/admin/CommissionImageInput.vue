<script setup lang="ts">
import { completeCommissionUploadResponseSchema, createCommissionUploadResponseSchema } from '~~/shared/schemas/commission'
import type { ManualCommissionSave } from '~~/shared/schemas/manual-commission'
import { buildUploadDeclaration } from '~/utils/upload-declaration'
import { putFileToSignedUrl } from '~/utils/signed-put'

const props = defineProps<{ existingHref: string | null, disabled: boolean }>()
const model = defineModel<ManualCommissionSave['upload']>({ default: undefined })
const emit = defineEmits<{ busy: [value: boolean] }>()
const api = useAdminApi()
const busy = shallowRef(false)
const stage = shallowRef('')
const progress = shallowRef<number | null>(null)
const error = shallowRef<string | null>(null)
const previewError = shallowRef(false)
const removeOpen = shallowRef(false)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const href = computed(() => model.value ? `/api/admin/v1/commission-upload-sessions/${model.value.id}/preview` : model.value === null ? null : props.existingHref ? `${props.existingHref}?w=1280` : null)
let xhr: XMLHttpRequest | null = null
let active = true

async function select(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || props.disabled || busy.value) return
  busy.value = true; emit('busy', true); error.value = null; progress.value = null
  stage.value = '正在检查图片…'
  try {
    const declaration = await buildUploadDeclaration(file)
    if (!declaration.ok || file.size > 20_000_000 || declaration.declaration.width < 64 || declaration.declaration.height < 64) {
      error.value = '请选择64–12000像素、20 MB以内的JPEG、PNG或WebP图片。'
      return
    }
    const created = await api('/api/admin/v1/commission-upload-sessions', { method: 'POST', body: { expected: declaration.declaration }, schema: createCommissionUploadResponseSchema })
    stage.value = '正在上传图片…'
    const status = await putFileToSignedUrl(created.data.upload, file, ratio => { progress.value = ratio }, value => { xhr = value })
    if (status < 200 || status >= 300) throw new Error('upload failed')
    progress.value = null; stage.value = '正在核验图片…'
    const completed = await api(`/api/admin/v1/commission-upload-sessions/${created.data.session.uploadSessionId}/complete`, {
      method: 'POST', body: { token: created.data.token, expectedVersion: created.data.session.version }, schema: completeCommissionUploadResponseSchema,
    })
    if (!active) return
    const old = model.value
    model.value = { id: completed.data.session.uploadSessionId, version: completed.data.session.version, token: created.data.token }
    previewError.value = false
    if (old) await cancel(old)
    stage.value = '图片已核验，保存申请后生效。'
  }
  catch { error.value = `图片上传未完成，请重新选择后重试。${href.value ? '当前设定图仍保留。' : ''}` }
  finally {
    if (error.value) { stage.value = ''; progress.value = null }
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
onBeforeUnmount(() => { active = false; xhr?.abort() })
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
    <progress v-if="busy" class="commission-image__progress" :value="progress ?? undefined" max="1" aria-label="设定图上传进度" />
    <p v-if="stage" role="status">{{ stage }} {{ busy && progress !== null ? `${Math.round(progress * 100)}%` : '' }}</p>
    <p v-if="error" role="alert" class="commission-image__error">{{ error }}</p>
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
.commission-image__progress { width: 100%; }
.commission-image__error { color: var(--admin-status-error); }
.commission-image :deep(.admin-action) { justify-self: start; }
</style>

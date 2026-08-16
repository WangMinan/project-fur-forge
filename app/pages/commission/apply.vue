<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import {
  completeCommissionUploadResponseSchema,
  createCommissionSubmissionResponseSchema,
  createCommissionUploadResponseSchema,
} from '~~/shared/schemas/commission'
import type { ConditionalPutDto } from '~~/shared/types/contracts'
import { buildUploadDeclaration } from '~/utils/upload-declaration'
import { putFileToSignedUrl } from '~/utils/signed-put'

useSeoMeta({
  title: `提交委托申请 · ${PROJECT_NAME}`,
  description: '向有点小狗工作室私密提交一张设定图与委托联系信息。',
  robots: 'noindex, nofollow',
})

type FieldKey = 'file' | 'heightCm' | 'nickname' | 'phone' | 'qq' | 'weightKg'
type Stage = 'idle' | 'digesting' | 'uploading' | 'validating' | 'submitting' | 'success'

const form = reactive({
  nickname: '',
  phone: '',
  qq: '',
  heightCm: '',
  weightKg: '',
  website: '',
})
const errors = reactive<Record<FieldKey, string>>({
  file: '',
  heightCm: '',
  nickname: '',
  phone: '',
  qq: '',
  weightKg: '',
})
const file = shallowRef<File | null>(null)
const previewUrl = ref<string | null>(null)
const stage = ref<Stage>('idle')
const progress = ref<number | null>(null)
const submitError = ref<string | null>(null)
const receiptCode = ref<string | null>(null)
const activeSession = shallowRef<{
  completed: boolean
  id: string
  token: string
  version: number
} | null>(null)
let activeXhr: XMLHttpRequest | null = null

const busy = computed(() => !['idle', 'success'].includes(stage.value))
const stageText = computed(() => ({
  idle: '',
  digesting: '正在检查图片…',
  uploading: progress.value === null
    ? '正在上传私有设定图…'
    : `正在上传私有设定图… ${Math.round(progress.value * 100)}%`,
  validating: '正在核验图片…',
  submitting: '正在提交申请…',
  success: '提交成功',
})[stage.value])

function clearErrors() {
  for (const key of Object.keys(errors) as FieldKey[]) {
    errors[key] = ''
  }
  submitError.value = null
}

function validateFields() {
  clearErrors()
  if (!form.nickname.trim() || form.nickname.trim().length > 50) {
    errors.nickname = '请填写 1–50 字称呼'
  }
  if (!/^1[3-9]\d{9}$/u.test(form.phone)) {
    errors.phone = '请填写 11 位中国大陆手机号'
  }
  if (!/^[1-9]\d{4,11}$/u.test(form.qq)) {
    errors.qq = '请填写 5–12 位 QQ 号'
  }
  const heightCm = Number(form.heightCm)
  if (!Number.isInteger(heightCm) || heightCm < 80 || heightCm > 250) {
    errors.heightCm = '请填写 80–250 cm 的整数'
  }
  const weightKg = Number(form.weightKg)
  if (
    !Number.isFinite(weightKg)
    || weightKg < 20
    || weightKg > 300
    || Math.round(weightKg * 10) !== weightKg * 10
  ) {
    errors.weightKg = '请填写 20–300 kg，最多一位小数'
  }
  if (!file.value) {
    errors.file = '请选择一张设定图'
  }
  return !Object.values(errors).some(Boolean)
}

function releasePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

async function cancelActiveSession() {
  const session = activeSession.value
  activeSession.value = null
  if (!session || session.completed) {
    return
  }
  await $fetch(`/api/public/v1/commission-upload-sessions/${session.id}/cancel`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.token}` },
    body: { expectedVersion: session.version },
  }).catch(() => {})
}

async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0] ?? null
  await cancelActiveSession()
  releasePreview()
  file.value = selected
  errors.file = ''
  submitError.value = null
  if (selected) {
    previewUrl.value = URL.createObjectURL(selected)
  }
}

function requireReselection(message: string) {
  activeSession.value = null
  releasePreview()
  file.value = null
  errors.file = message
  const input = document.querySelector<HTMLInputElement>('#commission-design-reference')
  if (input) {
    input.value = ''
  }
  stage.value = 'idle'
}

async function createAndCompleteUpload(selected: File) {
  stage.value = 'digesting'
  if (selected.size > 20_000_000) {
    errors.file = '图片不能超过 20 MB'
    stage.value = 'idle'
    return null
  }
  const declaration = await buildUploadDeclaration(selected)
  if (!declaration.ok) {
    errors.file = '请选择可正常解码的 JPEG、PNG 或 WebP 图片'
    stage.value = 'idle'
    return null
  }
  if (declaration.declaration.width < 64 || declaration.declaration.height < 64) {
    errors.file = '图片宽高均需至少 64 像素'
    stage.value = 'idle'
    return null
  }
  const created = createCommissionUploadResponseSchema.parse(await $fetch(
    '/api/public/v1/commission-upload-sessions',
    {
      method: 'POST',
      body: { expected: declaration.declaration, website: form.website },
    },
  )).data
  activeSession.value = {
    completed: false,
    id: created.session.uploadSessionId,
    token: created.token,
    version: created.session.version,
  }

  stage.value = 'uploading'
  progress.value = 0
  let putStatus: number
  try {
    putStatus = await putFileToSignedUrl(
      created.upload as ConditionalPutDto,
      selected,
      ratio => progress.value = ratio,
      xhr => activeXhr = xhr,
    )
  }
  finally {
    activeXhr = null
    progress.value = null
  }
  if (putStatus === 403) {
    requireReselection('上传凭证已过期，请重新选择图片')
    return null
  }
  if (putStatus < 200 || putStatus >= 300) {
    throw new Error('SIGNED_PUT_FAILED')
  }

  stage.value = 'validating'
  const completed = completeCommissionUploadResponseSchema.parse(await $fetch(
    `/api/public/v1/commission-upload-sessions/${created.session.uploadSessionId}/complete`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${created.token}` },
      body: { expectedVersion: created.session.version },
    },
  )).data.session
  activeSession.value = {
    completed: true,
    id: completed.uploadSessionId,
    token: created.token,
    version: completed.version,
  }
  return activeSession.value
}

function responseStatus(error: unknown) {
  if (!error || typeof error !== 'object') {
    return 0
  }
  const record = error as Record<string, unknown>
  return Number(record.statusCode ?? record.status ?? 0)
}

async function submit() {
  if (busy.value || !validateFields() || !file.value) {
    return
  }
  try {
    const session = activeSession.value?.completed
      ? activeSession.value
      : await createAndCompleteUpload(file.value)
    if (!session) {
      return
    }
    stage.value = 'submitting'
    const result = createCommissionSubmissionResponseSchema.parse(await $fetch(
      '/api/public/v1/commission-submissions',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${session.token}` },
        body: {
          uploadSessionId: session.id,
          expectedUploadVersion: session.version,
          nickname: form.nickname.trim(),
          phone: { countryCode: '+86', number: form.phone },
          qq: form.qq,
          heightCm: Number(form.heightCm),
          weightKg: Number(form.weightKg),
          website: form.website,
        },
      },
    )).data
    receiptCode.value = result.receiptCode
    activeSession.value = null
    releasePreview()
    file.value = null
    stage.value = 'success'
  }
  catch (error) {
    if (responseStatus(error) === 409) {
      requireReselection('上传会话已失效，请重新选择图片后提交')
      submitError.value = '本次上传已失效，表单内容仍保留。'
      return
    }
    stage.value = 'idle'
    submitError.value = '暂时无法提交。表单和图片仍保留在本页，请稍后重试。'
  }
}

onBeforeUnmount(() => {
  activeXhr?.abort()
  releasePreview()
})
</script>

<template>
  <div class="commission-apply">
    <PublicPageIntro
      title="提交委托申请"
      description="设定图只用于工作室内部评估，不会公开展示。"
    />

    <div class="commission-apply__body">
      <section v-if="receiptCode" class="commission-apply__success" role="status">
        <p class="commission-apply__eyebrow">申请已收到</p>
        <h2>请保存回执编号</h2>
        <p class="commission-apply__receipt">{{ receiptCode }}</p>
        <p>工作室会通过你填写的联系方式人工沟通；本站不提供公开查询。</p>
        <NuxtLink to="/commission">返回自设委托</NuxtLink>
      </section>

      <form v-else class="commission-apply__form" novalidate @submit.prevent="submit">
        <p class="commission-apply__privacy">
          请勿在图片文件名或称呼中填写不必要的个人信息。全部字段仅用于本次委托评估。
        </p>

        <div class="commission-apply__field">
          <label for="commission-nickname">称呼 <span aria-hidden="true">*</span></label>
          <input
            id="commission-nickname"
            v-model="form.nickname"
            maxlength="50"
            autocomplete="nickname"
            :aria-invalid="Boolean(errors.nickname)"
            aria-describedby="commission-nickname-error"
          >
          <p id="commission-nickname-error" class="commission-apply__error">{{ errors.nickname }}</p>
        </div>

        <div class="commission-apply__field">
          <label for="commission-phone">中国大陆手机号 <span aria-hidden="true">*</span></label>
          <div class="commission-apply__phone">
            <span aria-hidden="true">+86</span>
            <input
              id="commission-phone"
              v-model="form.phone"
              inputmode="numeric"
              autocomplete="tel-national"
              maxlength="11"
              :aria-invalid="Boolean(errors.phone)"
              aria-describedby="commission-phone-error"
            >
          </div>
          <p id="commission-phone-error" class="commission-apply__error">{{ errors.phone }}</p>
        </div>

        <div class="commission-apply__field">
          <label for="commission-qq">QQ <span aria-hidden="true">*</span></label>
          <input
            id="commission-qq"
            v-model="form.qq"
            inputmode="numeric"
            autocomplete="off"
            maxlength="12"
            :aria-invalid="Boolean(errors.qq)"
            aria-describedby="commission-qq-error"
          >
          <p id="commission-qq-error" class="commission-apply__error">{{ errors.qq }}</p>
        </div>

        <div class="commission-apply__measurements">
          <div class="commission-apply__field">
            <label for="commission-height">身高（cm） <span aria-hidden="true">*</span></label>
            <input
              id="commission-height"
              v-model="form.heightCm"
              type="number"
              min="80"
              max="250"
              step="1"
              inputmode="numeric"
              :aria-invalid="Boolean(errors.heightCm)"
              aria-describedby="commission-height-error"
            >
            <p id="commission-height-error" class="commission-apply__error">{{ errors.heightCm }}</p>
          </div>
          <div class="commission-apply__field">
            <label for="commission-weight">体重（kg） <span aria-hidden="true">*</span></label>
            <input
              id="commission-weight"
              v-model="form.weightKg"
              type="number"
              min="20"
              max="300"
              step="0.1"
              inputmode="decimal"
              :aria-invalid="Boolean(errors.weightKg)"
              aria-describedby="commission-weight-error"
            >
            <p id="commission-weight-error" class="commission-apply__error">{{ errors.weightKg }}</p>
          </div>
        </div>

        <div class="commission-apply__field commission-apply__field--file">
          <label for="commission-design-reference">设定图 <span aria-hidden="true">*</span></label>
          <input
            id="commission-design-reference"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            :disabled="busy"
            :aria-invalid="Boolean(errors.file)"
            aria-describedby="commission-file-hint commission-file-error"
            @change="chooseFile"
          >
          <p id="commission-file-hint" class="commission-apply__hint">
            仅一张 JPEG、PNG 或 WebP，最大 20 MB；不会生成公开图片。
          </p>
          <p id="commission-file-error" class="commission-apply__error">{{ errors.file }}</p>
          <img
            v-if="previewUrl"
            class="commission-apply__preview"
            :src="previewUrl"
            alt="所选设定图预览"
          >
        </div>

        <div class="commission-apply__honeypot" aria-hidden="true">
          <label for="commission-website">网站</label>
          <input
            id="commission-website"
            v-model="form.website"
            tabindex="-1"
            autocomplete="off"
          >
        </div>

        <p v-if="submitError" class="commission-apply__submit-error" role="alert">
          {{ submitError }}
        </p>
        <p v-if="stageText" class="commission-apply__stage" role="status">{{ stageText }}</p>
        <button type="submit" :disabled="busy">
          {{ busy ? '正在处理…' : '确认提交' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.commission-apply__body {
  max-width: 46rem;
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-8);
}

.commission-apply__form,
.commission-apply__success {
  display: grid;
  gap: var(--space-5);
}

.commission-apply__privacy,
.commission-apply__hint {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.commission-apply__field {
  display: grid;
  gap: var(--space-2);
}

.commission-apply__field label {
  font-weight: 600;
}

.commission-apply__field input {
  min-width: 0;
  min-height: 2.75rem;
  padding: 0 var(--space-3);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-sm);
  background: var(--public-bg-primary);
  font: inherit;
}

.commission-apply__field input:focus {
  border-color: var(--public-accent-primary);
  outline: 2px solid color-mix(in srgb, var(--public-accent-primary) 24%, transparent);
  outline-offset: 1px;
}

.commission-apply__field input[aria-invalid='true'] {
  border-color: var(--public-status-error);
}

.commission-apply__phone {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-2);
}

.commission-apply__phone span {
  color: var(--public-text-secondary);
}

.commission-apply__measurements {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.commission-apply__error {
  min-height: 1.25em;
  color: var(--public-status-error);
  font-size: var(--font-size-sm);
}

.commission-apply__preview {
  display: block;
  width: min(100%, 28rem);
  max-height: 32rem;
  object-fit: contain;
  border-radius: var(--radius-image);
  background: var(--image-placeholder);
}

.commission-apply__honeypot {
  position: fixed;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.commission-apply__submit-error {
  padding: var(--space-3) var(--space-4);
  color: var(--public-status-error);
  background: var(--public-bg-secondary);
  border-radius: var(--radius-sm);
}

.commission-apply__stage {
  color: var(--public-text-secondary);
}

.commission-apply button {
  min-height: 3rem;
  padding: 0 var(--space-6);
  border: 0;
  border-radius: var(--radius-full);
  color: var(--public-text-inverse);
  background: var(--public-bg-inverse);
  font: inherit;
  font-weight: 600;
}

.commission-apply button:disabled {
  opacity: 0.55;
}

.commission-apply__success {
  padding: var(--space-7);
  border-radius: var(--radius-md);
  background: var(--public-bg-secondary);
  text-align: center;
}

.commission-apply__eyebrow {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.commission-apply__receipt {
  font-family: var(--font-public-display);
  font-size: var(--font-size-xl);
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
}

@media (max-width: 480px) {
  .commission-apply__measurements {
    grid-template-columns: 1fr;
  }
}
</style>

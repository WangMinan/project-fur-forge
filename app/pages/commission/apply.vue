<script setup lang="ts">
import { PROJECT_NAME } from '~~/shared/constants/project'
import {
  completeCommissionUploadResponseSchema,
  createCommissionSubmissionResponseSchema,
  createCommissionUploadResponseSchema,
} from '~~/shared/schemas/commission'
import { publicSiteContentResponseSchema } from '~~/shared/schemas/site-content'
import type { ConditionalPutDto } from '~~/shared/types/contracts'
import { privacyPolicyReadiness } from '~~/shared/utils/privacy-policy-readiness.mjs'
import { buildUploadDeclaration } from '~/utils/upload-declaration'
import { putFileToSignedUrl } from '~/utils/signed-put'

useSeoMeta({
  title: `提交委托申请 · ${PROJECT_NAME}`,
  description: '向有点小狗工作室私密提交一张设定图与委托联系信息。',
  robots: 'noindex, nofollow',
})

const { data: site, error: siteError } = await useFetch(
  '/api/public/v1/site-content',
  {
    key: 'public-commission-apply-site-content',
    headers: useRequestHeaders(['host']),
    transform: raw => publicSiteContentResponseSchema.parse(raw).data,
  },
)

const applicationAvailable = computed(() => (
  !siteError.value
  && privacyPolicyReadiness(
    site.value?.about.privacyPolicy,
    site.value?.contact.email,
  ).ready
))

type FieldKey = 'adultConfirmed' | 'file' | 'heightCm' | 'nickname' | 'phone'
  | 'privacyNoticeAcknowledged' | 'qq' | 'species' | 'weightKg'
type Stage = 'idle' | 'digesting' | 'uploading' | 'validating' | 'submitting' | 'success'

const form = reactive({
  adultConfirmed: false,
  nickname: '',
  species: '',
  phone: '',
  privacyNoticeAcknowledged: false,
  qq: '',
  heightCm: '',
  weightKg: '',
  website: '',
})
const errors = reactive<Record<FieldKey, string>>({
  adultConfirmed: '',
  file: '',
  heightCm: '',
  nickname: '',
  phone: '',
  privacyNoticeAcknowledged: '',
  qq: '',
  species: '',
  weightKg: '',
})
const validationErrorCount = computed(() => Object.values(errors).filter(Boolean).length)
const validationSummary = useTemplateRef<HTMLElement>('validationSummary')
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
  if (!form.species.trim() || form.species.trim().length > 50) {
    errors.species = '请填写 1–50 字物种'
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
  if (!form.adultConfirmed) {
    errors.adultConfirmed = '请确认已年满 18 周岁并有权提交设定图'
  }
  if (!form.privacyNoticeAcknowledged) {
    errors.privacyNoticeAcknowledged = '请阅读隐私政策并确认理解信息用途'
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

async function chooseFile(selected: File) {
  await cancelActiveSession()
  releasePreview()
  file.value = selected
  errors.file = ''
  submitError.value = null
  if (selected) {
    previewUrl.value = URL.createObjectURL(selected)
  }
}

async function removeFile() {
  await cancelActiveSession()
  releasePreview()
  file.value = null
  errors.file = ''
  submitError.value = null
}

function requireReselection(message: string) {
  activeSession.value = null
  releasePreview()
  file.value = null
  errors.file = message
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

function responseReason(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }
  const data = (error as { data?: { error?: { reason?: unknown } } }).data
  return typeof data?.error?.reason === 'string' ? data.error.reason : null
}

async function submit() {
  if (busy.value) {
    return
  }
  if (!validateFields() || !file.value) {
    await nextTick()
    validationSummary.value?.focus()
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
          adultConfirmed: form.adultConfirmed,
          uploadSessionId: session.id,
          expectedUploadVersion: session.version,
          nickname: form.nickname.trim(),
          species: form.species.trim(),
          phone: { countryCode: '+86', number: form.phone },
          privacyNoticeAcknowledged: form.privacyNoticeAcknowledged,
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
    if (responseStatus(error) === 409 && responseReason(error) === 'COMMISSION_PHONE_PENDING') {
      stage.value = 'idle'
      errors.phone = '该手机号已有待处理的委托申请，请等待处理后再提交'
      submitError.value = '未重复提交：请等待当前申请处理完成。'
      return
    }
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

      <section
        v-else-if="!applicationAvailable"
        class="commission-apply__unavailable"
        role="status"
      >
        <h2>委托申请暂不可提交</h2>
        <p>隐私政策和联系信息正在核对。完成后才会开放设定图上传与申请提交。</p>
        <div class="commission-apply__unavailable-actions">
          <PublicAction to="/privacy">查看隐私政策</PublicAction>
          <PublicAction to="/commission" variant="secondary">返回自设委托</PublicAction>
        </div>
      </section>

      <form v-else class="commission-apply__form" novalidate @submit.prevent="submit">
        <p class="commission-apply__privacy">
          我们会使用你提交的设定图、联系方式和体型信息评估申请、与你沟通，并在接单后用于委托履行和售后。设定图不会公开展示。请勿在文件名或称呼中填写不必要的个人信息。
        </p>

        <p
          v-if="validationErrorCount > 0"
          ref="validationSummary"
          class="commission-apply__validation-summary"
          role="alert"
          tabindex="-1"
        >请检查下方 {{ validationErrorCount }} 项信息后再提交。</p>

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
          <label for="commission-species">物种 <span aria-hidden="true">*</span></label>
          <input
            id="commission-species"
            v-model="form.species"
            maxlength="50"
            autocomplete="off"
            :aria-invalid="Boolean(errors.species)"
            aria-describedby="commission-species-error"
          >
          <p id="commission-species-error" class="commission-apply__error">{{ errors.species }}</p>
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

        <ImageDropzoneCard
          input-id="commission-design-reference"
          label="设定图"
          hint="仅一张 JPEG、PNG 或 WebP，最大 20 MB；只用于内部评估，不生成公开图片。"
          :disabled="busy"
          :error="errors.file"
          :file-name="file?.name ?? null"
          :preview-url="previewUrl"
          preview-alt="所选设定图预览"
          @select="chooseFile"
          @remove="removeFile"
        />

        <fieldset class="commission-apply__confirmations">
          <legend>提交前确认</legend>
          <div class="commission-apply__confirmation">
            <div class="commission-apply__checkbox-row">
              <input
                id="commission-adult-confirmed"
                v-model="form.adultConfirmed"
                type="checkbox"
                :aria-invalid="Boolean(errors.adultConfirmed)"
                aria-describedby="commission-adult-confirmed-error"
              >
              <label for="commission-adult-confirmed">
                我确认已年满 18 周岁，并有权提交这张设定图。
              </label>
            </div>
            <p id="commission-adult-confirmed-error" class="commission-apply__error">
              {{ errors.adultConfirmed }}
            </p>
          </div>
          <div class="commission-apply__confirmation">
            <div class="commission-apply__checkbox-row">
              <input
                id="commission-privacy-acknowledged"
                v-model="form.privacyNoticeAcknowledged"
                type="checkbox"
                :aria-invalid="Boolean(errors.privacyNoticeAcknowledged)"
                aria-describedby="commission-privacy-acknowledged-error commission-privacy-link"
              >
              <label for="commission-privacy-acknowledged">
                我已阅读《隐私政策》，并理解这些信息将用于申请评估、后续沟通以及接单后的委托履行和售后；提交申请不代表工作室已经接单，也不构成最终报价、排期或合同确认。
              </label>
            </div>
            <p id="commission-privacy-link" class="commission-apply__hint">
              <NuxtLink to="/privacy" target="_blank">在新窗口阅读隐私政策</NuxtLink>
            </p>
            <p id="commission-privacy-acknowledged-error" class="commission-apply__error">
              {{ errors.privacyNoticeAcknowledged }}
            </p>
          </div>
        </fieldset>

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
        <progress
          v-if="stage === 'uploading'"
          class="commission-apply__progress"
          :value="progress ?? 0"
          max="1"
          :aria-label="`私有设定图上传进度 ${Math.round((progress ?? 0) * 100)}%`"
        />
        <PublicAction
          type="submit"
          :loading="busy"
          loading-label="正在处理…"
        >确认提交</PublicAction>
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
.commission-apply__success,
.commission-apply__unavailable {
  display: grid;
  gap: var(--space-5);
}

.commission-apply__privacy,
.commission-apply__hint {
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.commission-apply__validation-summary {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  color: var(--public-status-error);
  background: color-mix(in srgb, var(--public-status-error) 8%, white);
  border: 1px solid color-mix(in srgb, var(--public-status-error) 28%, white);
  border-radius: var(--radius-md);
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

.commission-apply__confirmations {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  margin: 0;
  padding: var(--space-4);
  border: 1px solid var(--public-border-primary);
  border-radius: var(--radius-sm);
}

.commission-apply__confirmations legend {
  padding: 0 var(--space-2);
  font-weight: 600;
}

.commission-apply__confirmation {
  display: grid;
  gap: var(--space-1);
}

.commission-apply__checkbox-row {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  align-items: start;
  gap: var(--space-2);
}

.commission-apply__checkbox-row input {
  width: 1.125rem;
  height: 1.125rem;
  margin: 0.2em 0 0;
  accent-color: var(--public-accent-primary);
}

.commission-apply__checkbox-row input:focus-visible {
  outline: 2px solid var(--public-accent-primary);
  outline-offset: 2px;
}

.commission-apply__checkbox-row label {
  line-height: var(--line-height-relaxed);
}

.commission-apply__confirmation .commission-apply__hint {
  margin: 0 0 0 calc(1.25rem + var(--space-2));
}

.commission-apply__error {
  min-height: 1.25em;
  color: var(--public-status-error);
  font-size: var(--font-size-sm);
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

.commission-apply__progress {
  width: 100%;
  height: 0.5rem;
  accent-color: var(--public-accent-primary);
}

.commission-apply__success,
.commission-apply__unavailable {
  padding: var(--space-7);
  border-radius: var(--radius-md);
  background: var(--public-bg-secondary);
  text-align: center;
}

.commission-apply__unavailable-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-3);
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

<script setup lang="ts">
import { commissionRecipientsSchema } from '~~/shared/schemas/commission-email'
import { CONTACT_PLATFORM_LABELS } from '~~/shared/constants/contact'
import type {
  AdminOfficialChannel,
  AdminSiteContentDto,
  ContactPlatform,
  VerifiedAssetDto,
} from '~~/shared/types/contracts'
import {
  hasUnsafePlainText,
  isValidContactEmail,
  isValidContactQq,
  normalizeNullableText,
  SITE_CONTENT_LIMITS,
} from '~/utils/site-content'
import { adminUploadProgressModel } from '~/utils/admin-upload-progress'

const props = defineProps<{
  content: AdminSiteContentDto
  conflictSection: string | null
  savedSection: string | null
  savingSection: string | null
}>()

const emit = defineEmits<{
  conflict: []
  save: [payload: Record<string, unknown>]
}>()

const card = useSiteContentSectionCard({
  section: 'contact',
  content: () => props.content,
  conflictSection: () => props.conflictSection,
  savedSection: () => props.savedSection,
  savingSection: () => props.savingSection,
  extract: dto => ({
    email: dto.contact.email,
    commissionNotificationRecipients: [...dto.contact.commissionNotificationRecipients],
    // qrLinkUrl 是服务端从二维码派生的只读值，不进入草稿或提交体。
    officialChannels: dto.contact.officialChannels.map(channel => ({
      platform: channel.platform,
      account: channel.account,
      qrCodeAssetId: channel.qrCodeAssetId,
    })),
  }),
})

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const pendingPlatform = shallowRef<ContactPlatform | null>(null)

const upload = useContactQrUpload({
  getContactVersion: () => props.content.sectionVersions.contact,
  onConflict: () => emit('conflict'),
  onReady: (platform, asset) => setQrAsset(platform, asset),
})

type EditableOfficialChannel = Pick<
  AdminOfficialChannel,
  'account' | 'platform' | 'qrCodeAssetId'
>

function channelAccountIssue(channel: EditableOfficialChannel) {
  const account = channel.account?.trim() ?? ''
  if (!account) {
    return null
  }
  if (account.length > 120 || hasUnsafePlainText(account)) {
    return '账号最多 120 字，且只能填写安全纯文本'
  }
  if (!isValidContactQq(account)) {
    return `${CONTACT_PLATFORM_LABELS[channel.platform]}号为 5–12 位数字，且不以 0 开头`
  }
  return null
}

const issues = computed(() => {
  const found: Record<string, string> = {}
  const email = card.draft.value.email.trim()
  if (!isValidContactEmail(email)) {
    found.email = '请填写有效的官方邮箱（最多 254 字符）'
  }
  for (const channel of card.draft.value.officialChannels) {
    const issue = channelAccountIssue(channel)
    if (issue) {
      found[`account-${channel.platform}`] = issue
    }
  }
  if (!commissionRecipientsSchema.safeParse(card.draft.value.commissionNotificationRecipients).success) {
    found.recipients = '请填写有效且不重复的完整邮箱地址，或删除空白行。'
  }
  return found
})

function completeness(channel: EditableOfficialChannel) {
  const account = channel.account?.trim()
  if (account && channel.qrCodeAssetId) {
    return '信息完整，保存后可在公开页显示。'
  }
  if (!account && !channel.qrCodeAssetId) {
    return '还缺少账号和二维码，公开页暂不显示。'
  }
  return account
    ? '还缺少二维码，公开页暂不显示。'
    : '还缺少账号，公开页暂不显示。'
}

function processingRetryable(platform: ContactPlatform) {
  const code = upload.items[platform].asset?.processingFailureCode
  return code === 'UPLOAD_DERIVATIVE_FAILURE' || code === 'UPLOAD_PREPROCESS_FAILURE'
}

function uploadProgress(platform: ContactPlatform) {
  const item = upload.items[platform]
  return adminUploadProgressModel({
    failureText: item.failureText,
    ffmpeg: item.state === 'validating' && item.ffmpegExpected,
    label: `${CONTACT_PLATFORM_LABELS[platform]}二维码上传`,
    progress: item.progress,
    stage: item.state,
    stageLabel: item.state === 'validating'
      ? item.ffmpegExpected
        ? '正在用 FFmpeg Lanczos 生成私有适配源'
        : '正在生成并核验公开二维码图片'
      : item.state === 'ready'
        ? '新二维码已上传，保存联系方式后生效'
        : null,
  })
}

function setQrAsset(platform: ContactPlatform, asset: VerifiedAssetDto) {
  const channel = card.draft.value.officialChannels.find(
    candidate => candidate.platform === platform,
  )
  if (channel) {
    channel.qrCodeAssetId = asset.assetId
  }
}

function pickFile(platform: ContactPlatform) {
  if (upload.busy.value || card.saving.value) {
    return
  }
  pendingPlatform.value = platform
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const platform = pendingPlatform.value
  input.value = ''
  pendingPlatform.value = null
  if (file && platform) {
    void upload.start(file, platform)
  }
}

function reset() {
  upload.reset()
  card.reset()
}

function adoptLatest() {
  upload.reset()
  card.adoptLatest()
}

async function addRecipient() {
  card.draft.value.commissionNotificationRecipients.push('')
  await nextTick()
  document.getElementById(`notification-recipient-${card.draft.value.commissionNotificationRecipients.length - 1}`)?.focus()
}

async function removeRecipient(index: number) {
  card.draft.value.commissionNotificationRecipients.splice(index, 1)
  await nextTick()
  const remaining = card.draft.value.commissionNotificationRecipients.length
  document.getElementById(remaining ? `notification-recipient-${Math.min(index, remaining - 1)}` : 'notification-recipient-add')?.focus()
}

function save() {
  upload.reset()
  const email = card.draft.value.email.trim()
  const officialChannels = card.draft.value.officialChannels.map(channel => ({
    platform: channel.platform,
    account: normalizeNullableText(channel.account ?? ''),
    qrCodeAssetId: channel.qrCodeAssetId,
  }))
  // 与服务端相同地归一化空字符串；否则保存成功后 draft 的 '' 与响应的 null
  // 仍会被判为 dirty，成功提示消失、保存按钮也不会回到稳定状态。
  card.draft.value.email = email
  card.draft.value.officialChannels = officialChannels
  const commissionNotificationRecipients = commissionRecipientsSchema.parse(card.draft.value.commissionNotificationRecipients)
  card.draft.value.commissionNotificationRecipients = commissionNotificationRecipients
  emit('save', { email, officialChannels, commissionNotificationRecipients })
}
</script>

<template>
  <AdminSiteSectionCardShell
    section="contact"
    title="联系方式"
    hint="官方邮箱和 QQ 渠道公开展示；委托通知邮箱仅供工作室内部使用。"
    :conflict="card.conflict.value"
    :dirty="card.isDirty.value"
    :has-issues="Object.keys(issues).length > 0 || upload.busy.value"
    :saved="card.saved.value"
    :saving="card.saving.value"
    @adopt-latest="adoptLatest"
    @reset="reset"
    @save="save"
  >
    <div class="channels-field">
      <label class="channels-label" for="site-field-email">官方邮箱</label>
      <input
        id="site-field-email"
        v-model="card.draft.value.email"
        class="channels-input"
        :class="{ 'channels-input--invalid': Boolean(issues.email) }"
        type="email"
        :maxlength="SITE_CONTENT_LIMITS.emailMax"
        autocomplete="email"
        :aria-invalid="Boolean(issues.email)"
        :aria-describedby="issues.email ? 'site-field-email-issue' : undefined"
      >
      <p v-if="issues.email" id="site-field-email-issue" class="channels-issue" role="alert">
        {{ issues.email }}
      </p>
      <p v-else class="channels-hint">访客用它联系你；站内委托投递的通知地址在下方单独配置。</p>
    </div>

    <section class="channels-field" aria-labelledby="commission-recipients-title">
      <h4 id="commission-recipients-title" class="channels-label">委托通知邮箱</h4>
      <p class="channels-hint">每个邮箱都会收到完整投递文字及设定图附件。新增地址只接收未来投递；移除地址会取消尚未发送的通知，已经发送的邮件无法撤回。</p>
      <p v-if="content.contact.smtpStatus !== 'ready'" class="channels-issue" role="status">
        {{ content.contact.smtpStatus === 'invalid' ? '邮件配置不完整或无效，请联系维护人员。' : '邮件发送尚未启用，保存邮箱不会自动启用发送。' }}
      </p>
      <div v-for="(_email, index) in card.draft.value.commissionNotificationRecipients" :key="index" class="notification-recipient">
        <label :for="`notification-recipient-${index}`" class="channels-label">收件邮箱 {{ index + 1 }}</label>
        <div class="notification-recipient__controls">
          <input
            :id="`notification-recipient-${index}`" v-model="card.draft.value.commissionNotificationRecipients[index]"
            type="email" class="channels-input" maxlength="254" autocomplete="off"
            :aria-invalid="Boolean(issues.recipients)" :aria-describedby="issues.recipients ? 'notification-recipients-issue' : undefined">
          <AdminAction
            :aria-label="`删除收件邮箱 ${index + 1}`" :disabled="card.saving.value"
            @click="removeRecipient(index)">删除</AdminAction>
        </div>
      </div>
      <p v-if="issues.recipients" id="notification-recipients-issue" class="channels-issue" role="alert">{{ issues.recipients }}</p>
      <p v-if="!card.draft.value.commissionNotificationRecipients.length" class="channels-hint" role="status">未配置委托通知邮箱，新投递仅在后台列表中保存。</p>
      <AdminAction id="notification-recipient-add" :disabled="card.saving.value" @click="addRecipient">新增收件邮箱</AdminAction>
    </section>

    <div class="channels-list" data-testid="official-channel-list">
      <section
        v-for="channel in card.draft.value.officialChannels"
        :key="channel.platform"
        class="channel-row"
        :data-platform="channel.platform"
        :aria-labelledby="`channel-${channel.platform}-title`"
      >
        <div class="channel-row__head">
          <h4 :id="`channel-${channel.platform}-title`" class="channel-row__title">
            {{ CONTACT_PLATFORM_LABELS[channel.platform] }}
          </h4>
          <p class="channel-row__completeness" role="status">
            {{ completeness(channel) }}
          </p>
        </div>

        <div class="channel-row__body">
          <div class="channels-field">
            <label class="channels-label" :for="`site-field-${channel.platform}`">
              {{ CONTACT_PLATFORM_LABELS[channel.platform] }}账号
            </label>
            <input
              :id="`site-field-${channel.platform}`"
              v-model="channel.account"
              class="channels-input"
              :class="{
                'channels-input--invalid': Boolean(issues[`account-${channel.platform}`]),
              }"
              type="text"
              inputmode="numeric"
              :maxlength="SITE_CONTENT_LIMITS.qqMax"
              autocomplete="off"
              :aria-invalid="Boolean(issues[`account-${channel.platform}`])"
              :aria-describedby="issues[`account-${channel.platform}`]
                ? `site-field-${channel.platform}-issue`
                : undefined"
            >
            <p
              v-if="issues[`account-${channel.platform}`]"
              :id="`site-field-${channel.platform}-issue`"
              class="channels-issue"
              role="alert"
            >
              {{ issues[`account-${channel.platform}`] }}
            </p>
          </div>

          <div class="channel-row__qr">
            <div class="channel-row__preview">
              <img
                v-if="upload.items[channel.platform].previewUrl || channel.qrCodeAssetId"
                :src="upload.items[channel.platform].previewUrl
                  ?? `/api/admin/v1/media/assets/${channel.qrCodeAssetId}/preview?w=320`"
                :alt="`${CONTACT_PLATFORM_LABELS[channel.platform]}二维码预览`"
                class="channel-row__image"
                decoding="async"
                referrerpolicy="no-referrer"
              >
              <span v-else>未上传</span>
            </div>
            <AdminAction
              size="small"
              :disabled="upload.busy.value || card.saving.value"
              @click="pickFile(channel.platform)"
            >
              {{ upload.items[channel.platform].state === 'digesting'
                || upload.items[channel.platform].state === 'uploading'
                || upload.items[channel.platform].state === 'validating'
                ? '处理中…'
                : channel.qrCodeAssetId ? '替换二维码' : '上传二维码' }}
            </AdminAction>
          </div>
        </div>

        <AdminTaskProgress
          v-if="upload.items[channel.platform].state !== 'idle'"
          v-bind="uploadProgress(channel.platform)"
          :can-retry="processingRetryable(channel.platform)"
          retry-label="重试处理"
          @retry="upload.retryProcessing(channel.platform)"
        />
      </section>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      hidden
      :aria-label="pendingPlatform
        ? `选择${CONTACT_PLATFORM_LABELS[pendingPlatform]}二维码图片`
        : '选择平台二维码图片'"
      @change="onFileChange"
    >

    <template #latest>
      <dl class="channels-fixed">
        <dt>官方邮箱</dt>
        <dd>{{ card.latest.value.email }}</dd>
        <dt>委托通知邮箱</dt>
        <dd>{{ card.latest.value.commissionNotificationRecipients.join('、') || '未配置' }}</dd>
        <template v-for="channel in card.latest.value.officialChannels" :key="channel.platform">
          <dt>{{ CONTACT_PLATFORM_LABELS[channel.platform] }}</dt>
          <dd>
            {{ channel.account || '（未填写账号）' }} ·
            {{ channel.qrCodeAssetId ? '已关联二维码' : '未关联二维码' }}
          </dd>
        </template>
      </dl>
    </template>
  </AdminSiteSectionCardShell>
</template>

<style scoped>
.notification-recipient { display: grid; gap: var(--admin-space-2); min-width: 0; }
.notification-recipient__controls { display: flex; gap: var(--admin-space-2); }
.notification-recipient__controls input { flex: 1; min-width: 0; }

.channels-fixed {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--admin-space-1) var(--admin-space-3);
  margin: 0;
  font-size: var(--admin-font-sm);
}

.channels-fixed dt {
  color: var(--admin-text-secondary);
}

.channels-fixed dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.channels-hint,
.channels-issue,
.channel-row__completeness {
  margin: 0;
  font-size: var(--admin-font-xs);
  line-height: var(--admin-line-normal);
}

.channels-hint,
.channel-row__completeness {
  color: var(--admin-text-secondary);
}

.channels-issue {
  color: var(--admin-status-error);
}

.channels-field,
.channels-list {
  display: grid;
  gap: var(--admin-space-1);
}

.channels-list {
  gap: var(--admin-space-3);
}

.channels-label {
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.channels-input {
  width: 100%;
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
}

.channels-input--invalid {
  border-color: var(--admin-status-error);
}

.channel-row {
  display: grid;
  gap: var(--admin-space-2);
  padding: var(--admin-space-3);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-md);
}

.channel-row__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--admin-space-1) var(--admin-space-3);
}

.channel-row__title {
  margin: 0;
  font-size: var(--admin-font-sm);
  font-weight: 700;
}

.channel-row__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 8rem;
  align-items: start;
  gap: var(--admin-space-3);
}

.channel-row__qr {
  display: grid;
  gap: var(--admin-space-2);
}

.channel-row__preview {
  display: grid;
  place-items: center;
  width: 8rem;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-subtle);
  color: var(--admin-text-tertiary);
  font-size: var(--admin-font-xs);
}

.channel-row__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (max-width: 560px) {
  .channel-row__body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script setup lang="ts">
import { CONTACT_PLATFORM_LABELS } from '~~/shared/constants/contact'
import type {
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

/**
 * 草稿里的渠道形状：只包含管理员可编辑的字段。
 * `qrLinkUrl` 由服务端在保存时从二维码解码得出，不属于草稿（见 extract）。
 */
interface ChannelDraft {
  account: string | null
  platform: ContactPlatform
  qrCodeAssetId: string | null
}

const card = useSiteContentSectionCard({
  section: 'contact',
  content: () => props.content,
  conflictSection: () => props.conflictSection,
  savedSection: () => props.savedSection,
  savingSection: () => props.savingSection,
  extract: dto => ({
    email: dto.contact.email,
    /*
     * 只取可编辑字段。`qrLinkUrl` 是服务端保存时解码出来的派生值：
     * 若把它放进草稿，上传新二维码保存后服务端返回的新链接会与草稿里的旧值不等，
     * isDirty 永远为 true —— 保存按钮不变灰，并持续提示有未保存修改。
     */
    officialChannels: dto.contact.officialChannels.map<ChannelDraft>(channel => ({
      platform: channel.platform,
      account: channel.account,
      qrCodeAssetId: channel.qrCodeAssetId,
    })),
    antiScam: dto.contact.antiScam ?? '',
  }),
})

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const pendingPlatform = shallowRef<ContactPlatform | null>(null)

const upload = useContactQrUpload({
  getContactVersion: () => props.content.sectionVersions.contact,
  onConflict: () => emit('conflict'),
  onReady: (platform, asset) => setQrAsset(platform, asset),
})

function channelAccountIssue(channel: ChannelDraft) {
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
  const antiScam = card.draft.value.antiScam.trim()
  if (antiScam.length > SITE_CONTENT_LIMITS.antiScam) {
    found.antiScam = `最多 ${SITE_CONTENT_LIMITS.antiScam} 字`
  }
  else if (hasUnsafePlainText(antiScam)) {
    found.antiScam = '只允许安全纯文本，不能包含 HTML 或脚本'
  }
  return found
})

function completeness(channel: ChannelDraft) {
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

function save() {
  upload.reset()
  const email = card.draft.value.email.trim()
  const officialChannels = card.draft.value.officialChannels.map(channel => ({
    ...channel,
    account: normalizeNullableText(channel.account ?? ''),
  }))
  const antiScam = normalizeNullableText(card.draft.value.antiScam)

  // 与服务端相同地归一化空字符串；否则保存成功后 draft 的 '' 与响应的 null
  // 仍会被判为 dirty，成功提示消失、保存按钮也不会回到稳定状态。
  card.draft.value.email = email
  card.draft.value.officialChannels = officialChannels
  card.draft.value.antiScam = antiScam ?? ''
  emit('save', { email, officialChannels, antiScam })
}
</script>

<template>
  <AdminSiteSectionCardShell
    section="contact"
    title="官方联系方式与防诈骗提醒"
    hint="这些内容会公开显示，请只填写你愿意公开的官方渠道。"
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
      <p v-else class="channels-hint">访客用它联系你，也是委托估价的收件地址。</p>
    </div>

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

    <AdminSiteSectionTextField
      v-model="card.draft.value.antiScam"
      field="antiScam"
      label="防诈骗提醒"
      hint="提醒访客只认这些官方渠道，避免被冒充。"
      :max="SITE_CONTENT_LIMITS.antiScam"
      :rows="4"
      :issue="issues.antiScam"
    />

    <template #latest>
      <dl class="channels-fixed">
        <dt>官方邮箱</dt>
        <dd>{{ card.latest.value.email }}</dd>
        <template v-for="channel in card.latest.value.officialChannels" :key="channel.platform">
          <dt>{{ CONTACT_PLATFORM_LABELS[channel.platform] }}</dt>
          <dd>
            {{ channel.account || '（未填写账号）' }} ·
            {{ channel.qrCodeAssetId ? '已关联二维码' : '未关联二维码' }}
          </dd>
        </template>
        <dt>防诈骗提醒</dt>
        <dd>{{ card.latest.value.antiScam || '（未填写）' }}</dd>
      </dl>
    </template>
  </AdminSiteSectionCardShell>
</template>

<style scoped>
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

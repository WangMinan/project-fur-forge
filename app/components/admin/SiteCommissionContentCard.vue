<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import type { SiteContentSectionPayloads } from '~/composables/useAdminSiteContent'
import {
  hasUnsafePlainText,
  normalizeNullableText,
  SITE_CONTENT_LIMITS,
} from '~/utils/site-content'

const props = defineProps<{
  content: AdminSiteContentDto['commission']
  mutating: boolean
  saved: boolean
}>()
const emit = defineEmits<{ save: [payload: SiteContentSectionPayloads['commission']] }>()

const intro = ref(props.content.intro ?? '')
const estimateNote = ref(props.content.estimateNote ?? '')
const emailAction = ref(props.content.emailAction ?? '')
const snapshot = () => JSON.stringify({ intro: intro.value, estimateNote: estimateNote.value, emailAction: emailAction.value })
const baseline = ref(snapshot())
const dirty = computed(() => snapshot() !== baseline.value)

function serverSnapshot(value: typeof props.content) {
  return JSON.stringify({ intro: value.intro ?? '', estimateNote: value.estimateNote ?? '', emailAction: value.emailAction ?? '' })
}
watch(() => props.content, (value) => {
  if (!dirty.value) {
    intro.value = value.intro ?? ''
    estimateNote.value = value.estimateNote ?? ''
    emailAction.value = value.emailAction ?? ''
  }
  baseline.value = serverSnapshot(value)
}, { deep: true })

const issue = computed(() => {
  const fields = [
    [intro.value, SITE_CONTENT_LIMITS.intro],
    [estimateNote.value, SITE_CONTENT_LIMITS.estimateNote],
    [emailAction.value, SITE_CONTENT_LIMITS.emailAction],
  ] as const
  return fields.some(([value, max]) => value.trim().length > max || hasUnsafePlainText(value.trim()))
})
const canSubmit = computed(() => dirty.value && !issue.value && !props.mutating)
function save() {
  if (!canSubmit.value) return
  emit('save', {
    intro: normalizeNullableText(intro.value),
    estimateNote: normalizeNullableText(estimateNote.value),
    emailAction: normalizeNullableText(emailAction.value),
  })
}
</script>

<template>
  <AdminSiteSectionCard
    title="自设委托页"
    description="维护委托页开场、人工估价和邮件行动说明；常见问题在下一张 Card 独立保存。"
    save-label="保存委托文案"
    :can-submit="canSubmit"
    :mutating="mutating"
    :saved="saved && !dirty"
    @save="save"
  >
    <div class="admin-content-field">
      <label class="admin-content-label" for="sc-intro">委托短说明（{{ intro.trim().length }}/{{ SITE_CONTENT_LIMITS.intro }}）</label>
      <textarea id="sc-intro" v-model="intro" class="admin-content-textarea" rows="3" :maxlength="SITE_CONTENT_LIMITS.intro" :disabled="mutating" />
    </div>
    <div class="admin-content-field">
      <label class="admin-content-label" for="sc-estimate">人工估价说明（{{ estimateNote.trim().length }}/{{ SITE_CONTENT_LIMITS.estimateNote }}）</label>
      <textarea id="sc-estimate" v-model="estimateNote" class="admin-content-textarea" rows="5" :maxlength="SITE_CONTENT_LIMITS.estimateNote" :disabled="mutating" />
    </div>
    <div class="admin-content-field">
      <label class="admin-content-label" for="sc-email-action">邮件行动说明（{{ emailAction.trim().length }}/{{ SITE_CONTENT_LIMITS.emailAction }}）</label>
      <textarea id="sc-email-action" v-model="emailAction" class="admin-content-textarea" rows="3" :maxlength="SITE_CONTENT_LIMITS.emailAction" :disabled="mutating" />
    </div>
    <p v-if="issue" class="admin-content-issue" role="alert">请检查字数，并移除 HTML 或脚本内容。</p>
  </AdminSiteSectionCard>
</template>

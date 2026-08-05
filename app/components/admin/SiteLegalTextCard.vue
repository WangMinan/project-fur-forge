<script setup lang="ts">
import type { SiteContentSectionPayloads } from '~/composables/useAdminSiteContent'
import { hasUnsafePlainText, normalizeNullableText, SITE_CONTENT_LIMITS } from '~/utils/site-content'

const props = defineProps<{
  section: 'terms' | 'privacy'
  value: string | null
  mutating: boolean
  saved: boolean
}>()
const emit = defineEmits<{
  save: [section: 'terms' | 'privacy', payload: SiteContentSectionPayloads['terms'] | SiteContentSectionPayloads['privacy']]
}>()
const draft = ref(props.value ?? '')
const baseline = ref(props.value ?? '')
const dirty = computed(() => draft.value !== baseline.value)
watch(() => props.value, (value) => {
  if (!dirty.value) draft.value = value ?? ''
  baseline.value = value ?? ''
})
const max = computed(() => props.section === 'terms' ? SITE_CONTENT_LIMITS.basicTerms : SITE_CONTENT_LIMITS.privacyPolicy)
const issue = computed(() => draft.value.trim().length > max.value || hasUnsafePlainText(draft.value.trim()))
const canSubmit = computed(() => dirty.value && !issue.value && !props.mutating)
const title = computed(() => props.section === 'terms' ? '服务条款' : '隐私政策')
const description = computed(() => props.section === 'terms'
  ? '单独维护公开服务条款；本区保存不影响隐私政策和其他文案。'
  : '内容必须与网站实际收集、保存和使用信息的方式一致。')
function save() {
  if (!canSubmit.value) return
  const value = normalizeNullableText(draft.value)
  emit('save', props.section, props.section === 'terms' ? { basicTerms: value } : { privacyPolicy: value })
}
</script>

<template>
  <AdminSiteSectionCard
    :title="title"
    :description="description"
    :save-label="`保存${title}`"
    :can-submit="canSubmit"
    :mutating="mutating"
    :saved="saved && !dirty"
    @save="save"
  >
    <div class="admin-content-field">
      <label class="admin-content-label" :for="`legal-${section}`">{{ title }}（{{ draft.trim().length }}/{{ max }}）</label>
      <textarea :id="`legal-${section}`" v-model="draft" class="admin-content-textarea admin-content-textarea--long" rows="14" :maxlength="max" :disabled="mutating" />
      <p class="admin-content-hint">只支持纯文本；空行分段。</p>
      <p v-if="issue" class="admin-content-issue" role="alert">请检查字数，并移除 HTML 或脚本内容。</p>
    </div>
  </AdminSiteSectionCard>
</template>

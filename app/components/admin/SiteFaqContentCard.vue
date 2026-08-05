<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import type { SiteContentSectionPayloads } from '~/composables/useAdminSiteContent'
import { hasUnsafePlainText, SITE_CONTENT_LIMITS } from '~/utils/site-content'

const props = defineProps<{
  faqs: AdminSiteContentDto['commission']['faqs']
  mutating: boolean
  saved: boolean
}>()
const emit = defineEmits<{ save: [payload: SiteContentSectionPayloads['faq']] }>()
type Row = AdminSiteContentDto['commission']['faqs'][number]
const rows = ref<Row[]>(props.faqs.map(row => ({ ...row })))
const snapshot = () => JSON.stringify(rows.value)
const baseline = ref(snapshot())
const dirty = computed(() => snapshot() !== baseline.value)
watch(() => props.faqs, (value) => {
  if (!dirty.value) rows.value = value.map(row => ({ ...row }))
  baseline.value = JSON.stringify(value)
}, { deep: true })

const issues = computed(() => {
  const result: Record<string, string> = {}
  const seen = new Set<string>()
  rows.value.forEach((row) => {
    const question = row.question.trim()
    const answer = row.answer.trim()
    if (!question || !answer) result[row.id] = '问题与回答必须同时填写。'
    else if (question.length > SITE_CONTENT_LIMITS.faqQuestion || answer.length > SITE_CONTENT_LIMITS.faqAnswer) result[row.id] = '问题或回答超过字数限制。'
    else if (hasUnsafePlainText(question) || hasUnsafePlainText(answer)) result[row.id] = '只允许安全纯文本。'
    else if (seen.has(question)) result[row.id] = '问题不得重复。'
    seen.add(question)
  })
  return result
})
const canSubmit = computed(() => dirty.value && rows.value.length <= SITE_CONTENT_LIMITS.faqMaxCount && Object.keys(issues.value).length === 0 && !props.mutating)
function add() {
  if (rows.value.length < SITE_CONTENT_LIMITS.faqMaxCount) {
    rows.value = [...rows.value, { id: crypto.randomUUID(), question: '', answer: '' }]
  }
}
function remove(id: string) { rows.value = rows.value.filter(row => row.id !== id) }
function save() {
  if (!canSubmit.value) return
  emit('save', { faqs: rows.value.map(row => ({ id: row.id, question: row.question.trim(), answer: row.answer.trim() })) })
}
</script>

<template>
  <AdminSiteSectionCard
    title="委托常见问题"
    description="FAQ 使用稳定 ID 和独立版本；调整本区不会覆盖委托页、条款或联系方式。"
    save-label="保存常见问题"
    :can-submit="canSubmit"
    :mutating="mutating"
    :saved="saved && !dirty"
    @save="save"
  >
    <div v-for="(row, index) in rows" :key="row.id" class="faq-row">
      <div class="faq-row__head">
        <strong>问题 {{ index + 1 }}</strong>
        <button type="button" class="admin-content-secondary-button" :disabled="mutating" @click="remove(row.id)">删除</button>
      </div>
      <div class="admin-content-field">
        <label class="admin-content-label" :for="`faq-question-${row.id}`">问题</label>
        <input :id="`faq-question-${row.id}`" v-model="row.question" class="admin-content-input" :maxlength="SITE_CONTENT_LIMITS.faqQuestion" :disabled="mutating">
      </div>
      <div class="admin-content-field">
        <label class="admin-content-label" :for="`faq-answer-${row.id}`">回答</label>
        <textarea :id="`faq-answer-${row.id}`" v-model="row.answer" class="admin-content-textarea" rows="4" :maxlength="SITE_CONTENT_LIMITS.faqAnswer" :disabled="mutating" />
      </div>
      <p v-if="issues[row.id]" class="admin-content-issue" role="alert">{{ issues[row.id] }}</p>
    </div>
    <button v-if="rows.length < SITE_CONTENT_LIMITS.faqMaxCount" type="button" class="admin-content-secondary-button faq-add" :disabled="mutating" @click="add">新增问题</button>
  </AdminSiteSectionCard>
</template>

<style scoped>
.faq-row { display: grid; gap: var(--admin-space-3); padding: var(--admin-space-4); border: 1px solid var(--admin-border-secondary); border-radius: var(--admin-radius-sm); }
.faq-row__head { display: flex; align-items: center; justify-content: space-between; gap: var(--admin-space-3); font-size: var(--admin-font-xs); }
.faq-add { justify-self: start; }
</style>

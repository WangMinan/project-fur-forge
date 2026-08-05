<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import {
  hasUnsafePlainText,
  normalizeNullableText,
  SITE_CONTENT_LIMITS,
} from '~/utils/site-content'

/** T34-F3 委托基础文案：独立分区、独立版本、独立保存。 */
const props = defineProps<{
  content: AdminSiteContentDto
  conflictSection: string | null
  savedSection: string | null
  savingSection: string | null
}>()

const emit = defineEmits<{
  save: [payload: Record<string, unknown>]
}>()

const card = useSiteContentSectionCard({
  section: 'commission',
  content: () => props.content,
  conflictSection: () => props.conflictSection,
  savedSection: () => props.savedSection,
  savingSection: () => props.savingSection,
  extract: dto => ({
    intro: dto.commission.intro ?? '',
    estimateNote: dto.commission.estimateNote ?? '',
    emailAction: dto.commission.emailAction ?? '',
  }),
})

const FIELDS = [
  { field: 'intro', label: '委托简介', max: SITE_CONTENT_LIMITS.intro, rows: 3 },
  { field: 'estimateNote', label: '人工估价说明', max: SITE_CONTENT_LIMITS.estimateNote, rows: 5 },
  { field: 'emailAction', label: '邮件联系引导', max: SITE_CONTENT_LIMITS.emailAction, rows: 3 },
] as const

const issues = computed(() => {
  const found: Record<string, string> = {}
  for (const { field, label, max } of FIELDS) {
    const value = card.draft.value[field].trim()
    if (value.length > max) {
      found[field] = `${label}最多 ${max} 字`
    }
    else if (hasUnsafePlainText(value)) {
      found[field] = '只允许安全纯文本，不能包含 HTML 或脚本'
    }
  }
  return found
})

function save() {
  emit('save', {
    intro: normalizeNullableText(card.draft.value.intro),
    estimateNote: normalizeNullableText(card.draft.value.estimateNote),
    emailAction: normalizeNullableText(card.draft.value.emailAction),
  })
}
</script>

<template>
  <AdminSiteSectionCardShell
    section="commission"
    title="委托基础文案"
    hint="留空即不在委托页显示该段。"
    :conflict="card.conflict.value"
    :dirty="card.isDirty.value"
    :has-issues="Object.keys(issues).length > 0"
    :saved="card.saved.value"
    :saving="card.saving.value"
    @adopt-latest="card.adoptLatest"
    @reset="card.reset"
    @save="save"
  >
    <AdminSiteSectionTextField
      v-for="item in FIELDS"
      :key="item.field"
      v-model="card.draft.value[item.field]"
      :field="item.field"
      :label="item.label"
      :max="item.max"
      :rows="item.rows"
      :issue="issues[item.field]"
    />

    <template #latest>
      <dl class="commission-latest">
        <template v-for="item in FIELDS" :key="`latest-${item.field}`">
          <dt>{{ item.label }}</dt>
          <dd>{{ card.latest.value[item.field] || '（未填写）' }}</dd>
        </template>
      </dl>
    </template>
  </AdminSiteSectionCardShell>
</template>

<style scoped>
.commission-latest {
  display: grid;
  gap: var(--admin-space-1);
  margin: 0;
  font-size: var(--admin-font-xs);
}

.commission-latest dt {
  color: var(--admin-text-secondary);
  font-weight: 600;
}

.commission-latest dd {
  margin: 0 0 var(--admin-space-2);
  white-space: pre-wrap;
}
</style>

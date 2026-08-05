<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import {
  hasUnsafePlainText,
  normalizeNullableText,
  SITE_CONTENT_LIMITS,
} from '~/utils/site-content'

/** T34-F3 关于工作室与制作范围：独立分区。 */
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
  section: 'about',
  content: () => props.content,
  conflictSection: () => props.conflictSection,
  savedSection: () => props.savedSection,
  savingSection: () => props.savingSection,
  extract: dto => ({
    studioFacts: dto.about.studioFacts ?? '',
    makingScope: dto.about.makingScope ?? '',
  }),
})

const FIELDS = [
  { field: 'studioFacts', label: '工作室介绍', max: SITE_CONTENT_LIMITS.studioFacts, rows: 6 },
  { field: 'makingScope', label: '制作范围', max: SITE_CONTENT_LIMITS.makingScope, rows: 6 },
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
    studioFacts: normalizeNullableText(card.draft.value.studioFacts),
    makingScope: normalizeNullableText(card.draft.value.makingScope),
  })
}
</script>

<template>
  <AdminSiteSectionCardShell
    section="about"
    title="关于工作室与制作范围"
    hint="显示在“关于我们”页面，留空即不显示该段。"
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
      <dl class="about-latest">
        <template v-for="item in FIELDS" :key="`latest-${item.field}`">
          <dt>{{ item.label }}</dt>
          <dd>{{ card.latest.value[item.field] || '（未填写）' }}</dd>
        </template>
      </dl>
    </template>
  </AdminSiteSectionCardShell>
</template>

<style scoped>
.about-latest {
  display: grid;
  gap: var(--admin-space-1);
  margin: 0;
  font-size: var(--admin-font-xs);
}

.about-latest dt {
  color: var(--admin-text-secondary);
  font-weight: 600;
}

.about-latest dd {
  margin: 0 0 var(--admin-space-2);
  white-space: pre-wrap;
}
</style>

<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import {
  hasUnsafePlainText,
  normalizeNullableText,
  SITE_CONTENT_LIMITS,
} from '~/utils/site-content'

/** R4-E 首页 2-4 幕文字块导语：三条共用一个分区版本与一次保存。 */
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
  section: 'home-copy',
  content: () => props.content,
  conflictSection: () => props.conflictSection,
  savedSection: () => props.savedSection,
  savingSection: () => props.savingSection,
  extract: dto => ({
    featuredLead: dto.homeCopy.featuredLead ?? '',
    commissionLead: dto.homeCopy.commissionLead ?? '',
    adoptionLead: dto.homeCopy.adoptionLead ?? '',
  }),
})

const FIELDS = [
  {
    field: 'featuredLead',
    label: '第二幕 代表作品',
    hint: '出现在“代表作品”章节标题下方。',
    max: SITE_CONTENT_LIMITS.homeFeaturedLead,
    rows: 3,
  },
  {
    field: 'commissionLead',
    label: '第三幕 自设委托',
    hint: '出现在“自设委托”章节标题与营业状态下方。',
    max: SITE_CONTENT_LIMITS.homeCommissionLead,
    rows: 3,
  },
  {
    field: 'adoptionLead',
    label: '第四幕 设定领养',
    hint: '出现在“设定领养”章节标题与营业状态下方。',
    max: SITE_CONTENT_LIMITS.homeAdoptionLead,
    rows: 3,
  },
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
    featuredLead: normalizeNullableText(card.draft.value.featuredLead),
    commissionLead: normalizeNullableText(card.draft.value.commissionLead),
    adoptionLead: normalizeNullableText(card.draft.value.adoptionLead),
  })
}
</script>

<template>
  <AdminSiteSectionCardShell
    section="home-copy"
    title="首页章节文案"
    hint="首页第 2-4 幕的导语。章节标题、英文小标与按钮文字不在此处配置；留空即该幕不显示导语。"
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
      :hint="item.hint"
      :max="item.max"
      :rows="item.rows"
      :issue="issues[item.field]"
    />

    <template #latest>
      <dl class="home-copy-latest">
        <template v-for="item in FIELDS" :key="`latest-${item.field}`">
          <dt>{{ item.label }}</dt>
          <dd>{{ card.latest.value[item.field] || '（未填写）' }}</dd>
        </template>
      </dl>
    </template>
  </AdminSiteSectionCardShell>
</template>

<style scoped>
.home-copy-latest {
  display: grid;
  gap: var(--admin-space-1);
  margin: 0;
  font-size: var(--admin-font-xs);
}

.home-copy-latest dt {
  color: var(--admin-text-secondary);
  font-weight: 600;
}

.home-copy-latest dd {
  margin: 0 0 var(--admin-space-2);
  white-space: pre-wrap;
}
</style>

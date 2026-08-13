<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import {
  hasUnsafePlainText,
  normalizeNullableText,
  SITE_CONTENT_LIMITS,
} from '~/utils/site-content'

/**
 * T34-F3 服务条款 / 隐私政策：结构相同的单字段长文本分区。
 * 两者各自独立版本与独立保存，因此用同一组件按 section 参数化，不做两份重复实现。
 */
const props = defineProps<{
  content: AdminSiteContentDto
  conflictSection: string | null
  savedSection: string | null
  savingSection: string | null
  section: 'privacy' | 'terms'
}>()

const emit = defineEmits<{
  save: [payload: Record<string, unknown>]
}>()

const CONFIG = {
  terms: {
    field: 'basicTerms',
    title: '服务条款',
    label: '服务条款正文',
    hint: '直接面向访客；写清价格、权利、修改、保修和官方渠道，空行分段。',
    max: SITE_CONTENT_LIMITS.basicTerms,
  },
  privacy: {
    field: 'privacyPolicy',
    title: '隐私政策',
    label: '隐私政策正文',
    hint: '直接面向访客；只说明当前实际处理的信息、用途、保存期限和联系办法，空行分段。',
    max: SITE_CONTENT_LIMITS.privacyPolicy,
  },
} as const

const config = computed(() => CONFIG[props.section])

const card = useSiteContentSectionCard({
  section: props.section,
  content: () => props.content,
  conflictSection: () => props.conflictSection,
  savedSection: () => props.savedSection,
  savingSection: () => props.savingSection,
  extract: dto => ({
    value: props.section === 'terms'
      ? dto.about.basicTerms ?? ''
      : dto.about.privacyPolicy ?? '',
  }),
})

const issue = computed(() => {
  const value = card.draft.value.value.trim()
  if (value.length > config.value.max) {
    return `最多 ${config.value.max} 字`
  }
  return hasUnsafePlainText(value)
    ? '只允许安全纯文本，不能包含 HTML 或脚本'
    : undefined
})

function save() {
  emit('save', {
    [config.value.field]: normalizeNullableText(card.draft.value.value),
  })
}
</script>

<template>
  <AdminSiteSectionCardShell
    :section="section"
    :title="config.title"
    :hint="config.hint"
    :conflict="card.conflict.value"
    :dirty="card.isDirty.value"
    :has-issues="Boolean(issue)"
    :saved="card.saved.value"
    :saving="card.saving.value"
    @adopt-latest="card.adoptLatest"
    @reset="card.reset"
    @save="save"
  >
    <AdminSiteSectionTextField
      v-model="card.draft.value.value"
      :field="config.field"
      :label="config.label"
      :max="config.max"
      :rows="12"
      :issue="issue"
    />

    <template #latest>
      <p class="legal-latest">{{ card.latest.value.value || '（未填写）' }}</p>
    </template>
  </AdminSiteSectionCardShell>
</template>

<style scoped>
.legal-latest {
  margin: 0;
  max-height: 12rem;
  overflow-y: auto;
  font-size: var(--admin-font-xs);
  white-space: pre-wrap;
}
</style>

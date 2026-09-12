<script setup lang="ts">
import { adminSiteCopyResponseSchema, SITE_COPY_FIELDS, SITE_COPY_TITLES, siteCopySchemas, type AdminSiteCopy, type SiteCopySection } from '~~/shared/schemas/site-copy'
import { AdminApiError } from '~/composables/useAdminApi'

const props = defineProps<{ content: AdminSiteCopy, section: SiteCopySection }>()
const emit = defineEmits<{ saved: [data: AdminSiteCopy, section: SiteCopySection], busy: [section: SiteCopySection, value: boolean] }>()
const api = useAdminApi()
const saving = ref(false)
const saved = ref(false)
const conflict = ref(false)
const error = ref('')
const card = useSiteContentSectionCard({
  content: () => props.content,
  section: props.section,
  extract: dto => Object.fromEntries(Object.entries(dto.sections[props.section].fields).map(([key, value]) => [key, value ?? ''])),
  savingSection: () => saving.value ? props.section : null,
  savedSection: () => saved.value ? props.section : null,
  conflictSection: () => conflict.value ? props.section : null,
})
const fields = computed(() => SITE_COPY_FIELDS[props.section])
const payload = computed(() => Object.fromEntries(Object.entries(card.draft.value).map(([key, value]) => [key, value.trim() || null])))
const issues = computed(() => {
  const result = siteCopySchemas[props.section].safeParse(payload.value)
  const found: Record<string, string> = {}
  if (!result.success) for (const issue of result.error.issues) found[String(issue.path[0])] = '请检查字数限制；仅允许安全纯文本。'
  if (props.content.locale === 'zh-CN' && props.section === 'status' && !payload.value.label) found.label = '中文营业状态文案不能为空。'
  return found
})
const source = computed(() => props.content.source[props.section] as Record<string, string | null>)
async function save() {
  if (saving.value || Object.keys(issues.value).length) return
  const submitted = JSON.stringify(card.draft.value)
  saving.value = true
  emit('busy', props.section, true)
  error.value = ''
  const url = `/api/admin/v1/site/home/content/localized/${props.content.locale}`
  try {
    const result = await api(`${url}/${props.section}`, {
      method: 'PUT', schema: adminSiteCopyResponseSchema,
      body: { expectedVersion: props.content.sections[props.section].version, payload: payload.value },
    })
    // Fields remain editable during the request: preserve any newer local edits.
    emit('saved', result.data, props.section)
    await nextTick()
    if (JSON.stringify(card.draft.value) === submitted) card.reset()
    saved.value = true
    conflict.value = false
  }
  catch (cause) {
    if (cause instanceof AdminApiError && cause.status === 409) {
      conflict.value = true
      try { emit('saved', (await api(url, { schema: adminSiteCopyResponseSchema })).data, props.section) }
      catch { error.value = '最新内容加载失败；草稿已保留，请稍后重试。' }
    }
    else error.value = '保存失败；草稿已保留，请检查内容后重试。'
  }
  finally { saving.value = false; emit('busy', props.section, false) }
}
</script>

<template>
  <AdminSiteSectionCardShell
    :section="section" :title="SITE_COPY_TITLES[section]"
    :hint="content.locale === 'zh-CN' ? '中文是默认文案。可选段落留空后隐藏。' : '留空时使用中文；中英文都未填写的可选段落不显示。'"
    :dirty="card.isDirty.value" :conflict="conflict" :saved="card.saved.value"
    :saving="saving" :has-issues="Object.keys(issues).length > 0"
    @save="save" @reset="card.reset" @adopt-latest="card.adoptLatest"
  >
    <p v-if="section === 'status'" class="copy-note">营业状态文案独立维护；调整开放程度后，请同步核对各语言的展示文案。</p>
    <div v-for="field in fields" :key="field.key">
      <AdminSiteSectionTextField
        :model-value="card.draft.value[field.key] ?? ''" :field="field.key" :label="field.label"
        :max="field.max" :rows="field.rows" :issue="issues[field.key]"
        @update:model-value="card.draft.value[field.key] = $event"
      />
      <details v-if="content.locale !== 'zh-CN'" class="copy-source">
        <summary>{{ card.draft.value[field.key]?.trim() ? '查看中文原文' : '未填写，将使用中文原文' }}</summary>
        <p>{{ source[field.key] || '中文也未填写，此段不显示。' }}</p>
      </details>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <template #latest>
      <p v-for="field in fields" :key="field.key" class="copy-source">{{ field.label }}：{{ card.latest.value[field.key] || '（未填写）' }}</p>
    </template>
  </AdminSiteSectionCardShell>
</template>

<style scoped>
.copy-note, .copy-source { color: var(--admin-text-secondary); font-size: var(--admin-font-sm); white-space: pre-wrap; overflow-wrap: anywhere; }
.copy-source summary { cursor: pointer; padding-block: var(--admin-space-2); }
</style>

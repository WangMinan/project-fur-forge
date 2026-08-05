<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import type { SiteContentSectionPayloads } from '~/composables/useAdminSiteContent'
import { hasUnsafePlainText, normalizeNullableText, SITE_CONTENT_LIMITS } from '~/utils/site-content'

const props = defineProps<{
  about: AdminSiteContentDto['about']
  mutating: boolean
  saved: boolean
}>()
const emit = defineEmits<{ save: [payload: SiteContentSectionPayloads['about']] }>()
const studioFacts = ref(props.about.studioFacts ?? '')
const makingScope = ref(props.about.makingScope ?? '')
const snapshot = () => JSON.stringify({ studioFacts: studioFacts.value, makingScope: makingScope.value })
const baseline = ref(snapshot())
const dirty = computed(() => snapshot() !== baseline.value)
watch(() => props.about, (value) => {
  if (!dirty.value) {
    studioFacts.value = value.studioFacts ?? ''
    makingScope.value = value.makingScope ?? ''
  }
  baseline.value = JSON.stringify({ studioFacts: value.studioFacts ?? '', makingScope: value.makingScope ?? '' })
}, { deep: true })
const issue = computed(() => [
  [studioFacts.value, SITE_CONTENT_LIMITS.studioFacts],
  [makingScope.value, SITE_CONTENT_LIMITS.makingScope],
].some(([value, max]) => String(value).trim().length > Number(max) || hasUnsafePlainText(String(value).trim())))
const canSubmit = computed(() => dirty.value && !issue.value && !props.mutating)
function save() {
  if (!canSubmit.value) return
  emit('save', { studioFacts: normalizeNullableText(studioFacts.value), makingScope: normalizeNullableText(makingScope.value) })
}
</script>

<template>
  <AdminSiteSectionCard
    title="关于工作室"
    description="维护工作室事实和制作范围；政策类长文本在独立 Card 中保存。"
    save-label="保存关于内容"
    :can-submit="canSubmit"
    :mutating="mutating"
    :saved="saved && !dirty"
    @save="save"
  >
    <div class="admin-content-field">
      <label class="admin-content-label" for="about-facts">工作室事实（{{ studioFacts.trim().length }}/{{ SITE_CONTENT_LIMITS.studioFacts }}）</label>
      <textarea id="about-facts" v-model="studioFacts" class="admin-content-textarea" rows="6" :maxlength="SITE_CONTENT_LIMITS.studioFacts" :disabled="mutating" />
      <p class="admin-content-hint">只写真实可核对的信息，空行用于分段。</p>
    </div>
    <div class="admin-content-field">
      <label class="admin-content-label" for="about-scope">制作范围（{{ makingScope.trim().length }}/{{ SITE_CONTENT_LIMITS.makingScope }}）</label>
      <textarea id="about-scope" v-model="makingScope" class="admin-content-textarea" rows="6" :maxlength="SITE_CONTENT_LIMITS.makingScope" :disabled="mutating" />
    </div>
    <p v-if="issue" class="admin-content-issue" role="alert">请检查字数，并移除 HTML 或脚本内容。</p>
  </AdminSiteSectionCard>
</template>

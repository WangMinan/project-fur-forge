<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import type { SiteContentSectionPayloads } from '~/composables/useAdminSiteContent'
import { hasUnsafePlainText, isValidDouyin, normalizeNullableText, SITE_CONTENT_LIMITS } from '~/utils/site-content'

const props = defineProps<{
  contact: AdminSiteContentDto['contact']
  mutating: boolean
  saved: boolean
}>()
const emit = defineEmits<{ save: [payload: SiteContentSectionPayloads['contact']] }>()
const email = ref(props.contact.email)
const qq = ref(props.contact.qq)
const douyin = ref(props.contact.douyin ?? '')
const antiScam = ref(props.contact.antiScam ?? '')
const snapshot = () => JSON.stringify({ email: email.value, qq: qq.value, douyin: douyin.value, antiScam: antiScam.value })
const baseline = ref(snapshot())
const dirty = computed(() => snapshot() !== baseline.value)
watch(() => props.contact, (value) => {
  if (!dirty.value) {
    email.value = value.email
    qq.value = value.qq
    douyin.value = value.douyin ?? ''
    antiScam.value = value.antiScam ?? ''
  }
  baseline.value = JSON.stringify({ email: value.email, qq: value.qq, douyin: value.douyin ?? '', antiScam: value.antiScam ?? '' })
}, { deep: true })
const issue = computed(() => {
  const normalizedEmail = email.value.trim()
  const normalizedQq = qq.value.trim()
  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalizedEmail)
    || normalizedEmail.length > 254
    || !/^[1-9]\d{4,11}$/u.test(normalizedQq)
    || (douyin.value.trim().length > 0 && !isValidDouyin(douyin.value.trim()))
    || antiScam.value.trim().length > SITE_CONTENT_LIMITS.antiScam
    || hasUnsafePlainText(antiScam.value.trim())
})
const canSubmit = computed(() => dirty.value && !issue.value && !props.mutating)
function save() {
  if (!canSubmit.value) return
  emit('save', {
    email: email.value.trim(),
    qq: qq.value.trim(),
    douyin: normalizeNullableText(douyin.value),
    antiScam: normalizeNullableText(antiScam.value),
  })
}
</script>

<template>
  <AdminSiteSectionCard
    title="官方渠道与防诈骗"
    description="邮箱、QQ、抖音和防诈骗说明统一在这里维护，不再分散在首页设置。"
    save-label="保存官方渠道"
    :can-submit="canSubmit"
    :mutating="mutating"
    :saved="saved && !dirty"
    @save="save"
  >
    <div class="contact-grid">
      <div class="admin-content-field">
        <label class="admin-content-label" for="contact-email">业务邮箱</label>
        <input id="contact-email" v-model="email" class="admin-content-input" type="email" maxlength="254" autocomplete="email" :disabled="mutating">
      </div>
      <div class="admin-content-field">
        <label class="admin-content-label" for="contact-qq">QQ</label>
        <input id="contact-qq" v-model="qq" class="admin-content-input" inputmode="numeric" maxlength="12" :disabled="mutating">
      </div>
      <div class="admin-content-field">
        <label class="admin-content-label" for="contact-douyin">抖音号</label>
        <input id="contact-douyin" v-model="douyin" class="admin-content-input" :maxlength="SITE_CONTENT_LIMITS.douyinMax" :disabled="mutating">
      </div>
    </div>
    <div class="admin-content-field">
      <label class="admin-content-label" for="contact-antiscam">防诈骗提示（{{ antiScam.trim().length }}/{{ SITE_CONTENT_LIMITS.antiScam }}）</label>
      <textarea id="contact-antiscam" v-model="antiScam" class="admin-content-textarea" rows="5" :maxlength="SITE_CONTENT_LIMITS.antiScam" :disabled="mutating" />
    </div>
    <p v-if="issue" class="admin-content-issue" role="alert">请检查邮箱、QQ、抖音号和纯文本字数。</p>
  </AdminSiteSectionCard>
</template>

<style scoped>
.contact-grid { display: grid; gap: var(--admin-space-3); }
@media (min-width: 768px) { .contact-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>

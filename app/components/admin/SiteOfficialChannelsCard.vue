<script setup lang="ts">
import type { AdminSiteContentDto } from '~~/shared/types/contracts'
import {
  hasUnsafePlainText,
  isValidDouyin,
  normalizeNullableText,
  SITE_CONTENT_LIMITS,
} from '~/utils/site-content'

/**
 * T34-F3 官方渠道与防诈骗提醒：抖音号与提醒文案在此保存。
 * 邮箱与 QQ 是同一官方渠道概念，此处只读展示并指向首屏设置，避免两个入口分散维护。
 */
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
  section: 'contact',
  content: () => props.content,
  conflictSection: () => props.conflictSection,
  savedSection: () => props.savedSection,
  savingSection: () => props.savingSection,
  extract: dto => ({
    douyin: dto.contact.douyin ?? '',
    antiScam: dto.contact.antiScam ?? '',
  }),
})

const issues = computed(() => {
  const found: Record<string, string> = {}
  const douyin = card.draft.value.douyin.trim()
  if (douyin && !isValidDouyin(douyin)) {
    found.douyin = '抖音号为 2–30 位字母、数字、点、下划线或连字符'
  }
  const antiScam = card.draft.value.antiScam.trim()
  if (antiScam.length > SITE_CONTENT_LIMITS.antiScam) {
    found.antiScam = `最多 ${SITE_CONTENT_LIMITS.antiScam} 字`
  }
  else if (hasUnsafePlainText(antiScam)) {
    found.antiScam = '只允许安全纯文本，不能包含 HTML 或脚本'
  }
  return found
})

function save() {
  emit('save', {
    douyin: normalizeNullableText(card.draft.value.douyin),
    antiScam: normalizeNullableText(card.draft.value.antiScam),
  })
}
</script>

<template>
  <AdminSiteSectionCardShell
    section="contact"
    title="官方联系方式与防诈骗提醒"
    hint="这些内容会公开显示，请只填写你愿意公开的官方渠道。"
    :conflict="card.conflict.value"
    :dirty="card.isDirty.value"
    :has-issues="Object.keys(issues).length > 0"
    :saved="card.saved.value"
    :saving="card.saving.value"
    @adopt-latest="card.adoptLatest"
    @reset="card.reset"
    @save="save"
  >
    <dl class="channels-fixed">
      <dt>官方邮箱</dt>
      <dd>{{ content.contact.email }}</dd>
      <dt>官方 QQ</dt>
      <dd>{{ content.contact.qq }}</dd>
    </dl>
    <p class="channels-note">
      邮箱与 QQ 在“首屏设置”里修改，这里显示当前生效的值，方便一起核对。
    </p>

    <div class="channels-field">
      <label class="channels-label" for="site-field-douyin">抖音号</label>
      <input
        id="site-field-douyin"
        v-model="card.draft.value.douyin"
        class="channels-input"
        :class="{ 'channels-input--invalid': Boolean(issues.douyin) }"
        type="text"
        inputmode="text"
        autocomplete="off"
        :aria-invalid="Boolean(issues.douyin)"
        :aria-describedby="issues.douyin ? 'site-field-douyin-issue' : undefined"
      >
      <p v-if="issues.douyin" id="site-field-douyin-issue" class="channels-issue" role="alert">
        {{ issues.douyin }}
      </p>
      <p v-else class="channels-hint">留空即不公开抖音号。</p>
    </div>

    <AdminSiteSectionTextField
      v-model="card.draft.value.antiScam"
      field="antiScam"
      label="防诈骗提醒"
      hint="提醒访客只认这些官方渠道，避免被冒充。"
      :max="SITE_CONTENT_LIMITS.antiScam"
      :rows="4"
      :issue="issues.antiScam"
    />

    <template #latest>
      <dl class="channels-fixed">
        <dt>抖音号</dt>
        <dd>{{ card.latest.value.douyin || '（未填写）' }}</dd>
        <dt>防诈骗提醒</dt>
        <dd>{{ card.latest.value.antiScam || '（未填写）' }}</dd>
      </dl>
    </template>
  </AdminSiteSectionCardShell>
</template>

<style scoped>
.channels-fixed {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--admin-space-1) var(--admin-space-3);
  margin: 0;
  font-size: var(--admin-font-sm);
}

.channels-fixed dt {
  color: var(--admin-text-secondary);
}

.channels-fixed dd {
  margin: 0;
  white-space: pre-wrap;
}

.channels-note,
.channels-hint,
.channels-issue {
  margin: 0;
  font-size: var(--admin-font-xs);
}

.channels-note,
.channels-hint {
  color: var(--admin-text-secondary);
}

.channels-issue {
  color: var(--admin-text-danger, #b3261e);
}

.channels-field {
  display: grid;
  gap: var(--admin-space-1);
}

.channels-label {
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.channels-input {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-bg-primary);
  color: var(--admin-text-primary);
  font: inherit;
  font-size: var(--admin-font-sm);
}

.channels-input--invalid {
  border-color: var(--admin-border-danger, #b3261e);
}
</style>

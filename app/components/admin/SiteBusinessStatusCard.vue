<script setup lang="ts">
import type {
  AdminSiteBusinessStatusDto,
  SiteBusinessStatusKind,
  SiteBusinessStatusTone,
} from '~~/shared/types/contracts'
import type { SiteStatusPayload } from '~/composables/useAdminSiteContent'
import {
  SITE_CONTENT_LIMITS,
  SITE_STATUS_KIND_LABELS,
  SITE_STATUS_TONE_LABELS,
  SITE_STATUS_TONE_VALUES,
  siteStatusFieldIssues,
} from '~/utils/site-content'

// 委托营业状态卡片：状态不存在时首次保存即创建（expectedVersion 0）；
// 公开链接由服务端固定指向 /commission，不接受表单提交。
const props = defineProps<{
  kind: SiteBusinessStatusKind
  mutating: boolean
  saved: boolean
  status: AdminSiteBusinessStatusDto | null
}>()

const emit = defineEmits<{
  save: [payload: SiteStatusPayload]
}>()

const tone = ref<SiteBusinessStatusTone>(props.status?.tone ?? 'open')
const label = ref(props.status?.label ?? '')

function snapshotOf() {
  return JSON.stringify({ tone: tone.value, label: label.value })
}

const baseline = ref(snapshotOf())

function syncFromStatus(status: AdminSiteBusinessStatusDto | null) {
  tone.value = status?.tone ?? 'open'
  label.value = status?.label ?? ''
  baseline.value = snapshotOf()
}

const isDirty = computed(() => snapshotOf() !== baseline.value)

watch(() => props.status, (status) => {
  if (!isDirty.value) {
    syncFromStatus(status)
  }
  else {
    // 有未保存修改时只推进基线，保留管理员输入；冲突重载后可对比重试。
    baseline.value = JSON.stringify({
      tone: status?.tone ?? 'open',
      label: status?.label ?? '',
    })
  }
})

const issues = computed(() => siteStatusFieldIssues({
  label: label.value,
}))

const canSubmit = computed(() =>
  !props.mutating && isDirty.value && Object.keys(issues.value).length === 0,
)

const showSaved = computed(() => props.saved && !isDirty.value)

function onSave() {
  if (!canSubmit.value) {
    return
  }
  emit('save', {
    tone: tone.value,
    label: label.value.trim(),
  })
}
</script>

<template>
  <section class="status-card" :aria-labelledby="`status-title-${kind}`">
    <header class="status-card__head">
      <h3 :id="`status-title-${kind}`" class="status-card__title">
        {{ SITE_STATUS_KIND_LABELS[kind] }}
      </h3>
      <p class="status-card__meta">
        <template v-if="status">当前：{{ SITE_STATUS_TONE_LABELS[status.tone] }} · {{ status.label }}</template>
        <template v-else>尚未设置；首次保存将创建该状态。</template>
      </p>
    </header>

    <div class="status-card__grid">
      <div class="status-card__field">
        <label class="status-card__label" :for="`status-tone-${kind}`">开放程度</label>
        <select
          :id="`status-tone-${kind}`"
          v-model="tone"
          class="status-card__input"
          :disabled="mutating"
        >
          <option v-for="value in SITE_STATUS_TONE_VALUES" :key="value" :value="value">
            {{ SITE_STATUS_TONE_LABELS[value] }}
          </option>
        </select>
        <p class="status-card__hint">开放显示绿色状态点，暂停显示暖色状态点。</p>
      </div>

      <div class="status-card__field">
        <label class="status-card__label" :for="`status-label-${kind}`">
          公开标签（{{ label.trim().length }}/{{ SITE_CONTENT_LIMITS.statusLabel }}）
        </label>
        <input
          :id="`status-label-${kind}`"
          v-model="label"
          class="status-card__input"
          type="text"
          :maxlength="SITE_CONTENT_LIMITS.statusLabel"
          :disabled="mutating"
        >
        <p class="status-card__hint">例如“接受委托中”或“委托暂停”；随状态点一起显示。</p>
        <p v-if="issues.label" class="status-card__issue" role="alert">{{ issues.label }}</p>
      </div>
    </div>

    <div class="status-card__actions">
      <p v-if="showSaved" class="status-card__saved" role="status">已保存</p>
      <AdminAction
        size="small"
        variant="primary"
        :disabled="!canSubmit"
        :loading="mutating"
        loading-label="保存中…"
        @click="onSave"
      >{{ status ? '保存状态' : '创建状态' }}</AdminAction>
    </div>
  </section>
</template>

<style scoped>
.status-card {
  display: grid;
  gap: var(--admin-space-3);
  padding: var(--admin-space-3);
  /* 与下方文案分区 Card 一致：卡片是白底，工作区底色不透过来。 */
  background: var(--admin-bg-primary);
  border: 1px solid var(--admin-border-secondary);
  border-radius: var(--admin-radius-sm);
}

.status-card__head {
  display: grid;
  gap: var(--admin-space-1);
}

.status-card__title {
  margin: 0;
  font-size: var(--admin-font-sm);
  font-weight: 600;
}

.status-card__meta {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.status-card__grid {
  display: grid;
  gap: var(--admin-space-3);
}

@media (min-width: 768px) {
  .status-card__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

}

.status-card__label {
  display: block;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  margin-bottom: var(--admin-space-1);
}

.status-card__input {
  width: 100%;
  padding: 0 var(--admin-space-2);
  border: 1px solid var(--admin-border-primary);
  border-radius: var(--admin-radius-sm);
  font: inherit;
  font-size: var(--admin-font-sm);
  color: var(--admin-text-primary);
  background: var(--admin-bg-primary);
}

.status-card__input {
  min-height: var(--admin-control-height-sm);
}

.status-card__hint {
  margin: var(--admin-space-1) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-text-tertiary);
}

.status-card__issue {
  margin: var(--admin-space-1) 0 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-error);
}

.status-card__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--admin-space-3);
}

.status-card__saved {
  margin: 0;
  font-size: var(--admin-font-xs);
  color: var(--admin-status-success);
}

</style>

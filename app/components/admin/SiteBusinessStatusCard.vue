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

// T26–T27 单类营业状态卡片：状态不存在时首次保存即创建（expectedVersion 0）；
// 状态链接由服务端固定指向 /commission 或 /adoptions，不接受表单提交。
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
const detail = ref(props.status?.detail ?? '')

function snapshotOf() {
  return JSON.stringify({ tone: tone.value, label: label.value, detail: detail.value })
}

const baseline = ref(snapshotOf())

function syncFromStatus(status: AdminSiteBusinessStatusDto | null) {
  tone.value = status?.tone ?? 'open'
  label.value = status?.label ?? ''
  detail.value = status?.detail ?? ''
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
      detail: status?.detail ?? '',
    })
  }
})

const issues = computed(() => siteStatusFieldIssues({
  label: label.value,
  detail: detail.value,
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
    detail: detail.value.trim(),
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
        <p class="status-card__hint">只决定公开页状态点颜色；访客看到的文字以下方两项为准。</p>
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
        <p class="status-card__hint">例如“接受委托中”；随状态一起显示在公开页。</p>
        <p v-if="issues.label" class="status-card__issue" role="alert">{{ issues.label }}</p>
      </div>

      <div class="status-card__field status-card__field--wide">
        <label class="status-card__label" :for="`status-detail-${kind}`">
          短说明（{{ detail.trim().length }}/{{ SITE_CONTENT_LIMITS.statusDetail }}）
        </label>
        <textarea
          :id="`status-detail-${kind}`"
          v-model="detail"
          class="status-card__textarea"
          rows="2"
          :maxlength="SITE_CONTENT_LIMITS.statusDetail"
          :disabled="mutating"
        />
        <p v-if="issues.detail" class="status-card__issue" role="alert">{{ issues.detail }}</p>
      </div>
    </div>

    <div class="status-card__actions">
      <p v-if="showSaved" class="status-card__saved" role="status">已保存</p>
      <button
        type="button"
        class="status-card__button"
        :disabled="!canSubmit"
        @click="onSave"
      >{{ mutating ? '保存中…' : (status ? '保存状态' : '创建状态') }}</button>
    </div>
  </section>
</template>

<style scoped>
.status-card {
  display: grid;
  gap: var(--admin-space-3);
  padding: var(--admin-space-3);
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

  .status-card__field--wide {
    grid-column: 1 / -1;
  }
}

.status-card__label {
  display: block;
  font-size: var(--admin-font-xs);
  font-weight: 600;
  margin-bottom: var(--admin-space-1);
}

.status-card__input,
.status-card__textarea {
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

.status-card__textarea {
  padding: var(--admin-space-2);
  resize: vertical;
  line-height: var(--admin-line-normal);
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

.status-card__button {
  min-height: var(--admin-control-height-sm);
  padding: 0 var(--admin-space-3);
  border: 1px solid var(--admin-accent-primary);
  border-radius: var(--admin-radius-sm);
  background: var(--admin-accent-primary);
  color: var(--admin-text-inverse);
  font-size: var(--admin-font-xs);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.status-card__button:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>

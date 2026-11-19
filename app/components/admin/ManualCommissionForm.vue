<script setup lang="ts">
import type { CommissionSubmissionDetailDto } from '~~/shared/types/contracts'
import { useManualCommission } from '~/composables/useManualCommission'

const props = withDefaults(defineProps<{ initial?: CommissionSubmissionDetailDto | null }>(), { initial: null })
const emit = defineEmits<{ saved: [detail: CommissionSubmissionDetailDto, next: boolean] }>()
const { detail, draft, upload, uploadBusy, imageKey, saving, unknownResult, error, success, errors, conflicts, versionConflict,
  dirty, locked, validate, submit, confirmConflict, reload, retry } = useManualCommission(props.initial, (value, next) => emit('saved', value, next))
const { status: authStatus } = useAdminAuth()
const leaveConfirmation = useTemplateRef<{ request: () => Promise<boolean> }>('leaveConfirmation')
const form = useTemplateRef<HTMLFormElement>('form')
const channels = [{ value: 'qq', label: 'QQ' }, { value: 'wechat', label: '微信' }, { value: 'other', label: '其他' }]
const statuses = [{ value: 'pending', label: '待处理' }, { value: 'accepted', label: '已接受' }, { value: 'rejected', label: '已拒绝' }]
const inputs = [
  { key: 'nickname', label: '称呼', type: 'text', max: 50, required: true, hint: '' },
  { key: 'species', label: '物种', type: 'text', max: 50, hint: '' },
  { key: 'phoneNumber', label: '手机号', type: 'tel', max: 11, hint: '+86 大陆手机号，可不填' },
  { key: 'qq', label: 'QQ号', type: 'text', max: 12, hint: '5–12位数字，可不填' },
  { key: 'otherContact', label: '其他联系方式', type: 'text', max: 200, hint: '微信、邮箱或海外联系方式' },
  { key: 'heightCm', label: '身高（cm）', type: 'number', min: 80, max: 250, step: 1, hint: '可后补，80–250 cm' },
  { key: 'weightKg', label: '体重（kg）', type: 'number', min: 20, max: 300, step: 0.1, hint: '可后补，20–300 kg' },
  { key: 'originalAppliedOn', label: '原申请日期', type: 'date', hint: '未知留空，不影响实际录入时间' },
] as const
function inputValue(event: Event) { return (event.target as HTMLInputElement).value }
async function save(next = false) {
  await submit(next)
  await nextTick()
  form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value) { event.preventDefault(); event.returnValue = '' }
}
onBeforeRouteLeave(() => !dirty.value || authStatus.value === 'guest' ? true : leaveConfirmation.value?.request() ?? false)
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <form ref="form" class="manual-commission" novalidate autocomplete="off" @submit.prevent="save()">
    <header class="manual-commission__header">
      <div class="manual-commission__heading">
        <NuxtLink to="/admin/commissions" class="manual-commission__back" aria-label="返回申请列表">← 委托申请</NuxtLink>
        <h1 class="manual-commission__title">{{ initial ? '编辑委托申请' : '录入委托申请' }}</h1>
        <AdminStatusBadge :tone="dirty ? 'warning' : 'neutral'" :label="dirty ? '有未保存更改' : '未更改'" />
      </div>
    <div class="manual-commission__actions">
      <AdminAction type="submit" variant="primary" :loading="saving" loading-label="正在保存…" :disabled="uploadBusy || unknownResult || (Boolean(initial) && !dirty)">{{ initial ? '保存修改' : '保存并查看' }}</AdminAction>
      <AdminAction v-if="!initial" :disabled="saving || uploadBusy || unknownResult" @click="save(true)">保存并继续录入</AdminAction>
      <AdminAction v-if="unknownResult" :loading="saving" @click="retry">核对本次保存结果</AdminAction>
    </div>
    </header>
    <p class="manual-commission__notice">后台录入不会发送邮件。至少填写称呼、来源渠道和一种联系方式，其余资料可以后补。</p>
    <p v-if="error" role="alert" class="manual-commission__error">{{ error }}</p>
    <p v-if="success" role="status" class="manual-commission__success">{{ success }}</p>
    <div class="manual-commission__columns">
      <div class="manual-commission__main">
      <section class="editor-card" aria-labelledby="manual-basics-title">
        <h2 id="manual-basics-title" class="editor-card__title">申请资料</h2>
        <div class="editor-card__grid">
          <div class="field field--wide">
            <label class="field__label" for="manual-channel">来源渠道 <span aria-hidden="true">*</span></label>
            <AdminSelect id="manual-channel" v-model="draft.channel" :options="channels" :disabled="locked" />
          </div>
          <div v-if="draft.channel === 'other'" class="field field--wide">
            <label class="field__label" for="manual-channel-label">渠道名称 <span aria-hidden="true">*</span></label>
            <input id="manual-channel-label" v-model="draft.channelLabel" class="field__input" :disabled="locked" maxlength="50" :aria-invalid="Boolean(errors.channelLabel)" aria-describedby="manual-channel-error" @blur="validate('channelLabel')">
            <p v-if="errors.channelLabel" id="manual-channel-error" class="field__error">{{ errors.channelLabel }}</p>
          </div>
          <div v-for="field in inputs" :key="field.key" class="field" :class="{ 'field--wide': field.key === 'otherContact' }">
            <label class="field__label" :for="`manual-${field.key}`">{{ field.label }} <span v-if="'required' in field" aria-hidden="true">*</span></label>
            <input
              :id="`manual-${field.key}`" class="field__input" :disabled="locked" :value="draft[field.key]" :type="field.type"
              :maxlength="field.type !== 'number' && 'max' in field ? field.max : undefined"
              :min="'min' in field ? field.min : undefined" :max="field.type === 'number' && 'max' in field ? field.max : undefined"
              :step="'step' in field ? field.step : undefined" :required="'required' in field"
              :aria-invalid="Boolean(errors[field.key])" :aria-describedby="`manual-${field.key}-hint manual-${field.key}-error`"
              @input="draft[field.key] = inputValue($event)" @blur="validate(field.key)"
            >
            <p v-if="field.hint" :id="`manual-${field.key}-hint`" class="field__hint">{{ field.hint }}</p>
            <p v-if="errors[field.key]" :id="`manual-${field.key}-error`" class="field__error">{{ errors[field.key] }}</p>
          </div>
        </div>
        <p v-if="!draft.phoneNumber.trim() && !draft.qq.trim()" class="field__hint manual-commission__contact-hint">未填写手机号或QQ，无法自动核对重复申请。</p>
      </section>
    <section class="editor-card" aria-labelledby="manual-handling-title">
      <h2 id="manual-handling-title" class="editor-card__title">处理与内部备注</h2>
      <div class="manual-commission__processing">
      <div class="editor-card__grid">
        <div class="field">
          <label class="field__label" for="manual-status">处理状态</label>
          <AdminSelect id="manual-status" v-model="draft.status" :options="statuses" :disabled="locked" />
        </div>
        <div v-if="draft.status !== 'pending'" class="field">
          <label class="field__label" for="manual-handled-on">历史处理日期</label>
          <input id="manual-handled-on" v-model="draft.historicalHandledOn" class="field__input" :disabled="locked" type="date" :aria-invalid="Boolean(errors.historicalHandledOn)" aria-describedby="manual-handled-error" @blur="validate('historicalHandledOn')">
          <p v-if="errors.historicalHandledOn" id="manual-handled-error" class="field__error">{{ errors.historicalHandledOn }}</p>
        </div>
      </div>
      <label class="checkbox" for="manual-adult">
        <input id="manual-adult" v-model="draft.offlineAdultConfirmed" class="checkbox__input" :disabled="locked" type="checkbox" :aria-invalid="Boolean(errors.offlineAdultConfirmed)" aria-describedby="manual-adult-error" @change="validate('offlineAdultConfirmed')">
        已在线下确认申请人已成年
      </label>
      <p v-if="errors.offlineAdultConfirmed" id="manual-adult-error" class="field__error">{{ errors.offlineAdultConfirmed }}</p>
      <label class="checkbox" for="manual-privacy">
        <input id="manual-privacy" v-model="draft.offlinePrivacyConfirmed" class="checkbox__input" :disabled="locked" type="checkbox" :aria-invalid="Boolean(errors.offlinePrivacyConfirmed)" aria-describedby="manual-privacy-error" @change="validate('offlinePrivacyConfirmed')">
        已在线下确认资料用于委托处理
      </label>
      <p v-if="errors.offlinePrivacyConfirmed" id="manual-privacy-error" class="field__error">{{ errors.offlinePrivacyConfirmed }}</p>
      <p class="field__hint">由管理员按实际沟通情况记录，接受申请前需完成两项确认。</p>
      <div class="field">
        <label class="field__label" for="manual-note">内部备注</label>
        <textarea id="manual-note" v-model="draft.internalNote" class="field__input manual-commission__textarea" :disabled="locked" rows="5" maxlength="2000" :aria-invalid="Boolean(errors.internalNote)" aria-describedby="manual-note-error" @blur="validate('internalNote')" />
        <p v-if="errors.internalNote" id="manual-note-error" class="field__error">{{ errors.internalNote }}</p>
      </div>
      </div>
    </section>
      </div>
      <aside class="manual-commission__aside">
        <AdminCommissionImageInput :key="imageKey" v-model="upload" :existing-href="detail?.designReferencePreviewHref ?? null" :disabled="locked" @busy="uploadBusy = $event" />
      </aside>
    </div>
    <AdminConfirmDialog :open="Boolean(conflicts)" title="发现相同联系方式的申请" confirm-label="确认继续录入" cancel-label="返回修改" :busy="saving" @confirm="confirmConflict" @cancel="conflicts = null">
      <p>请核对是否属于另一笔委托。继续将单独保存，不会合并或覆盖已有申请。</p>
      <ul class="manual-commission__matches">
        <li v-for="match in conflicts?.matches" :key="match.id">
          <strong>{{ match.nickname }} · {{ match.receiptCode }}</strong>
          <p>{{ statuses.find(item => item.value === match.status)?.label }} · {{ match.origin === 'manual' ? '后台录入' : '官网提交' }} · {{ new Date(match.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) }}</p>
          <p>{{ match.reasons.map(reason => reason === 'phone' ? '手机号相同' : 'QQ相同').join('、') }}</p>
          <a :href="`/admin/commissions/${match.id}`" target="_blank" rel="noopener noreferrer">新窗口查看详情</a>
        </li>
      </ul>
    </AdminConfirmDialog>
    <AdminConfirmDialog :open="versionConflict" title="申请已在其他位置更新" confirm-label="重新载入（放弃当前修改）" cancel-label="保留当前输入" @confirm="reload" @cancel="versionConflict = false">
      <p>保存已停止。请核对最新资料，重新载入将放弃当前输入。</p>
    </AdminConfirmDialog>
    <AdminDiscardChangesDialog ref="leaveConfirmation" />
  </form>
</template>

<style scoped src="../../assets/css/admin-editor-fields.css" />

<style scoped>
.manual-commission { display: grid; gap: var(--admin-space-5); min-width: 0; max-width: var(--admin-content-max); }
.manual-commission__header { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--admin-space-4); flex-wrap: wrap; }
.manual-commission__heading { display: flex; align-items: center; gap: var(--admin-space-3); flex-wrap: wrap; }
.manual-commission__back { display: inline-flex; align-items: center; min-height: var(--admin-touch-target); font-size: var(--admin-font-base); color: var(--admin-text-secondary); }
.manual-commission__back:hover { color: var(--admin-text-primary); }
.manual-commission__title { margin: 0; font-size: var(--admin-font-base); font-weight: 600; line-height: var(--admin-line-tight); }
.manual-commission__heading :deep(.admin-badge) { min-height: var(--admin-control-height-sm); font-size: var(--admin-font-base); }
.manual-commission__actions { display: flex; flex-wrap: wrap; gap: var(--admin-space-2); }
.manual-commission__notice, .manual-commission__success { margin: 0; padding: var(--admin-space-3) var(--admin-space-4); border-radius: var(--admin-radius-md); background: var(--admin-status-info-soft); color: var(--admin-status-info); font-size: var(--admin-font-sm); }
.manual-commission__columns, .manual-commission__main, .manual-commission__aside { display: grid; align-content: start; gap: var(--admin-space-5); min-width: 0; }
.manual-commission__processing { display: grid; gap: var(--admin-space-4); }
.manual-commission__contact-hint { margin-top: var(--admin-space-4); }
.manual-commission__textarea { padding: var(--admin-space-3); resize: vertical; }
.manual-commission__error { margin: 0; color: var(--admin-status-error); }
.manual-commission__matches { display: grid; gap: var(--admin-space-4); padding-left: 1.25rem; max-height: 50vh; overflow: auto; overflow-wrap: anywhere; }
@media (min-width: 1280px) {
  .manual-commission__columns { grid-template-columns: minmax(0, 1fr) var(--admin-editor-preview-width); align-items: start; }
  .manual-commission__aside { position: sticky; top: var(--admin-space-6); }
}
</style>

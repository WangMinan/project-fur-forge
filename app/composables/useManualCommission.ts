import { computed, reactive, ref, shallowRef } from 'vue'
import type { z } from 'zod'
import type { CommissionSubmissionDetailDto } from '~~/shared/types/contracts'
import { commissionSubmissionDetailResponseSchema } from '~~/shared/schemas/commission'
import { commissionConflictsResponseSchema, manualCommissionFieldsSchema } from '~~/shared/schemas/manual-commission'
import type { ManualCommissionSave } from '~~/shared/schemas/manual-commission'
import { AdminApiError } from './useAdminApi'

function draftFrom(detail: CommissionSubmissionDetailDto | null) {
  return {
    nickname: detail?.nickname ?? '', channel: detail?.channel ?? 'qq' as 'qq' | 'wechat' | 'other',
    channelLabel: detail?.channelLabel ?? '', species: detail?.species ?? '',
    phoneNumber: detail?.phone?.number ?? '', qq: detail?.qq ?? '', otherContact: detail?.otherContact ?? '',
    heightCm: detail?.heightCm?.toString() ?? '', weightKg: detail?.weightKg?.toString() ?? '',
    originalAppliedOn: detail?.originalAppliedOn ?? '', historicalHandledOn: detail?.historicalHandledOn ?? '',
    status: detail?.status ?? 'pending', internalNote: detail?.internalNote ?? '',
    offlineAdultConfirmed: detail?.offlineAdultConfirmed ?? false, offlinePrivacyConfirmed: detail?.offlinePrivacyConfirmed ?? false,
  }
}

export function useManualCommission(initial: CommissionSubmissionDetailDto | null, onSaved: (detail: CommissionSubmissionDetailDto, next: boolean) => void) {
  const api = useAdminApi()
  const detail = shallowRef(initial)
  const draft = reactive(draftFrom(initial))
  const baseline = shallowRef(JSON.stringify(draft))
  const requestId = shallowRef(crypto.randomUUID())
  const upload = ref<ManualCommissionSave['upload']>(undefined)
  const uploadBusy = shallowRef(false)
  const imageKey = shallowRef(0)
  const saving = shallowRef(false)
  const unknownResult = shallowRef(false)
  const error = shallowRef<string | null>(null)
  const success = shallowRef<string | null>(null)
  const errors = ref<Record<string, string>>({})
  const conflicts = shallowRef<z.infer<typeof commissionConflictsResponseSchema>['data'] | null>(null)
  const versionConflict = shallowRef(false)
  const reloading = shallowRef(false)
  const reloadError = shallowRef<string | null>(null)
  const dirty = computed(() => baseline.value !== JSON.stringify(draft) || upload.value !== undefined || uploadBusy.value || unknownResult.value)
  const locked = computed(() => saving.value || unknownResult.value)
  let pending: ManualCommissionSave & { requestId?: string, expectedVersion?: number } | null = null
  let saveAndNext = false

  function payload() {
    const text = (value: string) => value.trim() || null
    return {
      nickname: draft.nickname, channel: draft.channel, channelLabel: draft.channel === 'other' ? text(draft.channelLabel) : null,
      species: text(draft.species), phone: text(draft.phoneNumber) ? { countryCode: '+86' as const, number: draft.phoneNumber.trim() } : null,
      qq: text(draft.qq), otherContact: text(draft.otherContact),
      heightCm: text(draft.heightCm) ? Number(draft.heightCm) : null, weightKg: text(draft.weightKg) ? Number(draft.weightKg) : null,
      originalAppliedOn: text(draft.originalAppliedOn), historicalHandledOn: draft.status === 'pending' ? null : text(draft.historicalHandledOn),
      status: draft.status, internalNote: text(draft.internalNote), offlineAdultConfirmed: draft.offlineAdultConfirmed,
      offlinePrivacyConfirmed: draft.offlinePrivacyConfirmed,
    }
  }

  function validate(field?: string) {
    const parsed = manualCommissionFieldsSchema.safeParse(payload())
    const next: Record<string, string> = {}
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const name = issue.path[0] === 'phone' ? 'phoneNumber' : String(issue.path[0])
      next[name] ??= issue.message.startsWith('Invalid') || issue.message.startsWith('Too ')
        ? '请检查填写格式和允许范围' : issue.message
    }
    errors.value = field ? { ...errors.value, [field]: next[field] ?? '' } : next
    return parsed
  }

  async function showConflicts(input: ManualCommissionSave) {
    const response = await api('/api/admin/v1/commissions/conflicts', {
      method: 'POST', body: { phone: input.fields.phone, qq: input.fields.qq, ...(detail.value ? { excludeId: detail.value.id } : {}) },
      schema: commissionConflictsResponseSchema,
    })
    if (!response.data.matches.length) return false
    saving.value = false
    conflicts.value = response.data
    return true
  }

  function reset(saved: CommissionSubmissionDetailDto | null) {
    detail.value = saved
    Object.assign(draft, draftFrom(saved))
    baseline.value = JSON.stringify(draft)
    upload.value = undefined
    imageKey.value++
    requestId.value = crypto.randomUUID()
    errors.value = {}
    pending = null
    unknownResult.value = false
  }

  async function persist() {
    if (!pending || saving.value) return
    saving.value = true
    error.value = null
    conflicts.value = null
    try {
      const response = await api(detail.value ? `/api/admin/v1/commissions/${detail.value.id}` : '/api/admin/v1/commissions', {
        method: detail.value ? 'PUT' : 'POST', body: pending, schema: commissionSubmissionDetailResponseSchema,
      })
      const saved = response.data
      reset(saveAndNext ? null : saved)
      success.value = `申请 ${saved.receiptCode} 已保存。${saveAndNext ? '可以继续录入下一条。' : ''}`
      onSaved(saved, saveAndNext)
    }
    catch (failure) {
      const known = failure instanceof AdminApiError && failure.status !== null && failure.status < 500
      unknownResult.value = !known
      if (failure instanceof AdminApiError && failure.reason === 'COMMISSION_CONTACT_CONFLICT') {
        pending.conflictConfirmation = null
        try { if (!await showConflicts(pending)) error.value = '匹配记录已变化，请重新保存。' }
        catch { error.value = '无法核对匹配申请，请稍后重新保存。' }
      }
      else if (failure instanceof AdminApiError && failure.reason === 'VERSION_CONFLICT') {
        reloadError.value = null
        versionConflict.value = true
      }
      else if (failure instanceof AdminApiError && failure.reason === 'UPLOAD_SESSION_EXPIRED') {
        error.value = '图片上传会话已过期，请重新选择图片上传后保存。'
      }
      else if (failure instanceof AdminApiError && failure.reason === 'COMMISSION_REQUEST_DELETED') {
        error.value = '这次保存的申请已被删除，请返回列表核对。'
      }
      else error.value = known ? '保存未完成，请检查输入后重试，当前内容已保留。' : '保存结果尚未确认，当前输入已保留。请核对本次保存结果，勿另建申请。'
    }
    finally { saving.value = false }
  }

  async function submit(next = false) {
    if (saving.value || uploadBusy.value || unknownResult.value) return
    success.value = null
    const parsed = validate()
    if (!parsed.success) return
    saveAndNext = next
    pending = {
      fields: parsed.data, ...(upload.value === undefined ? {} : { upload: upload.value }), conflictConfirmation: null,
      ...(detail.value ? { expectedVersion: detail.value.version } : { requestId: requestId.value }),
    }
    saving.value = true
    try {
      const contactChanged = !detail.value || detail.value.phone?.number !== parsed.data.phone?.number || detail.value.qq !== parsed.data.qq
      if (contactChanged && await showConflicts(pending)) return
    }
    catch { error.value = '冲突检查未完成，请稍后重试，当前内容已保留。'; return }
    finally { saving.value = false }
    await persist()
  }

  async function confirmConflict() {
    if (!pending || !conflicts.value) return
    pending.conflictConfirmation = conflicts.value.confirmation
    await persist()
  }

  async function reload() {
    if (!detail.value || reloading.value) return
    reloading.value = true
    reloadError.value = null
    try {
      const response = await api(`/api/admin/v1/commissions/${detail.value.id}`, { schema: commissionSubmissionDetailResponseSchema })
      reset(response.data)
      versionConflict.value = false
      error.value = null
      onSaved(response.data, false)
    }
    catch { reloadError.value = '重新载入失败，当前输入仍保留。请重试或返回编辑。' }
    finally { reloading.value = false }
  }

  return { detail, draft, upload, uploadBusy, imageKey, saving, unknownResult, error, success, errors, conflicts, versionConflict,
    dirty, locked, validate, submit, confirmConflict, reload, reloading, reloadError, retry: persist }
}

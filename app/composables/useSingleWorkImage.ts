import { computed, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import type { Ref } from 'vue'
import type { ManagedWorkDto, VerifiedAssetDto } from '~~/shared/types/contracts'
import { managedWorkResponseSchema } from '~~/shared/schemas/work'
import { retryAssetProcessingResponseSchema } from '~~/shared/schemas/upload'
import { AdminApiError } from './useAdminApi'
import { workApiErrorText } from '~/utils/work-errors'

export function useSingleWorkImage<T extends { assetId: string, alt: string, status: VerifiedAssetDto['status'], version: number }>(options: {
  work: () => ManagedWorkDto
  locked: () => boolean
  role: 'design_sheet' | 'adoption_cover'
  label: string
  fromWork: (work: ManagedWorkDto) => T | null
  fromAsset: (asset: VerifiedAssetDto) => T
  payload: (entry: T | null) => unknown
  saved: (work: ManagedWorkDto) => void
  conflict: () => void
  stateChange: (state: { busy: boolean, dirty: boolean }) => void
}) {
  const adminApi = useAdminApi()
  const entry = ref(options.fromWork(options.work())) as Ref<T | null>
  const baseline = shallowRef(JSON.stringify(options.payload(entry.value)))
  const saving = shallowRef(false)
  const processing = shallowRef(false)
  const saveError = shallowRef<string | null>(null)
  const isDirty = computed(() => JSON.stringify(options.payload(entry.value)) !== baseline.value)
  const uploads = useStudioPhotoUpload({
    mediaRole: options.role,
    onAssetReady(item, asset) {
      if (entry.value?.assetId !== asset.assetId) entry.value = options.fromAsset(asset)
      uploads.dismiss(item)
    },
    onWorkConflict: options.conflict,
  })
  const busyUploads = computed(() => uploads.items.value.some(item => ['digesting', 'uploading', 'validating'].includes(item.state)))

  function resetFromWork(work: ManagedWorkDto) {
    entry.value = options.fromWork(work)
    baseline.value = JSON.stringify(options.payload(entry.value))
  }
  watch(options.work, (work) => { if (!isDirty.value) resetFromWork(work) })
  watchEffect(() => options.stateChange({ busy: saving.value || processing.value || busyUploads.value, dirty: isDirty.value }))
  onMounted(() => void uploads.restore({ workId: options.work().id, workVersion: options.work().version }))

  async function retryProcessing() {
    const current = entry.value
    if (!current || processing.value || options.locked()) return
    processing.value = true
    saveError.value = null
    try {
      const response = await adminApi(`/api/admin/v1/media/assets/${current.assetId}/retry-processing`, {
        method: 'POST', body: { expectedVersion: current.version, payload: {} }, schema: retryAssetProcessingResponseSchema,
      })
      if (entry.value?.assetId === current.assetId) {
        entry.value.status = response.data.status
        entry.value.version = response.data.version
      }
    }
    catch (error) {
      if (!(error instanceof AdminApiError && error.status === 401)) saveError.value = '重试处理失败，请稍后重试。'
    }
    finally { processing.value = false }
  }

  async function save(): Promise<boolean> {
    if (saving.value || processing.value || busyUploads.value || options.locked()) return false
    saveError.value = null
    if (entry.value && !entry.value.alt.trim()) {
      saveError.value = `${options.label}需要填写图片说明后才能保存。`
      return false
    }
    saving.value = true
    try {
      const work = options.work()
      const field = options.role === 'design_sheet' ? 'designSheet' : 'adoptionCover'
      const response = await adminApi(`/api/admin/v1/works/${work.id}/${options.role.replace('_', '-')}`, {
        method: 'PUT', body: { expectedVersion: work.version, payload: { [field]: options.payload(entry.value) } },
        schema: managedWorkResponseSchema,
      })
      resetFromWork(response.data)
      options.saved(response.data)
      return true
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) return false
      if (error instanceof AdminApiError && ['DETAIL_GALLERY_EMPTY', 'ADOPTION_SOURCE_UNAVAILABLE'].includes(error.reason ?? '')) {
        saveError.value = workApiErrorText(error, '图片展示设置无效。')
      }
      else if (error instanceof AdminApiError && error.status === 409) {
        options.conflict()
        saveError.value = `作品数据已在其他地方变化，本次${options.label}未保存。`
      }
      else {
        saveError.value = workApiErrorText(error, `保存${options.label}失败，请检查图片说明后重试。`)
      }
      return false
    }
    finally { saving.value = false }
  }

  return { entry, isDirty, saving, processing, saveError, uploads, resetFromWork, retryProcessing, save }
}

import {
  watermarkBrandingResponseSchema,
  watermarkOperationResponseSchema,
  watermarkProfileResponseSchema,
} from '~~/shared/schemas/watermark'
import type {
  WatermarkBrandingDto,
  WatermarkOperationDto,
  WatermarkOperationStatus,
} from '~~/shared/types/contracts'
import { AdminApiError } from './useAdminApi'

// GATE-07 站点品牌（居中水印）页面状态：branding 快照为唯一状态基线，
// 所有写操作带 expectedVersion；409 一律重新 GET，不自行递增或猜测版本。
// 应用接口先返回持久化操作记录，UI 按 status 轮询真实进度；页面重载后
// 通过 lastOperationId 恢复最近操作并继续轮询未完成状态。

const IN_PROGRESS_STATUSES: readonly WatermarkOperationStatus[] = [
  'GENERATING_PUBLIC',
  'VERIFYING_PUBLIC',
  'SWITCHING_PROFILE',
  'CLEANING_PUBLIC',
]

const POLL_INTERVAL_MS = 2_000

export function useWatermarkBranding() {
  const adminApi = useAdminApi()

  const branding = ref<WatermarkBrandingDto | null>(null)
  const pageStatus = ref<'error' | 'loading' | 'ready'>('loading')
  const operation = ref<WatermarkOperationDto | null>(null)
  const conflictNotice = ref<string | null>(null)
  const mutating = ref(false)

  let pollTimer: ReturnType<typeof setTimeout> | null = null

  function stopPolling() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  function isInProgress(status: WatermarkOperationStatus) {
    return IN_PROGRESS_STATUSES.includes(status)
  }

  async function fetchOperation(operationId: string) {
    try {
      const result = await adminApi(
        `/api/admin/v1/site/branding/watermark-operations/${operationId}`,
        { schema: watermarkOperationResponseSchema },
      )
      operation.value = result.data
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      // 操作记录读取失败不阻塞页面主体；保留已有状态。
    }
  }

  function ensurePolling() {
    stopPolling()
    const current = operation.value
    if (!current || !isInProgress(current.status)) {
      return
    }
    pollTimer = setTimeout(async () => {
      await fetchOperation(current.operationId)
      if (operation.value && !isInProgress(operation.value.status)) {
        await refreshBranding()
        return
      }
      ensurePolling()
    }, POLL_INTERVAL_MS)
  }

  async function refreshBranding() {
    try {
      const result = await adminApi('/api/admin/v1/site/branding/watermark', {
        schema: watermarkBrandingResponseSchema,
      })
      branding.value = result.data
      return result.data
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      return null
    }
  }

  async function load(options: { initial?: boolean } = {}) {
    if (options.initial || pageStatus.value !== 'ready') {
      pageStatus.value = 'loading'
    }
    conflictNotice.value = null
    try {
      const result = await adminApi('/api/admin/v1/site/branding/watermark', {
        schema: watermarkBrandingResponseSchema,
      })
      branding.value = result.data
      pageStatus.value = 'ready'
      if (result.data.lastOperationId) {
        await fetchOperation(result.data.lastOperationId)
        ensurePolling()
      }
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return
      }
      pageStatus.value = 'error'
    }
  }

  async function onConflict(message: string) {
    conflictNotice.value = message
    const latest = await refreshBranding()
    if (latest?.lastOperationId) {
      await fetchOperation(latest.lastOperationId)
      ensurePolling()
    }
  }

  // 返回 null 表示成功；否则为可展示的中文错误。
  async function createDraft(input: {
    opacityPercent: number
    scalePercent: number
    sourceAssetId: string
  }): Promise<string | null> {
    const current = branding.value
    if (!current || mutating.value) {
      return null
    }
    mutating.value = true
    try {
      await adminApi('/api/admin/v1/site/branding/watermark-profiles', {
        method: 'POST',
        body: {
          expectedVersion: current.version,
          payload: input,
        },
        schema: watermarkProfileResponseSchema,
      })
      await refreshBranding()
      conflictNotice.value = null
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        await onConflict('站点品牌数据已在其他地方变化，已重新加载，请确认后重试。')
        return '草稿保存未提交：版本已变化，请确认当前内容后重试。'
      }
      if (error instanceof AdminApiError && error.status === 400) {
        return '参数未通过服务端校验：不透明度需在 10–90，缩放需在 20–90。'
      }
      return '保存草稿失败，请稍后重试。'
    }
    finally {
      mutating.value = false
    }
  }

  async function runProfileMutation(
    kind: 'apply' | 'preview',
  ): Promise<string | null> {
    const current = branding.value
    const draft = current?.draftProfile
    if (!current || !draft || mutating.value) {
      return null
    }
    mutating.value = true
    try {
      const result = await adminApi(
        `/api/admin/v1/site/branding/watermark-profiles/${draft.id}/${kind}`,
        {
          method: 'POST',
          body: {
            expectedVersion: draft.version,
            payload: { brandingVersion: current.version },
          },
          schema: watermarkOperationResponseSchema,
        },
      )
      operation.value = result.data
      conflictNotice.value = null
      ensurePolling()
      if (!isInProgress(result.data.status)) {
        await refreshBranding()
      }
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        await onConflict('站点品牌数据已在其他地方变化，已重新加载，请确认后重试。')
        return kind === 'preview'
          ? '预览未启动：草稿或版本已变化，请确认后重试。'
          : '应用未启动：草稿或版本已变化，请确认后重试。'
      }
      return kind === 'preview'
        ? '预览启动失败，请稍后重试。'
        : '应用启动失败，请稍后重试。'
    }
    finally {
      mutating.value = false
    }
  }

  async function retryOperation(): Promise<string | null> {
    const current = operation.value
    if (!current || current.status !== 'FAILED' || mutating.value) {
      return null
    }
    mutating.value = true
    try {
      const result = await adminApi(
        `/api/admin/v1/site/branding/watermark-operations/${current.operationId}/retry`,
        {
          method: 'POST',
          body: { expectedVersion: current.version, payload: {} },
          schema: watermarkOperationResponseSchema,
        },
      )
      operation.value = result.data
      conflictNotice.value = null
      ensurePolling()
      if (!isInProgress(result.data.status)) {
        await refreshBranding()
      }
      return null
    }
    catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        return null
      }
      if (error instanceof AdminApiError && error.status === 409) {
        await fetchOperation(current.operationId)
        return '操作状态已变化，请按最新状态继续。'
      }
      return '重试失败，请稍后重试。'
    }
    finally {
      mutating.value = false
    }
  }

  onScopeDispose(stopPolling)

  return {
    branding,
    conflictNotice,
    createDraft,
    load,
    mutating,
    operation,
    pageStatus,
    refreshBranding,
    retryOperation,
    runProfileMutation,
  }
}
